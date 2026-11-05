/**
 * Rotas da API pública usadas pelo agente de IA (autenticação por chave sk_...,
 * montadas dentro de publicApiRoutes, que já aplica a chave e o rate limit).
 * Especificação: docs/integracao-agente-ia.md
 */
import { Router, Response } from "express";
import { prisma } from "../db";
import { ApiKeyRequest } from "../middlewares/apiKeyAuth";
import { decryptToken } from "../utils/crypto";
import { messageEventEmitter } from "../utils/emitter";
import { metaService } from "../services/metaService";
import { normalizePhone, phoneVariants } from "../services/phoneService";
import {
  agentPauseExpiresAt,
  buildEventEnvelope,
  findCampaignOrigin,
  getAgentConfig,
  isAgentPauseActive,
  lastIncomingAt,
  notifyAgentOfHandover,
  windowExpiresAt,
} from "../services/agentService";

const router = Router();

export const AGENT_SENDER_NAME = "Agente IA";
const MAX_TEXT = 4096;
const VALID_PHONE = /^\d{10,15}$/;

async function loadAccount(accountId: string) {
  return prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, phoneNumberId: true, accessToken: true },
  });
}

function contactWhere(accountId: string, phone: string) {
  return { accountId, phone: { in: phoneVariants(phone) } };
}

/**
 * Valida o corpo de POST /messages/text. Retorna o erro (string) ou os dados normalizados.
 * Botões: até 3, título até 20 caracteres e id até 256 (limites da Meta).
 */
export function parseTextMessageBody(body: any):
  | { error: string }
  | { to: string; text: string; buttons: Array<{ id: string; title: string }> | null; replyToWamid: string | null } {
  const to = normalizePhone(String(body?.to ?? ""));
  if (!VALID_PHONE.test(to)) return { error: "Campo 'to' inválido. Use o formato internacional (ex: 5583999999999)." };
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return { error: "Campo 'text' é obrigatório." };
  if (text.length > (body?.buttons ? 1024 : MAX_TEXT)) {
    return { error: `Texto longo demais (máximo ${body?.buttons ? 1024 : MAX_TEXT} caracteres${body?.buttons ? " com botões" : ""}).` };
  }
  let buttons: Array<{ id: string; title: string }> | null = null;
  if (body?.buttons !== undefined && body?.buttons !== null) {
    if (!Array.isArray(body.buttons) || body.buttons.length < 1 || body.buttons.length > 3) {
      return { error: "'buttons' deve ter de 1 a 3 itens." };
    }
    buttons = [];
    for (const [i, b] of body.buttons.entries()) {
      const title = typeof b?.title === "string" ? b.title.trim() : "";
      const id = typeof b?.id === "string" && b.id.trim() ? b.id.trim() : `btn_${i + 1}`;
      if (!title || title.length > 20) return { error: `Botão ${i + 1}: 'title' obrigatório, até 20 caracteres.` };
      if (id.length > 256) return { error: `Botão ${i + 1}: 'id' com até 256 caracteres.` };
      buttons.push({ id, title });
    }
  }
  const replyToWamid = typeof body?.replyToWamid === "string" && body.replyToWamid ? body.replyToWamid : null;
  return { to, text, buttons, replyToWamid };
}

/**
 * POST /api/v1/messages/text
 * Resposta do agente dentro da janela de 24h. Body: { to, text, buttons?, replyToWamid? }
 */
