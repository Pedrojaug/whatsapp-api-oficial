import { Router, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { decryptToken } from "../utils/crypto";
import { messageEventEmitter } from "../utils/emitter";
import { metaService } from "../services/metaService";
import { resolveMetaMediaId } from "../utils/mediaUpload";
import { normalizePhone } from "../services/phoneService";

const router = Router();

// Aplica autenticação a todas as rotas de mensagens
router.use(authMiddleware);

// Rate limiter para envio individual: 120 mensagens por minuto por usuário
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => (req as AuthenticatedRequest).userId ?? ipKeyGenerator(req.ip ?? "unknown"),
  message: { error: "Muitas requisições de envio. Aguarde 1 minuto antes de tentar novamente." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    console.warn(`[RateLimit] Envio bloqueado (limite 120/min) para usuário ${(req as AuthenticatedRequest).userId ?? req.ip}. As mensagens excedentes NÃO foram enfileiradas.`);
    res.status(429).json({ error: "Muitas requisições de envio. Aguarde 1 minuto antes de tentar novamente." });
  },
});

// Enviar mensagem via Template (scoped to user)
router.post("/accounts/:accountId/messages/send", sendLimiter, async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { to, templateName, language, variables, mediaUrl, scheduledAt } = req.body;

  if (!to || !templateName) {
    return res.status(400).json({ error: "Destinatário (to) e Template são obrigatórios." });
  }

  const normalizedTo = normalizePhone(to);
  if (normalizedTo.length < 8) {
    return res.status(400).json({ error: "Número de telefone destinatário inválido." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });

    const template = await prisma.template.findFirst({
      where: { accountId, name: templateName },
    });

    const optedOut = await prisma.optOut.findUnique({
      where: { phone_accountId: { phone: normalizedTo, accountId } },
    });
    if (optedOut) {
      return res.status(422).json({ error: "Este número está na lista de opt-out (LGPD).", code: "OPT_OUT" });
    }

    const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null;
    const isFutureScheduled = scheduledAtDate && scheduledAtDate.getTime() > Date.now();

    // Criar o log no banco local como PENDING
    const dbMessage = await prisma.message.create({
      data: {
        accountId,
        to: normalizedTo,
        templateName,
        variables: variables ? { variables, mediaUrl } : (mediaUrl ? { mediaUrl } : {}),
        status: "PENDING",
        scheduledAt: scheduledAtDate,
      },
    });

    // Se a mensagem está agendada para o futuro, o dispatcher vai processá-la depois
    if (isFutureScheduled) {
      return res.status(201).json({
        ...dbMessage,
        message: "Mensagem agendada com sucesso para envio posterior."
      });
    }

    // Marcar como PROCESSING para o dispatcher não pegar antes de terminar o envio direto
    await prisma.message.update({
      where: { id: dbMessage.id },
      data: { status: "PROCESSING" },
    });

    const decryptedToken = decryptToken(account.accessToken);
    const components: any[] = [];

    // 1. Processar cabeçalho de mídia se necessário
    const templateComponents = template?.components as any[];
    const headerComp = templateComponents && Array.isArray(templateComponents)
      ? templateComponents.find((c: any) => c.type === "HEADER")
      : null;

    const bodyComp = templateComponents && Array.isArray(templateComponents)
      ? templateComponents.find((c: any) => c.type === "BODY")
      : null;

    // Reconstruir corpo do template para persistência de histórico
    let reconstructedBody: string | null = null;
    if (bodyComp && bodyComp.text) {
      reconstructedBody = bodyComp.text;
      const resolvedVars = variables || [];
      if (Array.isArray(resolvedVars)) {
        resolvedVars.forEach((val: any, idx: number) => {
          reconstructedBody = reconstructedBody!.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'), String(val));
        });
      }
    }

    if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format) && mediaUrl) {
      const typeLower = headerComp.format.toLowerCase();
      // Sobe para a Meta e envia por id (a Meta hospeda), com fallback para link.
      const mediaId = await resolveMetaMediaId(account.phoneNumberId, decryptedToken, mediaUrl, accountId);
      const mediaObj: any = mediaId ? { id: mediaId } : { link: mediaUrl };
      if (typeLower === "document") mediaObj.filename = mediaUrl.split("/").pop() || "document.pdf";
      components.push({
        type: "header",
        parameters: [{ type: typeLower, [typeLower]: mediaObj }],
      });
    }

    // 2. Processar variáveis do corpo
    if (variables && Array.isArray(variables) && variables.length > 0) {
      components.push({
        type: "body",
        parameters: variables.map((v: any) => ({
          type: "text",
          text: String(v),
        })),
      });
    }

    try {
      const response = await metaService.sendMessage(account.phoneNumberId, decryptedToken, {
        messaging_product: "whatsapp",
        to: normalizedTo,
        type: "template",
        template: {
          name: templateName,
          language: {
            code: language || template?.language || "pt_BR",
          },
          ...(components.length > 0 ? { components } : {}),
        },
      });

      const wamid = response.data.messages?.[0]?.id;

      // Atualizar status para SENT
      const updatedMessage = await prisma.message.update({
        where: { id: dbMessage.id },
        data: {
          wamid,
          status: "SENT",
          body: reconstructedBody,
        },
      });

      res.json(updatedMessage);
    } catch (metaError: any) {
      console.error("Meta API Message Error:", metaError.response?.data || metaError.message);
      
      const errMsg = metaError.response?.data?.error?.message || metaError.message;
      await prisma.message.update({
        where: { id: dbMessage.id },
        data: {
          status: "PENDING",
          errorMessage: errMsg,
          nextRetryAt: new Date(Date.now() + 60_000),
        },
      });

      res.status(400).json({
        error: "Erro da API da Meta ao enviar mensagem",
        details: metaError.response?.data || metaError.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List messages logs (scoped to user) with filters and pagination
router.get("/accounts/:accountId/messages", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { search, status, templateName, direction, page = "1", limit = "50" } = req.query;

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const p = parseInt(page as string) || 1;
    const l = parseInt(limit as string) || 50;
    const skip = (p - 1) * l;

    const whereClause: any = {
      accountId,
    };

    // Por padrão o histórico lista apenas envios (OUTGOING); mensagens recebidas
    // via webhook só aparecem com ?direction=INCOMING ou filtro de status explícito.
    if (direction) {
      whereClause.direction = direction as string;
    } else if (!status) {
      whereClause.direction = "OUTGOING";
    }

    if (status) {
      whereClause.status = status as string;
    }

    if (templateName) {
      whereClause.templateName = templateName as string;
    }

    if (search) {
      whereClause.OR = [
        { to: { contains: search as string } },
        { templateName: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [messages, total] = await prisma.$transaction([
      prisma.message.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: l,
      }),
      prisma.message.count({
        where: whereClause,
      }),
    ]);

    res.json({
      messages,
      total,
      page: p,
      limit: l,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// SSE events route to stream real-time updates for messages (scoped to user)
router.get("/accounts/:accountId/messages/events", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;

  try {
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    // Configurar cabeçalhos para Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders(); // Envia os cabeçalhos imediatamente

    // Enviar mensagem de conexão estabelecida
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    // Heartbeat periódico (evita timeout de proxies/Load Balancers como Render/Cloudflare)
    const keepAliveInterval = setInterval(() => {
      res.write(":\n\n"); // SSE comment frame
    }, 20000);

    const onMessageUpdated = (data: any) => {
      if (data.accountId === accountId) {
        res.write(`data: ${JSON.stringify({ type: "messageUpdated", ...data })}\n\n`);
      }
    };

    messageEventEmitter.on("messageUpdated", onMessageUpdated);

    // Limpar listener quando a conexão fechar
    req.on("close", () => {
      clearInterval(keepAliveInterval);
      messageEventEmitter.off("messageUpdated", onMessageUpdated);
    });

  } catch (error: any) {
    console.error("Erro no SSE de mensagens:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// Obter métricas filtradas por período (scoped to user)
router.get("/accounts/:accountId/metrics", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { period, startDate: queryStart, endDate: queryEnd } = req.query;

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const start = new Date();
    const end = new Date();

    if (period === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "yesterday") {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (period === "7days") {
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "30days") {
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "custom" && queryStart) {
      const parsedStart = new Date(queryStart as string);
      parsedStart.setHours(0, 0, 0, 0);
      start.setTime(parsedStart.getTime());
      
      if (queryEnd) {
        const parsedEnd = new Date(queryEnd as string);
        parsedEnd.setHours(23, 59, 59, 999);
        end.setTime(parsedEnd.getTime());
      } else {
        end.setHours(23, 59, 59, 999);
      }
    } else {
      // Default to last 7 days
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    const messages = await prisma.message.findMany({
      where: {
        accountId,
        direction: "OUTGOING",
        // Painel de metricas mede DISPAROS (templates); mensagens de chat (TEXT)
        // enviadas pela caixa de entrada ou pelo bot SDR nao entram no funil.
        messageType: "TEMPLATE",
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        status: true,
        createdAt: true,
        templateName: true
      }
    });

    // Calculate totals (cumulative funnel logic)
    let sent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;

    messages.forEach(msg => {
      if (msg.status === "READ") {
        read++;
        delivered++;
        sent++;
      } else if (msg.status === "DELIVERED") {
        delivered++;
        sent++;
      } else if (msg.status === "SENT") {
        sent++;
      } else if (msg.status === "FAILED") {
        failed++;
      }
    });
    const total = messages.length;

    // Helper to format Date local to YYYY-MM-DD
    const formatDateLocal = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Group by day for the chart
    const dailyMap = new Map<string, { date: string; sent: number; read: number; failed: number }>();
    
    // Initialize chart dates so that dates with 0 messages are shown!
    const current = new Date(start);
    while (current.getTime() <= end.getTime()) {
      const dateStr = formatDateLocal(current);
      dailyMap.set(dateStr, { date: dateStr, sent: 0, read: 0, failed: 0 });
      current.setDate(current.getDate() + 1);
    }

    messages.forEach(msg => {
      const dateStr = formatDateLocal(msg.createdAt);
      const dayData = dailyMap.get(dateStr);
      if (dayData) {
        if (msg.status === "READ") {
          dayData.read++;
          dayData.sent++;
        } else if (msg.status === "DELIVERED" || msg.status === "SENT") {
          dayData.sent++;
        } else if (msg.status === "FAILED") {
          dayData.failed++;
        }
      }
    });

    const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Agrupar por nome do template para tabela de performance
    const templateMap = new Map<string, { templateName: string; sent: number; read: number; failed: number; total: number }>();

    messages.forEach(msg => {
      const tName = msg.templateName || "Envio Direto";
      if (!templateMap.has(tName)) {
        templateMap.set(tName, { templateName: tName, sent: 0, read: 0, failed: 0, total: 0 });
      }
      const tData = templateMap.get(tName)!;
      tData.total++;
      if (msg.status === "READ") {
        tData.read++;
        tData.sent++;
      } else if (msg.status === "DELIVERED" || msg.status === "SENT") {
        tData.sent++;
      } else if (msg.status === "FAILED") {
        tData.failed++;
      }
    });

    const templateMetrics = Array.from(templateMap.values()).sort((a, b) => b.total - a.total);

    res.json({
      totals: { sent, delivered, read, failed, total },
      chartData,
      templateMetrics
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter mensagens agendadas para o futuro (scoped to user)
router.get("/accounts/:accountId/scheduled", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const now = new Date();
    const scheduledMessages = await prisma.message.findMany({
      where: {
        accountId,
        status: "PENDING",
        scheduledAt: { gt: now }
      },
      orderBy: { scheduledAt: "asc" }
    });

    res.json(scheduledMessages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelar agendamento individual (scoped to user)
router.delete("/accounts/:accountId/scheduled/:messageId", async (req: Request, res: Response) => {
  const { accountId, messageId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const msg = await prisma.message.findFirst({
      where: { id: messageId, accountId }
    });
    if (!msg) return res.status(404).json({ error: "Mensagem agendada não encontrada" });

    if (msg.status !== "PENDING") {
      return res.status(400).json({ error: "Esta mensagem já foi processada ou está em andamento e não pode ser cancelada" });
    }

    await prisma.message.delete({
      where: { id: messageId }
    });

    // Notificar SSE
    messageEventEmitter.emit("messageUpdated", {
      accountId,
      messageId,
      status: "CANCELLED",
      wamid: null,
      errorMessage: "Cancelada pelo usuário",
      updatedAt: new Date(),
    });

    res.json({ success: true, message: "Agendamento cancelado com sucesso." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reagendar mensagem (scoped to user)
router.post("/accounts/:accountId/scheduled/:messageId/reschedule", async (req: Request, res: Response) => {
  const { accountId, messageId } = req.params;
  const { scheduledAt } = req.body;

  if (!scheduledAt) {
    return res.status(400).json({ error: "Nova data/hora de agendamento é obrigatória." });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const msg = await prisma.message.findFirst({
      where: { id: messageId, accountId }
    });
    if (!msg) return res.status(404).json({ error: "Mensagem agendada não encontrada" });

    if (msg.status !== "PENDING") {
      return res.status(400).json({ error: "Esta mensagem já foi processada e não pode ser reagendada." });
    }

    const newDate = new Date(scheduledAt);
    if (isNaN(newDate.getTime()) || newDate <= new Date()) {
      return res.status(400).json({ error: "A data de agendamento deve ser uma data válida e futura." });
    }

    const updatedMsg = await prisma.message.update({
      where: { id: messageId },
      data: {
        scheduledAt: newDate,
        nextRetryAt: null,
        retryCount: 0,
      }
    });

    // Notificar SSE
    messageEventEmitter.emit("messageUpdated", {
      accountId,
      messageId: updatedMsg.id,
      status: updatedMsg.status,
      wamid: null,
      errorMessage: null,
      updatedAt: updatedMsg.updatedAt,
    });

    res.json({ success: true, message: "Mensagem reagendada com sucesso.", data: updatedMsg });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
