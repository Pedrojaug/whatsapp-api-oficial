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

// Preços sugeridos padrão por plano para cálculo de MRR se customPriceMonthly não for especificado
const DEFAULT_PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 197,
  pro: 397,
  enterprise: 997,
  paid: 197, // Suporte a planos legados registrados como "paid"
};

// 1. LISTAR TODOS OS USUÁRIOS COM DADOS FINANCEIROS E LIMITES
router.get("/users", requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        planTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        customPriceMonthly: true,
        maxAccounts: true,
        maxMonthlyMessages: true,
        paymentMethod: true,
        notes: true,
        createdAt: true,
        accounts: {
          select: { id: true }
        },
        _count: {
          select: { accounts: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Calcular consumo de mensagens no mês atual para cada usuário
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const accountIds = u.accounts ? u.accounts.map((a) => a.id) : [];
        let monthlyMessagesSent = 0;
        if (accountIds.length > 0) {
          try {
            monthlyMessagesSent = await prisma.message.count({
              where: {
                accountId: { in: accountIds },
                direction: "OUTGOING",
                createdAt: { gte: startOfMonth }
              }
            });
          } catch (e) {
            console.warn("[Admin] Erro ao contar mensagens do usuário:", u.id, e);
          }
        }

        const tierKey = (u.planTier || "free").toLowerCase();
        const price = (u.customPriceMonthly !== null && u.customPriceMonthly !== undefined && u.customPriceMonthly > 0)
          ? u.customPriceMonthly
          : (DEFAULT_PLAN_PRICES[tierKey] || 0);

        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          planTier: u.planTier || "free",
          subscriptionStatus: u.subscriptionStatus || "ACTIVE",
          subscriptionExpiresAt: u.subscriptionExpiresAt,
          customPriceMonthly: u.customPriceMonthly || 0,
          monthlyPrice: price,
          maxAccounts: u.maxAccounts || 1,
          maxMonthlyMessages: u.maxMonthlyMessages || 5000,
          paymentMethod: u.paymentMethod || "PIX",
          notes: u.notes || "",
          createdAt: u.createdAt,
          accountsCount: u._count ? u._count.accounts : 0,
          monthlyMessagesSent
        };
      })
    );

    res.json(usersWithStats);
  } catch (error: any) {
    console.error("[Admin] Erro ao listar usuários:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. RESUMO DE MÉTRICAS FINANCEIRAS E DE ESCALABILIDADE DO SAAS
router.get("/metrics/financial", requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        planTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        customPriceMonthly: true,
        _count: { select: { accounts: true } }
      }
    });

    let totalMRR = 0;
    let activeClients = 0;
    let trialClients = 0;
    let pastDueClients = 0;
    let canceledClients = 0;
    let totalAccountsConnected = 0;

    const now = new Date();

    users.forEach((u) => {
      totalAccountsConnected += u._count ? u._count.accounts : 0;

      let status = u.subscriptionStatus || "ACTIVE";
      if (u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) < now && (status === "ACTIVE" || status === "TRIAL")) {
        status = "PAST_DUE";
      }

      if (status === "ACTIVE") {
        activeClients++;
        const tierKey = (u.planTier || "free").toLowerCase();
        const price = (u.customPriceMonthly !== null && u.customPriceMonthly !== undefined && u.customPriceMonthly > 0)
          ? u.customPriceMonthly
          : (DEFAULT_PLAN_PRICES[tierKey] || 0);
        totalMRR += price;
      } else if (status === "TRIAL") {
        trialClients++;
      } else if (status === "PAST_DUE") {
        pastDueClients++;
      } else if (status === "CANCELED" || status === "SUSPENDED") {
        canceledClients++;
      }
    });

    res.json({
      totalUsers: users.length,
      activeClients,
      trialClients,
      pastDueClients,
      canceledClients,
      totalMRR,
      totalAccountsConnected
    });
  } catch (error: any) {
    console.error("[Admin] Erro nas métricas financeiras:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. ATUALIZAR PLANO, STATUS FINANCEIRO E LIMITES DO CLIENTE
router.patch("/users/:id/subscription", requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    planTier,
    subscriptionStatus,
    subscriptionExpiresAt,
    customPriceMonthly,
    maxAccounts,
    paymentMethod,
    notes
  } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const updateData: any = {};

    if (planTier !== undefined && planTier !== null) {
      updateData.planTier = String(planTier);
    }
    if (subscriptionStatus !== undefined && subscriptionStatus !== null) {
      updateData.subscriptionStatus = String(subscriptionStatus);
    }
    if (subscriptionExpiresAt !== undefined) {
      if (subscriptionExpiresAt && !isNaN(new Date(subscriptionExpiresAt).getTime())) {
        updateData.subscriptionExpiresAt = new Date(subscriptionExpiresAt);
      } else {
        updateData.subscriptionExpiresAt = null;
      }
    }
    if (customPriceMonthly !== undefined) {
      const parsedPrice = parseFloat(customPriceMonthly);
      updateData.customPriceMonthly = (!isNaN(parsedPrice) && parsedPrice >= 0) ? parsedPrice : 0;
    }
    if (maxAccounts !== undefined) {
      const parsedAcc = parseInt(maxAccounts, 10);
      updateData.maxAccounts = (!isNaN(parsedAcc) && parsedAcc > 0) ? parsedAcc : 1;
    }
    if (paymentMethod !== undefined) {
      updateData.paymentMethod = paymentMethod ? String(paymentMethod) : "PIX";
    }
    if (notes !== undefined) {
      updateData.notes = notes ? String(notes) : "";
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        planTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        customPriceMonthly: true,
        maxAccounts: true,
        paymentMethod: true,
        notes: true
      }
    });

    res.json({ message: "Assinatura do cliente atualizada com sucesso!", user: updatedUser });
  } catch (error: any) {
    console.error("[Admin] Erro ao atualizar assinatura:", error);
    res.status(500).json({ error: error.message || "Erro ao atualizar assinatura." });
  }
});

