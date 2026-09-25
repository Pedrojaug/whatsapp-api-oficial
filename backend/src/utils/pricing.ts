import { prisma } from "../db";

/**
 * Tabela Oficial de Tarifas do WhatsApp Cloud API para o Brasil (DDI +55)
 * Fonte: Meta Business Help Center / WhatsApp Business Platform Pricing
 * 
 * - MARKETING: Conversas iniciadas pela empresa com foco comercial, promoções, novidades.
 * - UTILITY: Atualizações transacionais, confirmações de pedidos, alertas operacionais.
 * - AUTHENTICATION: Envio de códigos únicos de verificação (OTP / 2FA).
 * - SERVICE: Atendimento iniciado pelo cliente (1.000 gratuitas por mês por WABA, excedente tarifado).
 */
export const META_RATES_USD: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0350,
  AUTHENTICATION: 0.0315,
  SERVICE: 0.0300,
};

// Câmbio padrão USD/BRL
export const DEFAULT_USD_TO_BRL = 5.75;

export const META_RATES_BRL: Record<string, number> = {
  MARKETING: 0.36,
  UTILITY: 0.20,
  AUTHENTICATION: 0.18,
  SERVICE: 0.17,
};

export function normalizeCategory(category?: string | null): "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE" {
  const cat = (category || "").trim().toUpperCase();
  if (cat === "UTILITY" || cat === "UTILIDADE") return "UTILITY";
  if (cat === "AUTHENTICATION" || cat === "AUTENTICACAO" || cat === "OTP") return "AUTHENTICATION";
  if (cat === "SERVICE" || cat === "SERVICO" || cat === "ATENDIMENTO") return "SERVICE";
  return "MARKETING";
}

export function getUnitRates(category: string, exchangeRate = DEFAULT_USD_TO_BRL) {
  const norm = normalizeCategory(category);
  const usd = META_RATES_USD[norm] || META_RATES_USD.MARKETING;
  const brl = Number((usd * exchangeRate).toFixed(4));
  return { category: norm, usd, brl };
}

export interface TemplateCostSummary {
  templateName: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
  delivered: number;
  failed: number;
  total: number;
  unitCostBrl: number;
  unitCostUsd: number;
  totalCostBrl: number;
  totalCostUsd: number;
  percentageOfTotal: number;
}

export interface AccountFinancialOverview {
  exchangeRate: number;
  period: {
    start: string;
    end: string;
    totalSpentBrl: number;
    totalSpentUsd: number;
    totalDeliveredBilled: number;
    totalFailedFree: number;
    savingsFromFailuresBrl: number;
  };
  byCategory: {
    MARKETING: { delivered: number; unitCostBrl: number; totalCostBrl: number; totalCostUsd: number };
    UTILITY: { delivered: number; unitCostBrl: number; totalCostBrl: number; totalCostUsd: number };
    AUTHENTICATION: { delivered: number; unitCostBrl: number; totalCostBrl: number; totalCostUsd: number };
    SERVICE: { delivered: number; unitCostBrl: number; totalCostBrl: number; totalCostUsd: number };
  };
  templateCosts: TemplateCostSummary[];
  billingForecast: {
    currentMonthSpentBrl: number;
    currentMonthSpentUsd: number;
    currentMonthDelivered: number;
    dailyRunRateBrl: number;
    projectedMonthEndCostBrl: number;
    projectedMonthEndCostUsd: number;
    activeCampaignsProjectedBrl: number;
    totalForecastMonthBrl: number;
    nextBillingEstimate: string;
    metaBillingRules: {
      failedMessagesCharged: boolean;
      freeServiceTier: number;
      billingCycle: string;
    };
  };
}

/**
 * Calcula auditoria detalhada de custos e projeção financeira para uma conta
 */
