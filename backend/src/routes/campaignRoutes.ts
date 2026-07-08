import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { calculateNextRun } from "../utils/campaignScheduler";
import { findAccountForUser } from "../utils/accountAccess";

const router = Router();
router.use(authMiddleware);

async function getAccount(accountId: string, userId: string) {
  return await findAccountForUser(accountId, userId);
}

// GET /accounts/:accountId/campaigns
router.get("/accounts/:accountId/campaigns", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const campaigns = await prisma.campaign.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { runs: true } } },
  });

  res.json(campaigns);
});

// GET /accounts/:accountId/campaigns/:id/runs
router.get("/accounts/:accountId/campaigns/:id/runs", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const runs = await prisma.campaignRun.findMany({
    where: { campaignId: id, campaign: { accountId } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  res.json(runs);
});

// POST /accounts/:accountId/campaigns
router.post("/accounts/:accountId/campaigns", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name, contactListId, templateName, variables, mediaUrl, scheduleType, scheduleTime, scheduleDays, scheduleDate } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  if (!name?.trim()) return res.status(400).json({ error: "Campo 'name' é obrigatório." });
  if (!templateName?.trim()) return res.status(400).json({ error: "Campo 'templateName' é obrigatório." });
  if (!scheduleType) return res.status(400).json({ error: "Campo 'scheduleType' é obrigatório." });

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const nextRunAt = calculateNextRun({
    scheduleType,
    scheduleTime: scheduleTime || undefined,
    scheduleDays: scheduleDays || [],
    scheduleDate: scheduleDate || undefined,
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: name.trim(),
      accountId,
      contactListId: contactListId || null,
      templateName: templateName.trim(),
      variables: variables || null,
      mediaUrl: mediaUrl || null,
      scheduleType,
      scheduleTime: scheduleTime || null,
      scheduleDays: scheduleDays || [],
      scheduleDate: scheduleDate ? new Date(scheduleDate) : null,
      nextRunAt,
      status: "DRAFT",
    },
  });

  res.status(201).json(campaign);
});

// PUT /accounts/:accountId/campaigns/:id
router.put("/accounts/:accountId/campaigns/:id", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const { name, contactListId, templateName, variables, mediaUrl, scheduleType, scheduleTime, scheduleDays, scheduleDate } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const existing = await prisma.campaign.findFirst({ where: { id, accountId } });
  if (!existing) return res.status(404).json({ error: "Campanha não encontrada." });
  if (existing.status === "ACTIVE") {
    return res.status(400).json({ error: "Pause a campanha antes de editar." });
  }

  const newScheduleType = scheduleType || existing.scheduleType;
  const nextRunAt = calculateNextRun({
    scheduleType: newScheduleType,
    scheduleTime: scheduleTime !== undefined ? scheduleTime : (existing.scheduleTime ?? undefined),
    scheduleDays: scheduleDays || existing.scheduleDays,
    scheduleDate: scheduleDate || existing.scheduleDate?.toISOString(),
  });

  const updated = await prisma.campaign.update({
    where: { id },
    data: {
      name: name?.trim() || existing.name,
      contactListId: contactListId !== undefined ? (contactListId || null) : existing.contactListId,
      templateName: templateName?.trim() || existing.templateName,
      variables: variables !== undefined ? variables : existing.variables,
      mediaUrl: mediaUrl !== undefined ? (mediaUrl || null) : existing.mediaUrl,
      scheduleType: newScheduleType,
      scheduleTime: scheduleTime !== undefined ? (scheduleTime || null) : existing.scheduleTime,
      scheduleDays: scheduleDays || existing.scheduleDays,
      scheduleDate: scheduleDate ? new Date(scheduleDate) : existing.scheduleDate,
      nextRunAt,
    },
  });

  res.json(updated);
});

// POST /accounts/:accountId/campaigns/:id/activate
router.post("/accounts/:accountId/campaigns/:id/activate", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const campaign = await prisma.campaign.findFirst({ where: { id, accountId } });
  if (!campaign) return res.status(404).json({ error: "Campanha não encontrada." });
  if (campaign.status === "COMPLETED") {
    return res.status(400).json({ error: "Campanha já foi concluída (ONCE). Crie uma nova." });
  }
  if (!campaign.contactListId) {
    return res.status(400).json({ error: "Defina uma lista de contatos antes de ativar a campanha." });
  }

  const now = new Date();
  const nextRunAt =
    campaign.nextRunAt && campaign.nextRunAt > now
      ? campaign.nextRunAt
      : calculateNextRun({
          scheduleType: campaign.scheduleType,
          scheduleTime: campaign.scheduleTime ?? undefined,
          scheduleDays: campaign.scheduleDays,
          scheduleDate: campaign.scheduleDate?.toISOString(),
        });

  if (!nextRunAt) {
    return res.status(400).json({ error: "Configuração de agendamento inválida. Verifique os campos de horário." });
  }

  const updated = await prisma.campaign.update({
    where: { id },
    data: { status: "ACTIVE", nextRunAt },
  });

  res.json(updated);
});

// POST /accounts/:accountId/campaigns/:id/pause
router.post("/accounts/:accountId/campaigns/:id/pause", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const updated = await prisma.campaign.updateMany({
    where: { id, accountId, status: "ACTIVE" },
    data: { status: "PAUSED" },
  });

  if (updated.count === 0) return res.status(404).json({ error: "Campanha ativa não encontrada." });
  res.json({ success: true });
});

// DELETE /accounts/:accountId/campaigns/:id
router.delete("/accounts/:accountId/campaigns/:id", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const deleted = await prisma.campaign.deleteMany({ where: { id, accountId } });
  if (deleted.count === 0) return res.status(404).json({ error: "Campanha não encontrada." });
  res.json({ success: true });
});

export default router;
