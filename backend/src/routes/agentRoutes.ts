/**
 * Rotas do painel (JWT) para a integração com o agente de IA:
 * configuração da conta e pausa/retomada do agente numa conversa do Live Chat.
 */
import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { getAccountWithPermission } from "../utils/accountAccess";
import { encryptToken } from "../utils/crypto";
import { messageEventEmitter } from "../utils/emitter";
import { normalizePhone, phoneVariants } from "../services/phoneService";
import {
  agentPauseExpiresAt,
  agentPauseMs,
  generateAgentSecret,
  getAgentConfig,
  invalidateAgentConfig,
  isAgentPauseActive,
  notifyAgentOfHandover,
  validateAgentWebhookUrl,
} from "../services/agentService";
import { postAgentEvent, triggerAgentDelivery } from "../workers/agentDelivery";

const router = Router();
router.use(authMiddleware);

async function integrationSummary(accountId: string) {
  const [account, counts, lastDelivered, lastFailure] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { agentEnabled: true, agentWebhookUrl: true, agentWebhookSecret: true },
    }),
    prisma.agentEvent.groupBy({
      by: ["deliveryStatus"],
      where: { accountId, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: { _all: true },
    }),
    prisma.agentEvent.findFirst({
      where: { accountId, deliveryStatus: "DELIVERED" },
      orderBy: { deliveredAt: "desc" },
      select: { deliveredAt: true },
    }),
    prisma.agentEvent.findFirst({
      where: { accountId, lastError: { not: null }, deliveryStatus: { in: ["PENDING", "FAILED"] } },
      orderBy: { seq: "desc" },
      select: { lastError: true, deliveryStatus: true, createdAt: true },
    }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.deliveryStatus, c._count._all]));
  return {
    enabled: Boolean(account?.agentEnabled),
    webhookUrl: account?.agentWebhookUrl ?? null,
    mode: account?.agentWebhookUrl ? "webhook" : "pull",
    hasSecret: Boolean(account?.agentWebhookSecret),
    pauseHours: agentPauseMs() / 3_600_000,
    last24h: {
      delivered: byStatus.DELIVERED || 0,
      pending: (byStatus.PENDING || 0) + (byStatus.PROCESSING || 0),
      failed: byStatus.FAILED || 0,
      pull: byStatus.PULL || 0,
    },
    lastDeliveredAt: lastDelivered?.deliveredAt ?? null,
    lastError: lastFailure ? { message: lastFailure.lastError, status: lastFailure.deliveryStatus, at: lastFailure.createdAt } : null,
  };
}

// GET /accounts/:accountId/agent-integration
router.get("/accounts/:accountId/agent-integration", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const account = await getAccountWithPermission(res, accountId, (req as AuthenticatedRequest).userId, "manageSettings");
  if (!account) return;
  res.json(await integrationSummary(accountId));
});

// PUT /accounts/:accountId/agent-integration  { enabled, webhookUrl }
router.put("/accounts/:accountId/agent-integration", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const account = await getAccountWithPermission(res, accountId, (req as AuthenticatedRequest).userId, "manageSettings");
  if (!account) return;

  const enabled = Boolean(req.body?.enabled);
  const rawUrl = typeof req.body?.webhookUrl === "string" ? req.body.webhookUrl.trim() : "";
  if (rawUrl) {
    const urlError = validateAgentWebhookUrl(rawUrl);
    if (urlError) return res.status(400).json({ error: urlError });
  }

  const current = await prisma.account.findUnique({ where: { id: accountId }, select: { agentWebhookSecret: true } });
  // Na primeira ativação gera o segredo e devolve UMA vez (depois só é possível trocar)
  const newSecret = enabled && !current?.agentWebhookSecret ? generateAgentSecret() : null;

  await prisma.account.update({
    where: { id: accountId },
    data: {
      agentEnabled: enabled,
      agentWebhookUrl: rawUrl || null,
      ...(newSecret ? { agentWebhookSecret: encryptToken(newSecret) } : {}),
    },
  });
  invalidateAgentConfig(accountId);
  if (enabled && rawUrl) triggerAgentDelivery();

  res.json({ ...(await integrationSummary(accountId)), ...(newSecret ? { secret: newSecret } : {}) });
});

