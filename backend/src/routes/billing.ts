import { Router, Response } from "express";
import { prisma } from "../db";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

const DEFAULT_PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 197,
  pro: 397,
  enterprise: 997,
};

// Obter detalhes do plano e consumo atual do cliente logado
router.get("/my-plan", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        planTier: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        customPriceMonthly: true,
        maxAccounts: true,
        maxMonthlyMessages: true,
        paymentMethod: true,
        accounts: { select: { id: true, name: true, phoneNumberId: true } },
        _count: { select: { accounts: true } }
      }
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    // Mensagens disparadas no mês atual
    const accountIds = user.accounts.map((a) => a.id);
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    let monthlyMessagesSent = 0;
    if (accountIds.length > 0) {
      monthlyMessagesSent = await prisma.message.count({
        where: {
          accountId: { in: accountIds },
          direction: "OUTGOING",
          createdAt: { gte: startOfMonth }
        }
      });
    }

    // Verificar se expirou
    let effectiveStatus = user.subscriptionStatus;
    if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date() && (effectiveStatus === "ACTIVE" || effectiveStatus === "TRIAL")) {
      effectiveStatus = "PAST_DUE";
    }

    const price = user.customPriceMonthly !== null && user.customPriceMonthly !== undefined && user.customPriceMonthly > 0
      ? user.customPriceMonthly
      : (DEFAULT_PLAN_PRICES[user.planTier?.toLowerCase()] || 0);

    res.json({
      planTier: user.planTier,
      subscriptionStatus: effectiveStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      monthlyPrice: price,
      maxAccounts: user.maxAccounts,
      connectedAccountsCount: user._count.accounts,
      maxMonthlyMessages: user.maxMonthlyMessages,
      monthlyMessagesSent,
      paymentMethod: user.paymentMethod,
      commercialPageUrl: "https://github.com/pedro-sls/send-inteligentte-comercial"
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obter histórico de pagamentos do próprio cliente
router.get("/history", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    const payments = await prisma.paymentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
