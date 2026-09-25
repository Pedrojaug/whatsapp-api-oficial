import { Router, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { checkSubscriptionActive, checkMonthlyMessageLimit } from "../middlewares/planLimits";
import { decryptToken } from "../utils/crypto";
import { messageEventEmitter } from "../utils/emitter";
import { metaService } from "../services/metaService";
import { resolveMetaMediaId } from "../utils/mediaUpload";
import { normalizePhone } from "../services/phoneService";
import { triggerDispatcher } from "../workers/dispatcher";
import { findAccountForUser } from "../utils/accountAccess";
import { getAccountFinancialMetrics } from "../utils/pricing";

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
  validate: { xForwardedForHeader: false, default: false },
  handler: (req, res) => {
    console.warn(`[RateLimit] Envio bloqueado (limite 120/min) para usuário ${(req as AuthenticatedRequest).userId ?? req.ip}. As mensagens excedentes NÃO foram enfileiradas.`);
    res.status(429).json({ error: "Muitas requisições de envio. Aguarde 1 minuto antes de tentar novamente." });
  },
});

// Enviar mensagem via Template (scoped to user)
router.post("/accounts/:accountId/messages/send", checkSubscriptionActive, checkMonthlyMessageLimit, sendLimiter, async (req: Request, res: Response) => {
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
      triggerDispatcher();
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
    // via webhook só aparecem com ?direction=INCOMING ou se o status for explicitamente RECEIVED.
    if (direction) {
      whereClause.direction = direction as string;
    } else if (status === "RECEIVED") {
      whereClause.direction = "INCOMING";
    } else {
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
    const userId = (req as AuthenticatedRequest).userId!;
    const account = await findAccountForUser(accountId, userId);
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

    // Helper para formatar data local no formato YYYY-MM-DD
    const formatDateLocal = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // Agregações nativas em SQL no PostgreSQL (100x mais rápido que baixar 50k mensagens para a memória do Node.js)
    const [totalsResult, dailyOutgoingResult, dailyIncomingResult, incomingOverallResult, templateMetricsResult, optOutsCount] = await Promise.all([
      // 1. Totais consolidados de mensagens de saída e diagnóstico de falhas em 1 única linha
      prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status IN ('SENT', 'DELIVERED', 'READ'))::int as sent,
          COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ'))::int as delivered,
          COUNT(*) FILTER (WHERE status = 'READ')::int as read,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed,
          COUNT(*) FILTER (WHERE status = 'FAILED' AND (
            "errorMessage" ILIKE '%131026%' OR "errorMessage" ILIKE '%undeliverable%' OR "errorMessage" ILIKE '%inválido%' OR "errorMessage" ILIKE '%sem whatsapp%'
          ))::int as "invalidNumbers",
          COUNT(*) FILTER (WHERE status = 'FAILED' AND (
            "errorMessage" ILIKE '%131049%' OR "errorMessage" ILIKE '%frequência%' OR "errorMessage" ILIKE '%frequencia%' OR "errorMessage" ILIKE '%healthy ecosystem%'
          ))::int as "frequencyCapped",
          COUNT(*) FILTER (WHERE status = 'FAILED' AND (
            "errorMessage" ILIKE '%130472%' OR "errorMessage" ILIKE '%experiment%' OR "errorMessage" ILIKE '%experimento%'
          ))::int as "metaExperiment"
        FROM "Message"
        WHERE "accountId" = $1
          AND direction = 'OUTGOING'
          AND "messageType" = 'TEMPLATE'
          AND "createdAt" >= $2 AND "createdAt" <= $3
      `, accountId, start, end),

      // 2. Gráfico diário de mensagens de saída agrupado por dia (Horário de Brasília)
      prisma.$queryRawUnsafe<any[]>(`
        SELECT
          TO_CHAR("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as day,
          COUNT(*) FILTER (WHERE status IN ('SENT', 'DELIVERED', 'READ'))::int as sent,
          COUNT(*) FILTER (WHERE status = 'READ')::int as read,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed
        FROM "Message"
        WHERE "accountId" = $1
          AND direction = 'OUTGOING'
          AND "messageType" = 'TEMPLATE'
          AND "createdAt" >= $2 AND "createdAt" <= $3
        GROUP BY 1
        ORDER BY 1 ASC
      `, accountId, start, end),

      // 3. Respostas diárias recebidas
      prisma.$queryRawUnsafe<any[]>(`
        SELECT
          TO_CHAR("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as day,
          COUNT(*)::int as replies
        FROM "Message"
        WHERE "accountId" = $1
          AND direction = 'INCOMING'
          AND "createdAt" >= $2 AND "createdAt" <= $3
        GROUP BY 1
        ORDER BY 1 ASC
      `, accountId, start, end),

      // 4. Totais de respostas e contatos únicos que responderam
      prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int as "totalReplies",
          COUNT(DISTINCT "to")::int as "uniqueReplies"
        FROM "Message"
        WHERE "accountId" = $1
          AND direction = 'INCOMING'
          AND "createdAt" >= $2 AND "createdAt" <= $3
      `, accountId, start, end),

      // 5. Métricas agrupadas por template
      prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COALESCE("templateName", 'Envio Direto') as "templateName",
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE status IN ('SENT', 'DELIVERED', 'READ'))::int as sent,
          COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ'))::int as delivered,
          COUNT(*) FILTER (WHERE status = 'READ')::int as read,
          COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed
        FROM "Message"
        WHERE "accountId" = $1
          AND direction = 'OUTGOING'
          AND "messageType" = 'TEMPLATE'
          AND "createdAt" >= $2 AND "createdAt" <= $3
        GROUP BY COALESCE("templateName", 'Envio Direto')
        ORDER BY total DESC
      `, accountId, start, end),

      // 6. Contagem de opt-outs no período
      prisma.optOut.count({
        where: {
          accountId,
          createdAt: {
            gte: start,
            lte: end
          }
        }
      })
    ]);

    // Totais e diagnósticos
    const total = totalsResult[0]?.total || 0;
    const sent = totalsResult[0]?.sent || 0;
    const delivered = totalsResult[0]?.delivered || 0;
    const read = totalsResult[0]?.read || 0;
    const failed = totalsResult[0]?.failed || 0;
    const invalidNumbers = totalsResult[0]?.invalidNumbers || 0;
    const frequencyCapped = totalsResult[0]?.frequencyCapped || 0;
    const metaExperiment = totalsResult[0]?.metaExperiment || 0;
    const otherFailures = Math.max(0, failed - (invalidNumbers + frequencyCapped + metaExperiment));

    const validBase = Math.max(0, total - invalidNumbers);
    const validDeliveryRate = validBase > 0 ? Math.round((delivered / validBase) * 100) : 0;
    const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const readRate = total > 0 ? Math.round((read / total) * 100) : 0;

    // Respostas recebidas e taxa de conversão/engajamento
    const totalReplies = incomingOverallResult[0]?.totalReplies || 0;
    const uniqueRepliedPhones = incomingOverallResult[0]?.uniqueReplies || 0;
    const responseRate = delivered > 0 ? Math.round((uniqueRepliedPhones / delivered) * 100) : 0;
    const optOutRate = delivered > 0 ? Number(((optOutsCount / delivered) * 100).toFixed(2)) : 0;

    // Inicializar o mapa de dias para garantir que datas sem envios apareçam no gráfico com zero
    const dailyMap = new Map<string, { date: string; sent: number; read: number; failed: number; replies: number }>();
    const current = new Date(start);
    while (current.getTime() <= end.getTime()) {
      const dateStr = formatDateLocal(current);
      dailyMap.set(dateStr, { date: dateStr, sent: 0, read: 0, failed: 0, replies: 0 });
      current.setDate(current.getDate() + 1);
    }

    for (const d of dailyOutgoingResult) {
      const item = dailyMap.get(d.day);
      if (item) {
        item.sent = d.sent || 0;
        item.read = d.read || 0;
        item.failed = d.failed || 0;
      }
    }

    for (const d of dailyIncomingResult) {
      const item = dailyMap.get(d.day);
      if (item) {
        item.replies = d.replies || 0;
      }
    }

    const chartData = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Formatar métricas por template
    const templateMetrics = templateMetricsResult.map((t: any) => ({
      templateName: t.templateName,
      sent: t.sent || 0,
      delivered: t.delivered || 0,
      read: t.read || 0,
      failed: t.failed || 0,
      total: t.total || 0,
      readRate: t.delivered > 0 ? Math.round((t.read / t.delivered) * 100) : 0,
    }));

    // Cálculo detalhado de custos oficiais Meta e projeção de cobrança
    const financialMetrics = await getAccountFinancialMetrics(accountId, start, end).catch((err) => {
      console.error("[Pricing] Erro ao calcular métricas financeiras:", err.message);
      return null;
    });

    res.json({
      totals: {
        sent,
        delivered,
        read,
        failed,
        total,
        replies: totalReplies,
        uniqueReplies: uniqueRepliedPhones,
        responseRate,
        validBase,
        validDeliveryRate,
        deliveryRate,
        readRate,
        optOuts: optOutsCount,
        optOutRate,
      },
      failureDiagnosis: {
        invalidNumbers,
        frequencyCapped,
        metaExperiment,
        other: otherFailures,
      },
      chartData,
      templateMetrics,
      costs: financialMetrics
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter custos e previsão de cobrança detalhada (Meta WhatsApp Cloud API)
router.get("/accounts/:accountId/costs", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { startDate: queryStart, endDate: queryEnd, exchangeRate } = req.query;

  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado" });

    const now = new Date();
    const start = queryStart ? new Date(queryStart as string) : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = queryEnd ? new Date(queryEnd as string) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const parsedRate = exchangeRate ? parseFloat(exchangeRate as string) : undefined;

    const costs = await getAccountFinancialMetrics(accountId, start, end, parsedRate);
    res.json(costs);
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
