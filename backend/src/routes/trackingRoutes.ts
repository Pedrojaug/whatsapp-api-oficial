import { Router, Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";

// ── Rotas autenticadas (CRUD) ────────────────────────────────────────────────
const router = Router();
router.use(authMiddleware);

function generateShortCode(): string {
  return crypto.randomBytes(4).toString("base64url").slice(0, 7);
}

async function getAccount(accountId: string, userId: string) {
  return prisma.account.findFirst({ where: { id: accountId, userId } });
}

// GET /accounts/:accountId/tracked-links — listar links rastreados
router.get("/accounts/:accountId/tracked-links", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const links = await prisma.trackedLink.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
  const result = links.map((l) => ({ ...l, trackedUrl: `${backendUrl}/t/${l.shortCode}` }));
  res.json(result);
});

// POST /accounts/:accountId/tracked-links — criar link rastreado
router.post("/accounts/:accountId/tracked-links", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { originalUrl, label } = req.body;
  const userId = (req as AuthenticatedRequest).userId!;

  if (!originalUrl) return res.status(400).json({ error: "Campo 'originalUrl' é obrigatório." });

  try { new URL(originalUrl); } catch {
    return res.status(400).json({ error: "URL inválida." });
  }

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  // Gerar shortCode único com até 5 tentativas
  let shortCode = "";
  for (let i = 0; i < 5; i++) {
    const candidate = generateShortCode();
    const exists = await prisma.trackedLink.findUnique({ where: { shortCode: candidate } });
    if (!exists) { shortCode = candidate; break; }
  }
  if (!shortCode) return res.status(500).json({ error: "Não foi possível gerar um código único. Tente novamente." });

  const link = await prisma.trackedLink.create({
    data: { shortCode, originalUrl, label: label || null, accountId },
  });

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";
  res.status(201).json({ ...link, trackedUrl: `${backendUrl}/t/${link.shortCode}` });
});

// DELETE /accounts/:accountId/tracked-links/:id — excluir link
router.delete("/accounts/:accountId/tracked-links/:id", async (req: Request, res: Response) => {
  const { accountId, id } = req.params;
  const userId = (req as AuthenticatedRequest).userId!;

  const account = await getAccount(accountId, userId);
  if (!account) return res.status(404).json({ error: "Conta não encontrada." });

  const deleted = await prisma.trackedLink.deleteMany({ where: { id, accountId } });
  if (deleted.count === 0) return res.status(404).json({ error: "Link não encontrado." });

  res.json({ success: true });
});

export default router;

// ── Redirect público (montado em /t/:shortCode por server.ts) ─────────────────
export async function handleTrackingRedirect(req: Request, res: Response) {
  const { shortCode } = req.params;

  const link = await prisma.trackedLink.findUnique({ where: { shortCode } });

  if (!link) {
    return res.status(404).send("Link não encontrado ou expirado.");
  }

  // Registrar clique (fire-and-forget — não bloqueia o redirect)
  prisma.trackedLink.update({
    where: { shortCode },
    data: { clicks: { increment: 1 }, lastClickAt: new Date() },
  }).catch(() => {});

  res.redirect(302, link.originalUrl);
}