router.post("/messages/text", async (req: ApiKeyRequest, res: Response) => {
  const accountId = req.accountId!;
  const parsed = parseTextMessageBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error, code: "INVALID_BODY" });
  const { to, text, buttons, replyToWamid } = parsed;

  try {
    const account = await loadAccount(accountId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });

    const [optOut, contact, lastIn] = await Promise.all([
      prisma.optOut.findUnique({ where: { phone_accountId: { phone: to, accountId } }, select: { id: true } }),
      prisma.whatsAppContact.findFirst({
        where: contactWhere(accountId, to),
        select: { blacklisted: true, agentPaused: true, agentPausedAt: true, agentPausedBy: true },
      }),
      lastIncomingAt(accountId, to),
    ]);

    if (optOut) return res.status(422).json({ error: "Este número está na lista de opt-out.", code: "OPT_OUT" });
    if (contact?.blacklisted) return res.status(422).json({ error: "Contato na lista negra.", code: "BLACKLISTED" });
    if (isAgentPauseActive(contact)) {
      return res.status(409).json({
        error: "Um atendente humano assumiu esta conversa. O agente não deve responder.",
        code: "HUMAN_HANDOVER",
        pausedBy: contact?.agentPausedBy ?? null,
        resumesAt: agentPauseExpiresAt(contact?.agentPausedAt)?.toISOString() ?? null,
      });
    }
    const windowEnd = windowExpiresAt(lastIn);
    if (!windowEnd || windowEnd.getTime() <= Date.now()) {
      return res.status(422).json({
        error: "Fora da janela de 24h do WhatsApp: só é possível enviar template (POST /api/v1/send).",
        code: "OUTSIDE_WINDOW",
        lastIncomingAt: lastIn?.toISOString() ?? null,
      });
    }

    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      ...(replyToWamid ? { context: { message_id: replyToWamid } } : {}),
      ...(buttons
        ? {
            type: "interactive",
            interactive: {
              type: "button",
              body: { text },
              action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
            },
          }
        : { type: "text", text: { preview_url: false, body: text } }),
    };

    let wamid: string | undefined;
    try {
      const response = await metaService.sendMessage(account.phoneNumberId, decryptToken(account.accessToken), payload);
      wamid = response.data?.messages?.[0]?.id;
    } catch (err: any) {
      const metaError = err.response?.data?.error;
      const code = metaError?.code;
      console.error(`[AgentAPI] Meta recusou mensagem para ${to}:`, metaError || err.message);
      return res.status(code === 131047 ? 422 : 502).json({
        error: metaError?.message || err.message,
        code: code === 131047 ? "OUTSIDE_WINDOW" : "META_ERROR",
        metaCode: code ?? null,
        details: metaError?.error_data?.details ?? null,
      });
    }

    const saved = await prisma.message.create({
      data: {
        accountId,
        wamid,
        to,
        status: "SENT",
        direction: "OUTGOING",
        messageType: buttons ? "INTERACTIVE" : "TEXT",
        body: text,
        variables: buttons ? ({ buttons } as any) : undefined,
        sentByUserName: AGENT_SENDER_NAME,
      },
    });

    // Conversa atendida pela IA: sai da fila "Aguardando resposta" do Live Chat
    await prisma.whatsAppContact
      .upsert({
        where: { accountId_phone: { accountId, phone: to } },
        update: { isHandled: true },
        create: { accountId, phone: to, isHandled: true },
      })
      .catch(() => {});

    messageEventEmitter.emit("messageUpdated", {
      accountId,
      messageId: saved.id,
      status: saved.status,
      direction: saved.direction,
      body: saved.body,
      to: saved.to,
      messageType: saved.messageType,
      wamid: saved.wamid,
      updatedAt: saved.updatedAt,
      variables: saved.variables,
      sentByUserName: AGENT_SENDER_NAME,
      isHandled: true,
    });

    res.status(201).json({ id: saved.id, wamid: saved.wamid, to: saved.to, status: saved.status, createdAt: saved.createdAt });
  } catch (error: any) {
    console.error("[AgentAPI] Erro em /messages/text:", error.message);
    res.status(500).json({ error: "Erro interno ao enviar a mensagem." });
  }
});

/**
 * GET /api/v1/media/:mediaId
 * Baixa a mídia recebida (áudio, imagem, documento) para transcrição/análise.
 */
router.get("/media/:mediaId", async (req: ApiKeyRequest, res: Response) => {
  const accountId = req.accountId!;
  const { mediaId } = req.params;
  if (!/^\d{5,30}$/.test(mediaId)) return res.status(400).json({ error: "mediaId inválido." });

  try {
    // Só serve mídia que chegou nesta conta (o id da Meta não é segredo suficiente)
    const owned = await prisma.message.findFirst({
      where: { accountId, direction: "INCOMING", mediaUrl: mediaId },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ error: "Mídia não encontrada nesta conta." });

    const account = await loadAccount(accountId);
    if (!account) return res.status(404).json({ error: "Conta não encontrada." });
    const token = decryptToken(account.accessToken);
    const meta = await metaService.getMediaUrl(mediaId, token);
    const url: string | undefined = meta.data?.url;
    if (!url) return res.status(404).json({ error: "Mídia expirada ou indisponível na Meta." });
    const media = await metaService.getMediaBuffer(url, token);
    const buffer = Buffer.from(media.data);
    res.setHeader("Content-Type", meta.data?.mime_type || "application/octet-stream");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.end(buffer);
  } catch (error: any) {
    const status = error.response?.status;
    res.status(status === 404 || status === 400 ? 404 : 502).json({
      error: status === 404 || status === 400 ? "Mídia expirada ou indisponível na Meta." : "Falha ao baixar a mídia da Meta.",
    });
  }
});

/**
 * GET /api/v1/conversations/:phone
 * Estado da conversa: janela de 24h, pausa por atendimento humano, opt-out e campanha de origem.
 */
