import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { findAccountForUser } from "../utils/accountAccess";

const router = Router();
router.use(authMiddleware);

async function getAccount(accountId: string, userId: string) {
  return await findAccountForUser(accountId, userId);
}

// GET /accounts/:accountId/api-keys
router.get("/accounts/:accountId/api-keys", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const keys = await prisma.apiKey.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });

  res.json(keys);
});

// POST /accounts/:accountId/api-keys
router.post("/accounts/:accountId/api-keys", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { name } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  if (!name?.trim()) return res.status(400).json({ error: "Campo 'name' é obrigatório." });

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const count = await prisma.apiKey.count({ where: { accountId } });
  if (count >= 10) {
    return res.status(400).json({ error: "Limite de 10 chaves de API por conta atingido. Revogue chaves antigas antes de criar novas." });
  }

  const rawKey = `sk_${crypto.randomBytes(32).toString("base64url")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 18) + "...";

  const apiKey = await prisma.apiKey.create({
    data: { name: name.trim(), keyHash, keyPrefix, accountId },
  });

  res.status(201).json({
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    rawKey, // returned ONCE — never stored in plain text
    createdAt: apiKey.createdAt,
  });
});

// DELETE /accounts/:accountId/api-keys/:id
router.delete("/accounts/:accountId/api-keys/:id", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const deleted = await prisma.apiKey.deleteMany({ where: { id, accountId } });
  if (deleted.count === 0) return res.status(404).json({ error: "Chave não encontrada." });

  res.json({ success: true });
});

export default router;
