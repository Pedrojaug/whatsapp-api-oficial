import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { decryptToken } from "../utils/crypto";
import { normalizePhone, phoneVariants } from "../services/phoneService";
import { metaService } from "../services/metaService";
import { findAccountForUser } from "../utils/accountAccess";
import { messageEventEmitter } from "../utils/emitter";
import axios from "axios";

const router = Router();

// Aplica autenticação a todas as rotas de chat
router.use(authMiddleware);

interface DBConversationMessage {
  phone: string;
  body: string | null;
  templateName: string | null;
  status: string;
  direction: string;
  messageType: string;
  createdAt: Date;
}

// ── Helpers de conversas (compartilhados por listagem e exportação) ──

// Janela de datas em Horário de Brasília (UTC-3) para os filtros de período.
function parseDateWindow(startDate?: string, endDate?: string): { start: Date; end: Date } | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00-03:00`);
  const end = new Date(`${endDate}T23:59:59.999-03:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

interface ConversationRow {
  phone: string;
  profileName: string | null;
  lastMessage: string;
  updatedAt: Date;
  status: string;
  direction: string;
  messageType: string;
  hasIncoming: boolean;
  hasFailed: boolean;
  hasDelivered: boolean;
  hasRead: boolean;
}

// Monta a lista de conversas (última mensagem por contato + agregados de status),
// opcionalmente restrita a uma janela de datas (atividade no período).
async function buildConversations(accountId: string, dateRange: { start: Date; end: Date } | null): Promise<ConversationRow[]> {
  const params: any[] = [accountId];
  let dateClause = "";
  if (dateRange) {
    params.push(dateRange.start, dateRange.end);
    dateClause = ` AND "createdAt" >= $2 AND "createdAt" <= $3`;
  }

  const messages: DBConversationMessage[] = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT ON ("to")
      "to" as phone, body, "templateName", status, direction, "messageType", "createdAt"
    FROM "Message"
    WHERE "accountId" = $1${dateClause}
    ORDER BY "to", "createdAt" DESC
  `, ...params);

  const aggregates: { phone: string; hasIncoming: boolean; hasFailed: boolean; hasDelivered: boolean; hasRead: boolean }[] =
    await prisma.$queryRawUnsafe(`
    SELECT
      "to" as phone,
      bool_or(direction = 'INCOMING') as "hasIncoming",
      bool_or(status = 'FAILED') as "hasFailed",
      bool_or(status = 'DELIVERED') as "hasDelivered",
      bool_or(status = 'READ') as "hasRead"
    FROM "Message"
    WHERE "accountId" = $1${dateClause}
    GROUP BY "to"
  `, ...params);

  const aggMap = new Map<string, { hasIncoming: boolean; hasFailed: boolean; hasDelivered: boolean; hasRead: boolean }>();
  for (const agg of aggregates) {
    const key = normalizePhone(agg.phone);
    const prev = aggMap.get(key);
    aggMap.set(key, {
      hasIncoming: (prev?.hasIncoming || false) || agg.hasIncoming,
      hasFailed: (prev?.hasFailed || false) || agg.hasFailed,
      hasDelivered: (prev?.hasDelivered || false) || agg.hasDelivered,
      hasRead: (prev?.hasRead || false) || agg.hasRead,
    });
  }

  const contacts = await prisma.whatsAppContact.findMany({ where: { accountId } });
  const contactMap = new Map(contacts.map((c: any) => [c.phone, c.profileName]));
  const blacklistedSet = new Set(contacts.filter((c: any) => c.blacklisted).map((c: any) => normalizePhone(c.phone)));

  const conversations: ConversationRow[] = messages.map((msg) => {
    const normalizedKey = normalizePhone(msg.phone);
    const agg = aggMap.get(normalizedKey);
    return {
      phone: normalizedKey,
      profileName: (contactMap.get(normalizedKey) as string | null) || null,
      lastMessage: msg.body || (msg.templateName ? `Template: ${msg.templateName}` : "Mídia"),
      updatedAt: msg.createdAt,
      status: msg.status,
      direction: msg.direction,
      messageType: msg.messageType,
      hasIncoming: agg?.hasIncoming || false,
      hasFailed: agg?.hasFailed || false,
      hasDelivered: agg?.hasDelivered || false,
      hasRead: agg?.hasRead || false,
    };
  });

  // Oculta contatos na Lista Negra por padrão
  const visible = conversations.filter((c) => !blacklistedSet.has(c.phone));
  visible.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return visible;
}

// Filtro de status equivalente ao matchesConvFilter do frontend.
function matchesConvFilter(c: ConversationRow, filter: string): boolean {
  switch (filter) {
    case "REPLIED": return !!c.hasIncoming;
    case "READ": return !!c.hasRead;
    case "DELIVERED": return !!c.hasDelivered || !!c.hasRead || !!c.hasIncoming;
    case "UNDELIVERED": return !c.hasDelivered && !c.hasRead && !c.hasIncoming && !c.hasFailed;
    case "FAILED": return !!c.hasFailed;
    default: return true;
  }
}

function conversationStatusLabel(c: ConversationRow): string {
  if (c.hasIncoming) return "Respondeu";
  if (c.hasRead) return "Lida";
  if (c.hasDelivered) return "Entregue";
  if (c.hasFailed) return "Falhou";
  return "Enviada";
}

function csvCell(v: any): string {
  const s = String(v ?? "");
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Obter a lista de conversas ativas (scoped to user) - OTIMIZADO
router.get("/accounts/:accountId/conversations", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const dateRange = parseDateWindow(req.query.startDate as string | undefined, req.query.endDate as string | undefined);
    const conversations = await buildConversations(accountId, dateRange);
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Exportar leads engajados em CSV (mesmos filtros de data + status da tela)
router.get("/accounts/:accountId/conversations/export", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { startDate, endDate, filter = "ALL" } = req.query;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const dateRange = parseDateWindow(startDate as string | undefined, endDate as string | undefined);
    const conversations = await buildConversations(accountId, dateRange);
    const filtered = conversations.filter((c) => matchesConvFilter(c, String(filter)));

    const lines = ["Telefone;Nome;Data da última interação;Status"];
    for (const c of filtered) {
      lines.push([
        csvCell(c.phone),
        csvCell(c.profileName || ""),
        csvCell(new Date(c.updatedAt).toLocaleString("pt-BR")),
        csvCell(conversationStatusLabel(c)),
      ].join(";"));
    }
    const csv = "\uFEFF" + lines.join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leads_${accountId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mover contato para a Lista Negra (ou remover). Também espelha no OptOut para
// que disparos futuros ignorem o contato (o dispatcher já pula opt-outs).
router.patch("/accounts/:accountId/conversations/:phone/blacklist", async (req: Request, res: Response) => {
  const { accountId, phone } = req.params;
  const { blacklisted = true } = req.body;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const normalized = normalizePhone(phone);
    const isBlack = !!blacklisted;

    await prisma.whatsAppContact.upsert({
      where: { accountId_phone: { accountId, phone: normalized } },
      update: { blacklisted: isBlack },
      create: { accountId, phone: normalized, blacklisted: isBlack },
    });

    if (isBlack) {
      await prisma.optOut.upsert({
        where: { phone_accountId: { phone: normalized, accountId } },
        update: { reason: "BLACKLIST" },
        create: { phone: normalized, accountId, reason: "BLACKLIST" },
      });
    } else {
      await prisma.optOut.deleteMany({ where: { phone: normalized, accountId, reason: "BLACKLIST" } });
    }

    res.json({ success: true, phone: normalized, blacklisted: isBlack });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter histórico de mensagens com um contato específico (scoped to user)
router.get("/accounts/:accountId/conversations/:phone/messages", async (req: Request, res: Response) => {
  const { accountId, phone } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const messages = await prisma.message.findMany({
      where: { accountId, to: { in: phoneVariants(phone) } },
      orderBy: { createdAt: "asc" }
    });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy de mídia recebida — busca o conteúdo binário da Meta e repassa ao frontend
router.get("/accounts/:accountId/media/:mediaId", async (req: Request, res: Response) => {
  const { accountId, mediaId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });

    const token = decryptToken(account.accessToken);

    // 1. Buscar URL temporária da mídia
    const metaRes = await metaService.getMediaUrl(mediaId, token);
    const mediaUrl: string = metaRes.data.url;
    const mimeType: string = metaRes.data.mime_type || "application/octet-stream";

    // 2. Baixar o conteúdo binário e repassar ao cliente (evita CORS)
    const mediaContent = await metaService.getMediaContentStream(mediaUrl, token);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "private, max-age=300");
    mediaContent.data.pipe(res);
  } catch (error: any) {
    console.error("[Media Proxy] Erro ao buscar mídia:", error.response?.data || error.message);
    res.status(500).json({ error: "Não foi possível carregar a mídia." });
  }
});

// Enviar mensagem de texto livre / resposta para um contato (scoped to user)
router.post("/accounts/:accountId/messages/reply", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { to, body, variables } = req.body;

  if (!to || !body) {
    return res.status(400).json({ error: "Telefone (to) e mensagem (body) são obrigatórios." });
  }

  const normalizedTo = normalizePhone(to);

  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId }
    });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    // Descriptografar o token de acesso da Meta
    const decryptedToken = decryptToken(account.accessToken);

    // Enviar mensagem de texto livre via API da Meta
    const response = await metaService.sendMessage(account.phoneNumberId, decryptedToken, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizedTo,
      type: "text",
      text: {
        preview_url: false,
        body: body
      }
    });

    const wamid = response.data.messages?.[0]?.id;

    // Gravar no banco de dados local como OUTGOING
    const savedMsg = await prisma.message.create({
      data: {
        accountId,
        wamid,
        to: normalizedTo,
        status: "SENT",
        direction: "OUTGOING",
        messageType: "TEXT",
        body,
        variables: variables || null,
      }
    });

    console.log(`[Chat] Resposta enviada com sucesso para ${normalizedTo}. Wamid: ${wamid}`);

    // Encaminhar resposta humana manual para o n8n para pausar o robô (takeover humano)
    const n8nWebhookUrl = process.env.N8N_SDR_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      // Ignorar se a mensagem foi disparada de forma automatizada (ex: pelo próprio SDR n8n)
      const isSdrDisparo = variables && (variables as any).sentBy === "SDR";
      
      if (!isSdrDisparo) {
        const n8nPayload = {
          event: "on-message",
          type: "text",
          from: normalizedTo,
          to: normalizedTo,
          destiny: account.phoneNumberId,
          isgroup: false,
          isGroupMsg: false,
          fromMe: true,
          id: wamid,
          content: body,
          login_atendente: "human", // sinaliza atendimento humano
        };

        console.log(`[Webhook Forward Outgoing] Encaminhando resposta de atendente humana para n8n: ${n8nWebhookUrl}`);
        axios.post(n8nWebhookUrl, n8nPayload).catch(err => {
          console.error("[Webhook Forward Outgoing] Falha ao encaminhar resposta para n8n:", err.message);
        });
      }
    }

    // Emitir evento em tempo real via SSE
    messageEventEmitter.emit("messageUpdated", {
      accountId: savedMsg.accountId,
      messageId: savedMsg.id,
      status: savedMsg.status,
      direction: savedMsg.direction,
      body: savedMsg.body,
      to: savedMsg.to,
      messageType: savedMsg.messageType,
      wamid: savedMsg.wamid,
      errorMessage: savedMsg.errorMessage,
      updatedAt: savedMsg.updatedAt,
      variables: savedMsg.variables,
    });

    res.status(201).json(savedMsg);
  } catch (error: any) {
    console.error(`[Chat] Erro ao enviar resposta para ${to}:`, error.response?.data || error.message);
    const metaError = error.response?.data?.error;
    const errMsg = metaError ? `Erro da Meta: ${metaError.message}` : error.message;
    res.status(error.response?.status || 500).json({ error: errMsg });
  }
});

export default router;
