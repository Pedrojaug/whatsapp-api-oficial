import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";
import { encryptToken, decryptToken } from "../utils/crypto";
import { metaService } from "../services/metaService";

const router = Router();

// Aplica o middleware de autenticação em todas as rotas de conta
router.use(authMiddleware);

// List WABA accounts (scoped to user)
router.get("/accounts", async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const accounts = await prisma.account.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    
    // Mascarar os tokens para não expor a credencial no frontend
    const safeAccounts = accounts.map(acc => {
      const raw = decryptToken(acc.accessToken);
      return {
        ...acc,
        accessToken: "[ENCRYPTED]",
        maskedToken: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : ""
      };
    });

    res.json(safeAccounts);
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
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      update: { wabaId, phoneNumberId, accessToken: encryptedToken },
      create: { userId, name, wabaId, phoneNumberId, accessToken: encryptedToken },
    });

    const raw = decryptToken(account.accessToken);
    res.status(201).json({
      ...account,
      accessToken: "[ENCRYPTED]",
      maskedToken: raw ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : ""
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Valida as credenciais da Meta antes de salvar
router.post("/accounts/verify", async (req: Request, res: Response) => {
  const { wabaId, phoneNumberId, accessToken } = req.body;
  if (!wabaId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }

  try {
    // Fazer uma chamada simples de validação na Meta buscando templates com limit=1
    await metaService.fetchTemplates(wabaId, accessToken, 1);
    res.json({ success: true, message: "Conexão validada com sucesso!" });
  } catch (error: any) {
    console.error("Erro de validação Meta:", error.response?.data || error.message);
    const metaError = error.response?.data?.error;
    let message = "Não foi possível conectar à Meta. Verifique seus dados.";

    if (metaError) {
      if (metaError.code === 190) {
        message = "O Token de Acesso da Meta é inválido ou expirou. Por favor, insira um token válido.";
      } else if (metaError.code === 100 || metaError.code === 80004) {
        message = "O WABA ID fornecido é inválido. Verifique o ID no painel da Meta.";
      } else {
        message = `Erro da Meta (${metaError.code}): ${metaError.message}`;
      }
    }

    res.status(400).json({ error: message });
  }
});

// Delete account (scoped and authorized to user)
router.delete("/accounts/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const userId = (req as AuthenticatedRequest).userId;
    const account = await prisma.account.findFirst({
      where: { id, userId }
    });
    if (!account) {
      return res.status(404).json({ error: "Conta não encontrada ou acesso negado." });
    }
    await prisma.account.delete({ where: { id } });
    res.json({ message: "Account deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