router.get("/conversations/:phone", async (req: ApiKeyRequest, res: Response) => {
  const accountId = req.accountId!;
  const phone = normalizePhone(req.params.phone);
  if (!VALID_PHONE.test(phone)) return res.status(400).json({ error: "Telefone inválido." });

  const [contact, optOut, lastIn, origin] = await Promise.all([
    prisma.whatsAppContact.findFirst({
      where: contactWhere(accountId, phone),
      select: { profileName: true, blacklisted: true, agentPaused: true, agentPausedAt: true, agentPausedBy: true },
    }),
    prisma.optOut.findUnique({ where: { phone_accountId: { phone, accountId } }, select: { reason: true } }),
    lastIncomingAt(accountId, phone),
    findCampaignOrigin(accountId, phone),
  ]);
  const windowEnd = windowExpiresAt(lastIn);
  const paused = isAgentPauseActive(contact);

  res.json({
    phone,
    name: contact?.profileName ?? null,
    optedOut: Boolean(optOut),
    blacklisted: Boolean(contact?.blacklisted),
    agentPaused: paused,
    pausedBy: paused ? contact?.agentPausedBy ?? null : null,
    resumesAt: paused ? agentPauseExpiresAt(contact?.agentPausedAt)?.toISOString() ?? null : null,
    lastIncomingAt: lastIn?.toISOString() ?? null,
    windowOpen: Boolean(windowEnd && windowEnd.getTime() > Date.now()),
    windowExpiresAt: windowEnd?.toISOString() ?? null,
    origin,
  });
});

/**
 * GET /api/v1/conversations/:phone/messages?limit=30
 * Últimas mensagens da conversa (mais antigas primeiro), para contexto do agente.
 */
router.get("/conversations/:phone/messages", async (req: ApiKeyRequest, res: Response) => {
  const accountId = req.accountId!;
  const phone = normalizePhone(req.params.phone);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "30"), 10) || 30, 1), 100);

  const messages = await prisma.message.findMany({
    where: { accountId, to: { in: phoneVariants(phone) } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, wamid: true, direction: true, messageType: true, body: true, mediaUrl: true,
      status: true, templateName: true, sentByUserName: true, createdAt: true,
    },
  });

  res.json(
    messages.reverse().map((m) => ({
      id: m.id,
      wamid: m.wamid,
      direction: m.direction,
      type: m.messageType.toLowerCase(),
      text: m.body,
      mediaId: m.direction === "INCOMING" ? m.mediaUrl : null,
      templateName: m.templateName,
      status: m.status,
      sentBy: m.direction === "OUTGOING" ? m.sentByUserName ?? (m.templateName ? "campanha/template" : null) : null,
      createdAt: m.createdAt,
    }))
  );
});

/**
 * POST /api/v1/conversations/:phone/handover
 * O agente pede um humano: pausa o agente para o contato e devolve a conversa
 * para "Aguardando resposta" no Live Chat. Body: { reason? }
 */
router.post("/conversations/:phone/handover", async (req: ApiKeyRequest, res: Response) => {
  const accountId = req.accountId!;
  const phone = normalizePhone(req.params.phone);
  if (!VALID_PHONE.test(phone)) return res.status(400).json({ error: "Telefone inválido." });
  const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : null;
  const pausedAt = new Date();

  await prisma.whatsAppContact.upsert({
    where: { accountId_phone: { accountId, phone } },
    update: { agentPaused: true, agentPausedAt: pausedAt, agentPausedBy: "agente", isHandled: false },
    create: { accountId, phone, agentPaused: true, agentPausedAt: pausedAt, agentPausedBy: "agente", isHandled: false },
  });

  messageEventEmitter.emit("messageUpdated", {
    type: "conversationStatusChanged",
    accountId,
    to: phone,
    isHandled: false,
    agentPaused: true,
    agentHandoverReason: reason,
    updatedAt: pausedAt.toISOString(),
  });
  notifyAgentOfHandover(accountId, phone, { by: "agent", reason, pausedAt }).catch(() => {});
  console.log(`[AgentAPI] Agente pediu atendimento humano para ${phone}${reason ? ` — ${reason}` : ""}.`);

  res.json({ phone, agentPaused: true, resumesAt: agentPauseExpiresAt(pausedAt)?.toISOString() ?? null });
});

/**
 * GET /api/v1/events?after=<seq>&limit=50
 * Leitura dos eventos para quem não recebe webhook (ex.: agente rodando localmente).
 * Guarde o maior `seq` recebido e passe em `after` na próxima chamada. Eventos ficam 7 dias.
 */
router.get("/events", async (req: ApiKeyRequest, res: Response) => {
  const accountId = req.accountId!;
  const after = Math.max(parseInt(String(req.query.after ?? "0"), 10) || 0, 0);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);

  const cfg = await getAgentConfig(accountId);
  if (!cfg.enabled) {
    return res.status(409).json({ error: "Integração com agente desativada nesta conta.", code: "AGENT_DISABLED" });
  }

  const events = await prisma.agentEvent.findMany({
    where: { accountId, seq: { gt: after } },
    orderBy: { seq: "asc" },
    take: limit,
    select: { id: true, seq: true, type: true, payload: true, createdAt: true },
  });
  res.json({
    events: events.map(buildEventEnvelope),
    nextAfter: events.length ? events[events.length - 1].seq : after,
    hasMore: events.length === limit,
  });
});

export default router;
