import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { encryptToken, decryptToken } from "../utils/crypto";
import { metaService } from "../services/metaService";

const router = Router();

router.use(authMiddleware);

// List WABA accounts (owned + shared)
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;

    const [ownedRaw, shares] = await Promise.all([
      prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.accountShare.findMany({
        where: { userId },
        include: { account: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const mask = (acc: any, isShared: boolean) => {
      const raw = decryptToken(acc.accessToken);
      return {
        ...acc,
        accessToken: "[ENCRYPTED]",
        maskedToken: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : "",
        isShared,
      };
    };

    const owned = ownedRaw.map(a => mask(a, false));
    const shared = shares.map(s => mask(s.account, true));

    res.json([...owned, ...shared]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update WABA account (scoped to user)
router.post("/accounts", async (req: Request, res: Response) => {
  const { name, wabaId, phoneNumberId, accessToken } = req.body;
  if (!name || !wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const userId = (req as AuthenticatedRequest).userId!;
    const encryptedToken = encryptToken(accessToken.trim());

    const account = await prisma.account.upsert({
      where: { userId_name: { userId, name } },
      update: { wabaId, phoneNumberId, accessToken: encryptedToken },
      create: { userId, name, wabaId, phoneNumberId, accessToken: encryptedToken },
    });

    const raw = decryptToken(account.accessToken);
    res.status(201).json({
      ...account,
      accessToken: "[ENCRYPTED]",
      maskedToken: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : "",
      isShared: false,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validate Meta credentials
router.post("/accounts/verify", async (req: Request, res: Response) => {
  const { wabaId, phoneNumberId, accessToken } = req.body;
  if (!wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  try {
    await metaService.fetchTemplates(wabaId, accessToken, 1);
    res.json({ success: true, message: "Conexão validada com sucesso!" });
  } catch (error: any) {
    const metaError = error.response?.data?.error;
    let message = "Não foi possível conectar à Meta. Verifique seus dados.";
    if (metaError) {
      if (metaError.code === 190) message = "O Token de Acesso da Meta é inválido ou expirou.";
      else if (metaError.code === 100 || metaError.code === 80004) message = "O WABA ID fornecido é inválido.";
      else message = `Erro da Meta (${metaError.code}): ${metaError.message}`;
    }
    res.status(400).json({ error: message });
  }
});

// Delete account (only owner)
router.delete("/accounts/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({ where: { id, userId } });
    if (!account) return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });
    await prisma.account.delete({ where: { id } });
    res.json({ message: "Account deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Share management ──────────────────────────────────────────────────────────

// List members with access to an account (only owner)
router.get("/accounts/:accountId/shares", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(403).json({ error: "Apenas o dono da conta pode gerenciar acessos." });

    const shares = await prisma.accountShare.findMany({
      where: { accountId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(shares);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Invite user to account by email (only owner)
router.post("/accounts/:accountId/shares", async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { email } = req.body;
  const userId = (req as AuthenticatedRequest).userId;

  if (!email) return res.status(400).json({ error: "E-mail obrigatório." });

  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(403).json({ error: "Apenas o dono da conta pode convidar membros." });

    const target = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!target) return res.status(404).json({ error: "Nenhum usuário encontrado com esse e-mail." });
    if (target.id === userId) return res.status(400).json({ error: "Você já é o dono desta conta." });

    const share = await prisma.accountShare.upsert({
      where: { accountId_userId: { accountId, userId: target.id } },
      update: {},
      create: { accountId, userId: target.id },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    res.status(201).json(share);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove access (only owner)
router.delete("/accounts/:accountId/shares/:shareId", async (req: Request, res: Response) => {
  const { accountId, shareId } = req.params;
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) return res.status(403).json({ error: "Apenas o dono da conta pode remover acessos." });

    await prisma.accountShare.delete({ where: { id: shareId } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