// POST /accounts/:accountId/agent-integration/secret — gera um novo segredo (o anterior para de valer)
router.post("/accounts/:accountId/agent-integration/secret", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const account = await getAccountWithPermission(res, accountId, (req as AuthenticatedRequest).userId, "manageSettings");
  if (!account) return;
  const secret = generateAgentSecret();
  await prisma.account.update({ where: { id: accountId }, data: { agentWebhookSecret: encryptToken(secret) } });
  invalidateAgentConfig(accountId);
  res.json({ secret });
});

// POST /accounts/:accountId/agent-integration/test — envia um evento "ping" assinado e mostra o resultado
router.post("/accounts/:accountId/agent-integration/test", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const account = await getAccountWithPermission(res, accountId, (req as AuthenticatedRequest).userId, "manageSettings");
  if (!account) return;

  invalidateAgentConfig(accountId);
  const cfg = await getAgentConfig(accountId);
  if (!cfg.webhookUrl || !cfg.secret) {
    return res.status(400).json({ error: "Configure a URL do webhook e salve antes de testar." });
  }
  const started = Date.now();
  const error = await postAgentEvent(cfg.webhookUrl, cfg.secret, {
    id: `ping-${started}`,
    seq: 0,
    accountId,
    type: "ping",
    phone: null,
    payload: { message: "Teste de conexão do Send Inteligentte" },
    attempts: 1,
    createdAt: new Date(),
  });
  res.json({ ok: !error, error, latencyMs: Date.now() - started });
});

// GET /accounts/:accountId/conversations/:phone/agent — estado do agente na conversa (Live Chat)
router.get("/accounts/:accountId/conversations/:phone/agent", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const account = await getAccountWithPermission(res, accountId, (req as AuthenticatedRequest).userId, "view");
  if (!account) return;

  const cfg = await getAgentConfig(accountId);
  const contact = await prisma.whatsAppContact.findFirst({
    where: { accountId, phone: { in: phoneVariants(req.params.phone) } },
    select: { agentPaused: true, agentPausedAt: true, agentPausedBy: true },
  });
  const paused = isAgentPauseActive(contact);
  res.json({
    enabled: cfg.enabled,
    paused,
    pausedBy: paused ? contact?.agentPausedBy ?? null : null,
    pausedAt: paused ? contact?.agentPausedAt ?? null : null,
    resumesAt: paused ? agentPauseExpiresAt(contact?.agentPausedAt) : null,
  });
});

// PATCH /accounts/:accountId/conversations/:phone/agent  { paused }
router.patch("/accounts/:accountId/conversations/:phone/agent", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;
  const account = await getAccountWithPermission(res, accountId, userId, "chat");
  if (!account) return;

  const phone = normalizePhone(req.params.phone);
  const paused = Boolean(req.body?.paused);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
  const userName = user?.name || "Atendente";
  const now = new Date();

  await prisma.whatsAppContact.upsert({
    where: { accountId_phone: { accountId, phone } },
    update: paused
      ? { agentPaused: true, agentPausedAt: now, agentPausedBy: userName }
      : { agentPaused: false, agentPausedAt: null, agentPausedBy: null },
    create: paused
      ? { accountId, phone, agentPaused: true, agentPausedAt: now, agentPausedBy: userName }
      : { accountId, phone },
  });

  if (paused) notifyAgentOfHandover(accountId, phone, { by: "human", userName, pausedAt: now }).catch(() => {});
  messageEventEmitter.emit("messageUpdated", {
    type: "agentStatusChanged",
    accountId,
    to: phone,
    agentPaused: paused,
    updatedAt: now.toISOString(),
  });

  res.json({
    paused,
    pausedBy: paused ? userName : null,
    pausedAt: paused ? now : null,
    resumesAt: paused ? agentPauseExpiresAt(now) : null,
  });
});

export default router;
