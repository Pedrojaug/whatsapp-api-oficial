import { Router, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set.");
}

// Apply authentication middleware to all admin endpoints
router.use(authMiddleware);

// ROTA AUXILIAR: Middleware interno para garantir SUPERUSER
async function requireSuperUser(req: AuthenticatedRequest, res: Response, next: () => void) {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== "SUPERUSER") {
      return res.status(403).json({ error: "Acesso negado. Apenas superusuários têm permissão." });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: "Erro ao verificar permissões de administrador." });
  }
}

// 1. LISTAR TODOS OS USUÁRIOS
router.get("/users", requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: { accounts: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. IMPERSONAR UM USUÁRIO (SESSÃO DE SUPORTE)
router.post("/impersonate", requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: "O ID do usuário alvo é obrigatório." });
  }

  try {
    const admin = await prisma.user.findUnique({ where: { id: req.userId } });
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });

    if (!targetUser) {
      return res.status(404).json({ error: "Usuário alvo não encontrado." });
    }

    if (targetUser.id === req.userId) {
      return res.status(400).json({ error: "Você já está na sua própria conta." });
    }

    // Gera um token para o cliente, anotando as informações do administrador
    const supportToken = jwt.sign(
      {
        userId: targetUser.id,
        impersonatorId: admin!.id,
        impersonatorName: admin!.name || admin!.email
      },
      JWT_SECRET,
      { expiresIn: "1d" } // Sessão de suporte expira em 1 dia
    );

    return res.json({
      token: supportToken,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