// 4. REGISTRAR NOVO PAGAMENTO DO CLIENTE (SUPERUSER LANÇA E RENOVA STATUS)
router.post("/users/:id/payments", requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { amount, paymentMethod, referencePeriod, notes, extendDays = 30 } = req.body;

  if (!amount || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: "O valor (amount) do pagamento é obrigatório e deve ser um número." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // Criar histórico de pagamento
    const payment = await prisma.paymentRecord.create({
      data: {
        userId: id,
        amount: parseFloat(amount),
        status: "PAID",
        paymentMethod: paymentMethod || user.paymentMethod || "PIX",
        referencePeriod: referencePeriod || new Date().toISOString().slice(0, 7), // ex: "2026-07"
        paidAt: new Date(),
        notes: notes || "Pagamento registrado via Painel Admin"
      }
    });

    // Calcular nova data de expiração (estender x dias a partir de hoje ou do vencimento atual)
    const baseDate = user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date()
      ? new Date(user.subscriptionExpiresAt)
      : new Date();
    
    const newExpiresAt = new Date(baseDate.getTime() + (parseInt(extendDays, 10) || 30) * 24 * 60 * 60 * 1000);

    // Atualizar status da assinatura do cliente para ACTIVE
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        subscriptionStatus: "ACTIVE",
        subscriptionExpiresAt: newExpiresAt,
        paymentMethod: paymentMethod || user.paymentMethod
      },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true
      }
    });

    res.json({
      message: "Pagamento registrado e assinatura renovada com sucesso!",
      payment,
      user: updatedUser
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. OBTER HISTÓRICO DE PAGAMENTOS DE UM USUÁRIO
router.get("/users/:id/payments", requireSuperUser, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  try {
    const payments = await prisma.paymentRecord.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" }
    });
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. IMPERSONAR UM USUÁRIO (SESSÃO DE SUPORTE)
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
