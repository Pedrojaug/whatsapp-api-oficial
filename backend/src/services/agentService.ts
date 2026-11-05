/**
 * Integração com agente de IA externo (ex.: agente de vendas em Python).
 *
 * O Send continua sendo o dono do número na Meta: recebe o webhook, grava a
 * conversa, cuida de opt-out e do Live Chat. Para cada mensagem recebida, gera
 * um evento na tabela AgentEvent, que o agente recebe por webhook assinado
 * (HMAC) ou busca em GET /api/v1/events. O agente responde pela API pública.
 *
 * Especificação para o time do agente: docs/integracao-agente-ia.md
 */
import crypto from "crypto";
import { prisma } from "../db";
import { decryptToken } from "../utils/crypto";
import { phoneVariants } from "./phoneService";

export const AGENT_EVENT_VERSION = 1;

/** Janela de atendimento da Meta para mensagens livres (texto, botões). */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Depois desse tempo sem um atendente responder, o agente volta a atender o contato sozinho. */
export function agentPauseMs() {
  const hours = Number(process.env.AGENT_PAUSE_HOURS || 24);
  return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;
}

// ── Assinatura ────────────────────────────────────────────────────────────────

/**
 * Assinatura enviada em X-Send-Signature: "sha256=" + HMAC_SHA256(segredo, `${timestamp}.${corpo}`).
 * O timestamp (X-Send-Timestamp, em segundos) entra na conta para impedir reenvio de eventos antigos.
 */
export function signAgentPayload(secret: string, timestamp: number, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function generateAgentSecret(): string {
  return "whsec_" + crypto.randomBytes(32).toString("base64url");
}

// ── Validação da URL do agente ────────────────────────────────────────────────

const PRIVATE_HOST = [
  /^localhost$/i,
  /\.localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^\[?fe80:/i,
  /\.internal$/i,
  /\.local$/i,
];

/**
 * O servidor do Send faz POST nessa URL, então ela precisa ser pública e HTTPS:
 * bloqueia endereços internos (evita usar o Send para alcançar a rede do Render).
 * Retorna a mensagem de erro, ou null se a URL é aceitável.
 */
export function validateAgentWebhookUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "URL inválida.";
  }
  if (url.protocol !== "https:") return "Use uma URL HTTPS (ex.: https://agente.suaempresa.com.br/webhooks/send).";
  if (url.username || url.password) return "Não inclua usuário e senha na URL.";
  const host = url.hostname;
  if (PRIVATE_HOST.some((re) => re.test(host))) {
    return "A URL precisa ser pública. Para testar com o agente rodando localmente, deixe o campo vazio e use GET /api/v1/events.";
  }
  return null;
}

// ── Configuração da conta (cache curto) ───────────────────────────────────────

export interface AgentConfig {
  enabled: boolean;
  webhookUrl: string | null;
  secret: string | null;
}

const CONFIG_TTL_MS = 30_000;
const configCache = new Map<string, { value: AgentConfig; expiresAt: number }>();

export async function getAgentConfig(accountId: string): Promise<AgentConfig> {
  const now = Date.now();
  const cached = configCache.get(accountId);
  if (cached && cached.expiresAt > now) return cached.value;

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { agentEnabled: true, agentWebhookUrl: true, agentWebhookSecret: true },
  });
  let secret: string | null = null;
  if (account?.agentWebhookSecret) {
    try {
      secret = decryptToken(account.agentWebhookSecret);
    } catch {
      secret = null;
    }
  }
  const value: AgentConfig = {
    enabled: Boolean(account?.agentEnabled),
    webhookUrl: account?.agentWebhookUrl || null,
    secret,
  };
  configCache.set(accountId, { value, expiresAt: now + CONFIG_TTL_MS });
  return value;
}

export function invalidateAgentConfig(accountId: string) {
  configCache.delete(accountId);
}

// ── Pausa (atendimento humano) ────────────────────────────────────────────────

export function isAgentPauseActive(
  contact: { agentPaused?: boolean | null; agentPausedAt?: Date | null } | null | undefined,
  now = new Date()
): boolean {
  if (!contact?.agentPaused) return false;
  if (!contact.agentPausedAt) return true;
  return now.getTime() - contact.agentPausedAt.getTime() < agentPauseMs();
}

