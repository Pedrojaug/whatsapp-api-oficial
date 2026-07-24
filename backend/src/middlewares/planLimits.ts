import { Response, NextFunction } from "express";
import { prisma } from "../db";
import { AuthenticatedRequest } from "./auth";

/**
 * Middleware que verifica se a assinatura do usuário está ativa e dentro do prazo de validade.
 */
export async function checkSubscriptionActive(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        planTier: true,
      },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    // Superusuario tem acesso ilimitado
    if (user.role === "SUPERUSER") {
      return next();
    }

    // Verificar se expirou
    if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
      // Atualizar status para PAST_DUE caso estivesse ACTIVE ou TRIAL
      if (user.subscriptionStatus === "ACTIVE" || user.subscriptionStatus === "TRIAL") {
        await prisma.user.update({
          where: { id: userId },
          data: { subscriptionStatus: "PAST_DUE" },
        });
      }
      return res.status(402).json({
        error: "Sua assinatura está vencida.",
        code: "SUBSCRIPTION_EXPIRED",
        details: "Por favor, acesse a aba 'Assinatura & Plano' para efetuar a renovação ou entre em contato com o suporte.",
      });
    }

    if (user.subscriptionStatus === "PAST_DUE" || user.subscriptionStatus === "CANCELED" || user.subscriptionStatus === "SUSPENDED") {
      return res.status(402).json({
        error: "Sua assinatura está inativa ou suspensa.",
        code: "SUBSCRIPTION_INACTIVE",
        details: "Acesse a aba 'Assinatura & Plano' para regularizar seu pagamento.",
      });
    }

    next();
  } catch (error: any) {
    console.error("[planLimits] Erro ao verificar assinatura:", error);
    return res.status(500).json({ error: "Erro ao verificar status da assinatura." });
  }
}

/**
 * Middleware que verifica se o usuário atingiu o limite de contas (linhas Meta WhatsApp) do plano.
 */
export async function checkAccountLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        maxAccounts: true,
        planTier: true,
        _count: { select: { accounts: true } },
      },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    if (user.role === "SUPERUSER") {
      return next();
    }

    const currentAccountsCount = user._count.accounts;
    const maxAllowed = user.maxAccounts || 1;

    if (currentAccountsCount >= maxAllowed) {
      return res.status(403).json({
        error: `Limite de conexões atingido (${currentAccountsCount}/${maxAllowed}).`,
        code: "ACCOUNT_LIMIT_EXCEEDED",
        details: `Seu plano atual (${user.planTier.toUpperCase()}) permite até ${maxAllowed} conta(s) Meta. Faça um upgrade para conectar mais linhas.`,
      });
    }

    next();
  } catch (error: any) {
    console.error("[planLimits] Erro ao verificar limite de contas:", error);
    return res.status(500).json({ error: "Erro ao verificar limite de conexões do plano." });
  }
}

/**
 * Middleware que verifica se o usuário atingiu o limite mensal de disparos de mensagens.
 */
export async function checkMonthlyMessageLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Não autorizado." });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        maxMonthlyMessages: true,
        planTier: true,
        accounts: { select: { id: true } },
      },
    });

    if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

    if (user.role === "SUPERUSER") {
      return next();
    }

    const accountIds = user.accounts.map((a) => a.id);
    if (accountIds.length === 0) return next();

    // Primeiro dia do mês atual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const messagesCount = await prisma.message.count({
      where: {
        accountId: { in: accountIds },
        direction: "OUTGOING",
        createdAt: { gte: startOfMonth },
      },
    });

    const maxMessages = user.maxMonthlyMessages || 5000;

    if (messagesCount >= maxMessages) {
      return res.status(403).json({
        error: `Limite de disparos mensais atingido (${messagesCount}/${maxMessages}).`,
        code: "MESSAGE_LIMIT_EXCEEDED",
        details: `Você já consumiu suas ${maxMessages} mensagens deste mês no plano ${user.planTier.toUpperCase()}. Faça um upgrade para ampliar sua cota.`,
      });
    }

    next();
  } catch (error: any) {
    console.error("[planLimits] Erro ao verificar cota de mensagens:", error);
    return res.status(500).json({ error: "Erro ao verificar limite mensal de disparos." });
  }
}
