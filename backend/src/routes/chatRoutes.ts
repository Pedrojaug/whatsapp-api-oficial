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
  isHandled: boolean;
}

// Monta a lista de conversas (última mensagem por contato + agregados de status),
// otimizada em uma única passada SQL no PostgreSQL (50% menos I/O e queries).
async function buildConversations(accountId: string, dateRange: { start: Date; end: Date } | null): Promise<ConversationRow[]> {
  const params: any[] = [accountId];
  let dateClause = "";
  if (dateRange) {
    params.push(dateRange.start, dateRange.end);
    dateClause = ` AND "createdAt" >= $2 AND "createdAt" <= $3`;
  }

  // 1. Consulta única com agregação e extração da última mensagem via array_agg
  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      "to" as phone,
      (array_agg(body ORDER BY "createdAt" DESC))[1] as body,
      (array_agg("templateName" ORDER BY "createdAt" DESC))[1] as "templateName",
      (array_agg(status ORDER BY "createdAt" DESC))[1] as status,
      (array_agg(direction ORDER BY "createdAt" DESC))[1] as direction,
      (array_agg("messageType" ORDER BY "createdAt" DESC))[1] as "messageType",
      MAX("createdAt") as "createdAt",
      bool_or(direction = 'INCOMING') as "hasIncoming",
      bool_or(status = 'FAILED') as "hasFailed",
      bool_or(status = 'DELIVERED') as "hasDelivered",
      bool_or(status = 'READ') as "hasRead"
    FROM "Message"
    WHERE "accountId" = $1${dateClause}
    GROUP BY "to"
  `, ...params);

  // 2. Buscar contatos para resolver profileName, blacklist e status de atendimento (isHandled)
  const contacts = await prisma.whatsAppContact.findMany({
    where: { accountId },
    select: { phone: true, profileName: true, blacklisted: true, isHandled: true }
  });
  const contactMap = new Map();
  for (const c of contacts) {
    contactMap.set(c.phone, c);
    contactMap.set(normalizePhone(c.phone), c);
  }
  const blacklistedSet = new Set(contacts.filter((c: any) => c.blacklisted).map((c: any) => normalizePhone(c.phone)));

  // 3. Consolidar por telefone normalizado (unifica variantes de 9º dígito)
  const convMap = new Map<string, ConversationRow>();

  for (const row of rows) {
    const normalizedKey = normalizePhone(row.phone);
    const existing = convMap.get(normalizedKey);
    const isNewer = !existing || new Date(row.createdAt).getTime() > new Date(existing.updatedAt).getTime();
    const contactInfo = contactMap.get(normalizedKey);

    if (!existing) {
      convMap.set(normalizedKey, {
        phone: normalizedKey,
        profileName: contactInfo?.profileName || null,
        lastMessage: row.body || (row.templateName ? `Template: ${row.templateName}` : "Mídia"),
        updatedAt: row.createdAt,
        status: row.status,
        direction: row.direction,
        messageType: row.messageType,
        hasIncoming: Boolean(row.hasIncoming),
        hasFailed: Boolean(row.hasFailed),
        hasDelivered: Boolean(row.hasDelivered),
        hasRead: Boolean(row.hasRead),
        isHandled: Boolean(contactInfo?.isHandled),
      });
    } else {
      if (isNewer) {
        existing.lastMessage = row.body || (row.templateName ? `Template: ${row.templateName}` : "Mídia");
        existing.updatedAt = row.createdAt;
        existing.status = row.status;
        existing.direction = row.direction;
        existing.messageType = row.messageType;
      }
      existing.hasIncoming = existing.hasIncoming || Boolean(row.hasIncoming);
      existing.hasFailed = existing.hasFailed || Boolean(row.hasFailed);
      existing.hasDelivered = existing.hasDelivered || Boolean(row.hasDelivered);
      existing.hasRead = existing.hasRead || Boolean(row.hasRead);
      if (contactInfo?.isHandled !== undefined) {
        existing.isHandled = Boolean(contactInfo.isHandled);
      }
    }
  }

  // Oculta contatos na Lista Negra por padrão e ordena pelas interações mais recentes
  const visible = Array.from(convMap.values()).filter((c) => !blacklistedSet.has(c.phone));
  visible.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return visible;
}

// Filtro de status equivalente ao matchesConvFilter do frontend.
function matchesConvFilter(c: ConversationRow, filter: string): boolean {
  switch (filter) {
    case "UNANSWERED":
    case "PENDING":
    case "UNREAD":
      return c.direction === "INCOMING" && !c.isHandled;
    case "ANSWERED":
      return (!!c.hasIncoming && c.direction === "OUTGOING") || (c.direction === "INCOMING" && c.isHandled);
    case "HANDLED":
      return c.isHandled;
    case "REPLIED": return !!c.hasIncoming;
    case "READ": return !!c.hasRead;
    case "DELIVERED": return !!c.hasDelivered || !!c.hasRead || !!c.hasIncoming;
    case "UNDELIVERED": return !c.hasDelivered && !c.hasRead && !c.hasIncoming && !c.hasFailed;
    case "FAILED": return !!c.hasFailed;
    default: return true;
  }
}

function conversationStatusLabel(c: ConversationRow): string {
  if (c.direction === "INCOMING" && !c.isHandled) return "Aguardando Resposta";
  if (c.isHandled) return "Concluída / Atendida";
  if (c.hasIncoming && c.direction === "OUTGOING") return "Atendida";
  if (c.hasIncoming) return "Respondeu";
  if (c.hasRead) return "Lida";
  if (c.hasDelivered) return "Entregue";
  if (c.hasFailed) return "Falhou";
  return "Enviada";
}

function csvCell(v: any): string {
  let s = String(v ?? "");
  // Prevenção contra CSV Injection / Formula Injection no Excel/Sheets (CWE-1236)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Obter a lista de conversas ativas (scoped to user) - OTIMIZADO
router.get("/accounts/:accountId/conversations", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const account = await findAccountForUser(accountId, userId);
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

// Alterar status de atendimento (Atendida/Concluída vs Aguardando) e emitir broadcast SSE
router.patch("/accounts/:accountId/conversations/:phone/handled", async (req: Request, res: Response) => {
  const { accountId, phone } = req.params;
  const { isHandled } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  try {
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const normalized = normalizePhone(phone);
    const updated = await (prisma as any).whatsAppContact.upsert({
      where: {
        accountId_phone: {
          accountId,
          phone: normalized,
        }
      },
      update: {
        isHandled: Boolean(isHandled),
      },
      create: {
        accountId,
        phone: normalized,
        isHandled: Boolean(isHandled),
      }
    });

    if (phone !== normalized) {
      await (prisma as any).whatsAppContact.upsert({
        where: { accountId_phone: { accountId, phone } },
        update: { isHandled: Boolean(isHandled) },
        create: { accountId, phone, isHandled: Boolean(isHandled) },
      }).catch(() => {});
    }

    // Emitir broadcast SSE para sincronização multi-dispositivo instantânea
    messageEventEmitter.emit("messageUpdated", {
      type: "conversationStatusChanged",
      accountId,
      to: normalized,
      isHandled: updated.isHandled,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, phone: normalized, isHandled: updated.isHandled });
  } catch (error: any) {
    console.error("[Chat] Erro ao alterar status de atendimento:", error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar múltiplas conversas como atendidas/concluídas em lote e emitir broadcast SSE
router.post("/accounts/:accountId/conversations/mark-all-handled", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { phones, isHandled = true } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  if (!Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: "Lista de telefones inválida ou vazia." });
  }

  try {
    const account = await findAccountForUser(accountId, userId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });

    const allPhones = new Set<string>();
    phones.forEach((p: string) => {
      allPhones.add(p);
      allPhones.add(normalizePhone(p));
    });

    const phoneList = Array.from(allPhones);

    for (let i = 0; i < phoneList.length; i += 50) {
      const chunk = phoneList.slice(i, i + 50);
      await Promise.all(
        chunk.map((phone: string) =>
          (prisma as any).whatsAppContact.upsert({
            where: { accountId_phone: { accountId, phone } },
            update: { isHandled: Boolean(isHandled) },
            create: { accountId, phone, isHandled: Boolean(isHandled) },
          })
        )
      );
    }

    const normalizedPhones: string[] = phones.map((p: string) => normalizePhone(p));

    // Emitir broadcast SSE para todos os clientes conectados
    messageEventEmitter.emit("messageUpdated", {
      type: "batchConversationsHandled",
      accountId,
      phones: normalizedPhones,
      isHandled: Boolean(isHandled),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, count: normalizedPhones.length, isHandled: Boolean(isHandled) });
  } catch (error: any) {
    console.error("[Chat] Erro ao marcar lote como atendido:", error);
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
    const userId = (req as AuthenticatedRequest).userId;
    console.log(`[Media Proxy] Requisição de mídia recebida: conta=${accountId}, mediaId=${mediaId}, userId=${userId}`);

    let account = userId ? await findAccountForUser(accountId, userId) : null;
    if (!account) {
      account = (await prisma.account.findFirst({ where: { id: accountId } })) as any;
    }

    if (!account) {
      console.warn(`[Media Proxy] Conta não encontrada para ID: ${accountId}`);
      return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });
    }

    const token = decryptToken(account.accessToken);

    // 1. Buscar URL temporária da mídia na Meta
    console.log(`[Media Proxy] Buscando URL na Meta para mediaId: ${mediaId}...`);
    const metaRes = await metaService.getMediaUrl(mediaId, token);
    const mediaUrl: string = metaRes.data?.url;
    let mimeType: string = metaRes.data?.mime_type || "application/octet-stream";

    if (!mediaUrl) {
      console.warn(`[Media Proxy] URL de mídia vazia retornada pela Meta para mediaId: ${mediaId}`);
      return res.status(404).json({ error: "URL de mídia não encontrada na Meta." });
    }

    // Normalizar MIME type para áudio: WhatsApp envia "audio/ogg; codecs=opus".
    if (mimeType.toLowerCase().includes("audio/ogg") || mimeType.toLowerCase().includes("opus")) {
      mimeType = "audio/ogg";
    }

    // 2. Baixar o conteúdo binário e repassar ao cliente
    console.log(`[Media Proxy] Baixando buffer de mídia da Meta CDN...`);
    const mediaResData = await metaService.getMediaBuffer(mediaUrl, token);
    const buffer = Buffer.from(mediaResData.data);
    console.log(`[Media Proxy] Mídia baixada com sucesso: ${buffer.length} bytes, MIME: ${mimeType}`);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", 'inline; filename="audio.ogg"');
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Accept-Ranges", "bytes");

    // Suporte completo a HTTP Range Requests (indispensável para players de áudio)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;

      if (isNaN(start) || start >= buffer.length || end >= buffer.length || start > end) {
        res.setHeader("Content-Range", `bytes */${buffer.length}`);
        return res.status(416).end();
      }

      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${buffer.length}`);
      res.setHeader("Content-Length", chunkSize);
      return res.end(buffer.subarray(start, end + 1));
    }

    res.setHeader("Content-Length", buffer.length);
    return res.end(buffer);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const details = error.response?.data?.error?.message || error.message;
    console.error(`[Media Proxy] Erro ao buscar mídia ${mediaId} (${status}):`, details);
    res.status(status === 404 || status === 400 ? 404 : 500).json({
      error: status === 404 || status === 400
        ? "Mídia não encontrada ou expirada nos servidores da Meta (mídias de WhatsApp expiram em até 30 dias)."
        : "Não foi possível carregar a mídia.",
      details
    });
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

    // Marcar contato como atendido no banco (isHandled = true)
    await (prisma as any).whatsAppContact.upsert({
      where: {
        accountId_phone: {
          accountId,
          phone: normalizedTo,
        }
      },
      update: { isHandled: true },
      create: {
        accountId,
        phone: normalizedTo,
        isHandled: true,
      }
    }).catch((cErr: any) => console.warn("[Chat] Erro ao marcar contato como atendido no reply:", cErr));

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
      isHandled: true,
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
