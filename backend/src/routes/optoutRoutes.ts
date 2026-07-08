import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { normalizePhone } from "../services/phoneService";
import { findAccountForUser } from "../utils/accountAccess";

const router = Router();
router.use(authMiddleware);

/** Verifica se o usuário autenticado tem acesso à conta. */
async function getAccount(accountId: string, userId: string) {
  return await findAccountForUser(accountId, userId);
}

// GET /accounts/:accountId/optouts — lista com busca e paginação
router.get("/accounts/:accountId/optouts", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { search, page = "1", limit = "50" } = req.query;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const p = Math.max(1, parseInt(page as string));
  const l = Math.min(200, Math.max(1, parseInt(limit as string)));

  const where: any = { accountId };
  if (search) where.phone = { contains: (search as string).replace(/\D/g, "") };

  const [optOuts, total] = await prisma.$transaction([
    prisma.optOut.findMany({ where, orderBy: { createdAt: "desc" }, skip: (p - 1) * l, take: l }),
    prisma.optOut.count({ where }),
  ]);

  res.json({ optOuts, total, page: p, limit: l });
});

// POST /accounts/:accountId/optouts — adicionar único número manualmente
router.post("/accounts/:accountId/optouts", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { phone } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  if (!phone) return res.status(400).json({ error: "Campo 'phone' é obrigatório." });

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const normalized = normalizePhone(String(phone));
  if (normalized.length < 8) return res.status(400).json({ error: "Número de telefone inválido." });

  const optOut = await prisma.optOut.upsert({
    where: { phone_accountId: { phone: normalized, accountId } },
    update: { reason: "MANUAL" },
    create: { phone: normalized, accountId, reason: "MANUAL" },
  });

  res.status(201).json(optOut);
});

// POST /accounts/:accountId/optouts/bulk — importar lista de números
router.post("/accounts/:accountId/optouts/bulk", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { phones } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  if (!Array.isArray(phones) || phones.length === 0)
    return res.status(400).json({ error: "Campo 'phones' deve ser um array não vazio." });

  if (phones.length > 10_000)
    return res.status(400).json({ error: "Máximo de 10.000 números por importação." });

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const normalized = phones
    .map((p: any) => normalizePhone(String(p)))
    .filter((p) => p.length >= 8);

  if (normalized.length === 0)
    return res.status(400).json({ error: "Nenhum número válido encontrado." });

  // upsertMany via createMany com skipDuplicates
  await prisma.optOut.createMany({
    data: normalized.map((phone) => ({ phone, accountId, reason: "MANUAL" })),
    skipDuplicates: true,
  });

  res.json({ imported: normalized.length, total: phones.length });
});

// DELETE /accounts/:accountId/optouts/:phone — remover (re-opt-in)
router.delete("/accounts/:accountId/optouts/:phone", async (req: Request, res: Response) => {
  const { accountId, phone } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const normalized = normalizePhone(phone);

  const deleted = await prisma.optOut.deleteMany({
    where: { phone: normalized, accountId },
  });

  if (deleted.count === 0) return res.status(404).json({ error: "Número não encontrado na lista de opt-out." });

  res.json({ success: true });
});

export default router;