export async function getAccountFinancialMetrics(
  accountId: string,
  startDate: Date,
  endDate: Date,
  exchangeRate = DEFAULT_USD_TO_BRL
): Promise<AccountFinancialOverview> {
  // 1. Mapeamento de categorias de templates cadastrados
  const templates = await prisma.template.findMany({
    where: { accountId },
    select: { name: true, category: true },
  });

  const categoryMap = new Map<string, "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE">();
  templates.forEach((t) => {
    categoryMap.set(t.name, normalizeCategory(t.category));
  });

  // 2. Mensagens do período selecionado agrupadas por template
  const periodTemplatesRaw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE("templateName", 'Envio Direto') as "templateName",
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ'))::int as delivered,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed
    FROM "Message"
    WHERE "accountId" = $1
      AND direction = 'OUTGOING'
      AND "messageType" = 'TEMPLATE'
      AND "createdAt" >= $2 AND "createdAt" <= $3
    GROUP BY COALESCE("templateName", 'Envio Direto')
    ORDER BY delivered DESC
  `, accountId, startDate, endDate);

  // 3. Totais do mês corrente (para o ciclo de cobrança da Meta)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthCurrentRaw = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE("templateName", 'Envio Direto') as "templateName",
      COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'READ'))::int as delivered
    FROM "Message"
    WHERE "accountId" = $1
      AND direction = 'OUTGOING'
      AND "messageType" = 'TEMPLATE'
      AND "createdAt" >= $2 AND "createdAt" <= $3
    GROUP BY COALESCE("templateName", 'Envio Direto')
  `, accountId, startOfMonth, now);

  // 4. Campanhas ativas para projeção de gastos futuros agendados
  const activeCampaigns = await prisma.campaign.findMany({
    where: { accountId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      templateName: true,
      contactListId: true,
      scheduleType: true,
      nextRunAt: true,
    },
  });

  // Buscar contagem de contatos de cada lista associada às campanhas ativas
  let activeCampaignsProjectedBrl = 0;
  for (const camp of activeCampaigns) {
    let contactsCount = 0;
    if (camp.contactListId) {
      contactsCount = await prisma.contact.count({
        where: { contactListId: camp.contactListId },
      });
    }

    const cat = categoryMap.get(camp.templateName) || "MARKETING";
    const { brl } = getUnitRates(cat, exchangeRate);

    // Estimativa de execuções restantes no mês
    let runsRemainingThisMonth = 1;
    if (camp.scheduleType === "DAILY") {
      const daysLeftInMonth = Math.max(1, endOfMonth.getDate() - now.getDate());
      runsRemainingThisMonth = daysLeftInMonth;
    } else if (camp.scheduleType === "WEEKLY") {
      const daysLeftInMonth = Math.max(1, endOfMonth.getDate() - now.getDate());
      runsRemainingThisMonth = Math.max(1, Math.floor(daysLeftInMonth / 7));
    } else if (camp.scheduleType === "MONTHLY") {
      runsRemainingThisMonth = 1;
    }

    activeCampaignsProjectedBrl += contactsCount * brl * runsRemainingThisMonth;
  }

  // 5. Compilação do período selecionado
  let periodTotalBrl = 0;
  let periodTotalUsd = 0;
  let totalDeliveredBilled = 0;
  let totalFailedFree = 0;
  let savingsFromFailuresBrl = 0;

  const byCategory = {
    MARKETING: { delivered: 0, unitCostBrl: getUnitRates("MARKETING", exchangeRate).brl, totalCostBrl: 0, totalCostUsd: 0 },
    UTILITY: { delivered: 0, unitCostBrl: getUnitRates("UTILITY", exchangeRate).brl, totalCostBrl: 0, totalCostUsd: 0 },
    AUTHENTICATION: { delivered: 0, unitCostBrl: getUnitRates("AUTHENTICATION", exchangeRate).brl, totalCostBrl: 0, totalCostUsd: 0 },
    SERVICE: { delivered: 0, unitCostBrl: getUnitRates("SERVICE", exchangeRate).brl, totalCostBrl: 0, totalCostUsd: 0 },
  };

  const rawTemplateSummaries: Array<{
    templateName: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE";
    delivered: number;
    failed: number;
    total: number;
    unitCostBrl: number;
    unitCostUsd: number;
    totalCostBrl: number;
    totalCostUsd: number;
  }> = [];

  for (const row of periodTemplatesRaw) {
    const tName = row.templateName;
    const cat = categoryMap.get(tName) || "MARKETING";
    const rates = getUnitRates(cat, exchangeRate);
    const delivered = row.delivered || 0;
    const failed = row.failed || 0;
    const total = row.total || 0;

    const costBrl = Number((delivered * rates.brl).toFixed(2));
    const costUsd = Number((delivered * rates.usd).toFixed(2));

    periodTotalBrl += costBrl;
    periodTotalUsd += costUsd;
    totalDeliveredBilled += delivered;
    totalFailedFree += failed;
    savingsFromFailuresBrl += Number((failed * rates.brl).toFixed(2));

    byCategory[cat].delivered += delivered;
    byCategory[cat].totalCostBrl += costBrl;
    byCategory[cat].totalCostUsd += costUsd;

    rawTemplateSummaries.push({
      templateName: tName,
      category: cat,
      delivered,
      failed,
      total,
      unitCostBrl: rates.brl,
      unitCostUsd: rates.usd,
      totalCostBrl: costBrl,
      totalCostUsd: costUsd,
    });
  }

  // Adicionar porcentagem relativa a cada template
  const templateCosts: TemplateCostSummary[] = rawTemplateSummaries.map((t) => ({
    ...t,
    percentageOfTotal: periodTotalBrl > 0 ? Math.round((t.totalCostBrl / periodTotalBrl) * 100) : 0,
  }));

  // 6. Faturamento do mês corrente e previsão de fechamento
  let currentMonthSpentBrl = 0;
  let currentMonthSpentUsd = 0;
  let currentMonthDelivered = 0;

  for (const mRow of monthCurrentRaw) {
    const cat = categoryMap.get(mRow.templateName) || "MARKETING";
    const rates = getUnitRates(cat, exchangeRate);
    const delivered = mRow.delivered || 0;
    currentMonthDelivered += delivered;
    currentMonthSpentBrl += delivered * rates.brl;
    currentMonthSpentUsd += delivered * rates.usd;
  }

  currentMonthSpentBrl = Number(currentMonthSpentBrl.toFixed(2));
  currentMonthSpentUsd = Number(currentMonthSpentUsd.toFixed(2));

  // Dias decorridos no mês até hoje
  const daysPassedInMonth = Math.max(1, now.getDate());
  const totalDaysInMonth = endOfMonth.getDate();
  const dailyRunRateBrl = Number((currentMonthSpentBrl / daysPassedInMonth).toFixed(2));
  const projectedMonthEndCostBrl = Number((dailyRunRateBrl * totalDaysInMonth).toFixed(2));
  const projectedMonthEndCostUsd = Number((projectedMonthEndCostBrl / exchangeRate).toFixed(2));

  const totalForecastMonthBrl = Number((currentMonthSpentBrl + activeCampaignsProjectedBrl).toFixed(2));

  // Próximo vencimento aproximado da fatura Meta (1º dia do mês seguinte ou por limite de gastos)
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextBillingEstimate = `${nextMonthDate.toLocaleDateString("pt-BR")} (ou ao atingir o limite de cobrança Meta)`;

  return {
    exchangeRate,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      totalSpentBrl: Number(periodTotalBrl.toFixed(2)),
      totalSpentUsd: Number(periodTotalUsd.toFixed(2)),
      totalDeliveredBilled,
      totalFailedFree,
      savingsFromFailuresBrl: Number(savingsFromFailuresBrl.toFixed(2)),
    },
    byCategory: {
      MARKETING: {
        ...byCategory.MARKETING,
        totalCostBrl: Number(byCategory.MARKETING.totalCostBrl.toFixed(2)),
        totalCostUsd: Number(byCategory.MARKETING.totalCostUsd.toFixed(2)),
      },
      UTILITY: {
        ...byCategory.UTILITY,
        totalCostBrl: Number(byCategory.UTILITY.totalCostBrl.toFixed(2)),
        totalCostUsd: Number(byCategory.UTILITY.totalCostUsd.toFixed(2)),
      },
      AUTHENTICATION: {
        ...byCategory.AUTHENTICATION,
        totalCostBrl: Number(byCategory.AUTHENTICATION.totalCostBrl.toFixed(2)),
        totalCostUsd: Number(byCategory.AUTHENTICATION.totalCostUsd.toFixed(2)),
      },
      SERVICE: {
        ...byCategory.SERVICE,
        totalCostBrl: Number(byCategory.SERVICE.totalCostBrl.toFixed(2)),
        totalCostUsd: Number(byCategory.SERVICE.totalCostUsd.toFixed(2)),
      },
    },
    templateCosts,
    billingForecast: {
      currentMonthSpentBrl,
      currentMonthSpentUsd,
      currentMonthDelivered,
      dailyRunRateBrl,
      projectedMonthEndCostBrl,
      projectedMonthEndCostUsd,
      activeCampaignsProjectedBrl: Number(activeCampaignsProjectedBrl.toFixed(2)),
      totalForecastMonthBrl,
      nextBillingEstimate,
      metaBillingRules: {
        failedMessagesCharged: false,
        freeServiceTier: 1000,
        billingCycle: "Cobrança direta no cartão cadastrado no Meta Business Manager no fechamento mensal ou ao atingir o limite de cobrança.",
      },
    },
  };
}