export function agentPauseExpiresAt(pausedAt: Date | null | undefined): Date | null {
  return pausedAt ? new Date(pausedAt.getTime() + agentPauseMs()) : null;
}

// ── Contexto da conversa ──────────────────────────────────────────────────────

export interface CampaignOrigin {
  campaignId: string;
  campaignName: string | null;
  templateName: string | null;
  sentAt: string;
}

/** Última campanha que enviou mensagem para este telefone nos últimos 30 dias (de onde o lead veio). */
export async function findCampaignOrigin(accountId: string, phone: string): Promise<CampaignOrigin | null> {
  const msg = await prisma.message.findFirst({
    where: {
      accountId,
      to: { in: phoneVariants(phone) },
      direction: "OUTGOING",
      campaignId: { not: null },
      createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { campaignId: true, templateName: true, createdAt: true },
  });
  if (!msg?.campaignId) return null;
  const campaign = await prisma.campaign.findUnique({ where: { id: msg.campaignId }, select: { name: true } });
  return {
    campaignId: msg.campaignId,
    campaignName: campaign?.name ?? null,
    templateName: msg.templateName,
    sentAt: msg.createdAt.toISOString(),
  };
}

/** Data/hora da última mensagem recebida do contato (abre a janela de 24h da Meta). */
export async function lastIncomingAt(accountId: string, phone: string): Promise<Date | null> {
  const msg = await prisma.message.findFirst({
    where: { accountId, to: { in: phoneVariants(phone) }, direction: "INCOMING" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return msg?.createdAt ?? null;
}

export function windowExpiresAt(lastIncoming: Date | null): Date | null {
  return lastIncoming ? new Date(lastIncoming.getTime() + SERVICE_WINDOW_MS) : null;
}

// ── Eventos ───────────────────────────────────────────────────────────────────

export interface IncomingForAgent {
  account: { id: string; name: string; phoneNumberId: string };
  message: { id: string; wamid: string | null; type: string; text: string | null; mediaId: string | null; receivedAt: Date };
  raw?: any; // objeto da mensagem como veio da Meta
  contact: { phone: string; name: string | null; optedOut: boolean };
  origin: CampaignOrigin | null;
}

/** Monta o payload de message.received (formato documentado em docs/integracao-agente-ia.md). */
export function buildMessageReceivedPayload(input: IncomingForAgent) {
  const raw = input.raw || {};
  const type = String(input.message.type || "").toLowerCase();
  const button =
    type === "button"
      ? { text: raw.button?.text ?? null, payload: raw.button?.payload ?? null }
      : type === "interactive"
        ? {
            text: raw.interactive?.button_reply?.title ?? raw.interactive?.list_reply?.title ?? null,
            payload: raw.interactive?.button_reply?.id ?? raw.interactive?.list_reply?.id ?? null,
          }
        : null;
  const mimeType = input.message.mediaId ? raw[type]?.mime_type ?? null : null;

  return {
    account: input.account,
    contact: input.contact,
    message: {
      id: input.message.id,
      wamid: input.message.wamid,
      type,
      text: input.message.text,
      button,
      mediaId: input.message.mediaId,
      mimeType,
      replyToWamid: raw.context?.id ?? null,
      // Quando o lead enviou, segundo a Meta (precisão de segundos). Use para ordenar rajadas.
      sentAt: /^\d+$/.test(String(raw.timestamp ?? "")) ? new Date(Number(raw.timestamp) * 1000).toISOString() : null,
      receivedAt: input.message.receivedAt.toISOString(),
    },
    origin: input.origin,
    conversation: {
      windowExpiresAt: new Date(input.message.receivedAt.getTime() + SERVICE_WINDOW_MS).toISOString(),
    },
  };
}

/**
 * Grava o evento na fila. Com URL configurada fica PENDING (o worker entrega por
 * webhook); sem URL fica PULL (o agente busca em GET /api/v1/events).
 */
export async function enqueueAgentEvent(
  accountId: string,
  type: string,
  phone: string | null,
  data: Record<string, unknown>,
  config?: AgentConfig
) {
  const cfg = config ?? (await getAgentConfig(accountId));
  const event = await prisma.agentEvent.create({
    data: {
      accountId,
      type,
      phone,
      payload: data as any,
      deliveryStatus: cfg.webhookUrl ? "PENDING" : "PULL",
    },
  });
  if (cfg.webhookUrl) {
    // import tardio: evita ciclo de import com o worker
    const { triggerAgentDelivery } = await import("../workers/agentDelivery");
    triggerAgentDelivery();
  }
  return event;
}

/**
 * Chamado pelo webhook da Meta depois de gravar uma mensagem recebida.
 * Não repassa quando: integração desligada, contato na lista negra ou um
 * atendente humano assumiu a conversa (pausa ainda válida).
 */
export async function notifyAgentOfIncomingMessage(input: {
  account: { id: string; name: string; phoneNumberId: string };
  savedMsg: { id: string; wamid: string | null; messageType: string; body: string | null; mediaUrl: string | null; createdAt: Date; to: string };
  contact: { profileName?: string | null; blacklisted?: boolean | null; agentPaused?: boolean | null; agentPausedAt?: Date | null } | null | undefined;
  profileName: string | null;
  raw: any;
  keywordOptOut: boolean;
}) {
  const cfg = await getAgentConfig(input.account.id);
  if (!cfg.enabled) return null;

  const phone = input.savedMsg.to;
  if (input.contact?.blacklisted) return null;
  if (isAgentPauseActive(input.contact)) return null;
  if (input.contact?.agentPaused) {
    // Pausa expirou (nenhum atendente respondeu dentro do prazo): o agente volta a atender
    await prisma.whatsAppContact.updateMany({
      where: { accountId: input.account.id, phone, agentPaused: true },
      data: { agentPaused: false, agentPausedAt: null, agentPausedBy: null },
    });
  }

  const [optOutRow, origin] = await Promise.all([
    input.keywordOptOut
      ? Promise.resolve(true)
      : prisma.optOut.findUnique({ where: { phone_accountId: { phone, accountId: input.account.id } }, select: { id: true } }),
    findCampaignOrigin(input.account.id, phone),
  ]);

  const payload = buildMessageReceivedPayload({
    account: input.account,
    message: {
      id: input.savedMsg.id,
      wamid: input.savedMsg.wamid,
      type: input.savedMsg.messageType,
      text: input.savedMsg.body,
      mediaId: input.savedMsg.mediaUrl,
      receivedAt: input.savedMsg.createdAt,
    },
    raw: input.raw,
    contact: { phone, name: input.profileName ?? input.contact?.profileName ?? null, optedOut: Boolean(optOutRow) },
    origin,
  });
  return enqueueAgentEvent(input.account.id, "message.received", phone, payload, cfg);
}

/** Avisa o agente que a conversa passou para um humano (ou que o agente pediu um humano). */
export async function notifyAgentOfHandover(
  accountId: string,
  phone: string,
  handover: { by: "human" | "agent"; userName?: string | null; reason?: string | null; pausedAt: Date }
) {
  const cfg = await getAgentConfig(accountId);
  if (!cfg.enabled) return null;
  return enqueueAgentEvent(
    accountId,
    "conversation.handover",
    phone,
    {
      contact: { phone },
      handover: {
        by: handover.by,
        userName: handover.userName ?? null,
        reason: handover.reason ?? null,
        pausedAt: handover.pausedAt.toISOString(),
        resumesAt: agentPauseExpiresAt(handover.pausedAt)?.toISOString() ?? null,
      },
    },
    cfg
  );
}

/** Corpo enviado ao agente: envelope comum + dados do evento. */
export function buildEventEnvelope(event: { id: string; seq: number; type: string; createdAt: Date; payload: unknown }) {
  return {
    id: event.id,
    seq: event.seq,
    type: event.type,
    version: AGENT_EVENT_VERSION,
    createdAt: event.createdAt.toISOString(),
    data: event.payload,
  };
}
