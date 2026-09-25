/**
 * Constantes e funções utilitárias para auditoria financeira e prévia de custos
 * da API Oficial do WhatsApp (Meta Cloud API) para o Brasil (+55).
 */

export const META_RATES_BRL: Record<string, number> = {
  MARKETING: 0.36,
  UTILITY: 0.20,
  AUTHENTICATION: 0.18,
  SERVICE: 0.17,
};

export const META_RATES_USD: Record<string, number> = {
  MARKETING: 0.0625,
  UTILITY: 0.0350,
  AUTHENTICATION: 0.0315,
  SERVICE: 0.0300,
};

export const DEFAULT_EXCHANGE_RATE = 5.75;

export function normalizeCategory(category?: string | null): "MARKETING" | "UTILITY" | "AUTHENTICATION" | "SERVICE" {
  const cat = (category || "").trim().toUpperCase();
  if (cat === "UTILITY" || cat === "UTILIDADE") return "UTILITY";
  if (cat === "AUTHENTICATION" || cat === "AUTENTICACAO" || cat === "OTP") return "AUTHENTICATION";
  if (cat === "SERVICE" || cat === "SERVICO" || cat === "ATENDIMENTO") return "SERVICE";
  return "MARKETING";
}

export function formatBRL(amount: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export function getTemplateUnitCost(category?: string | null) {
  const norm = normalizeCategory(category);
  return {
    category: norm,
    brl: META_RATES_BRL[norm] || META_RATES_BRL.MARKETING,
    usd: META_RATES_USD[norm] || META_RATES_USD.MARKETING,
  };
}

export function calculateEstimate(contactCount: number, category?: string | null) {
  const { brl, usd } = getTemplateUnitCost(category);
  const totalBrl = contactCount * brl;
  const totalUsd = contactCount * usd;

  return {
    unitBrl: brl,
    unitUsd: usd,
    totalBrl,
    totalUsd,
    formattedBrl: formatBRL(totalBrl),
    formattedUsd: formatUSD(totalUsd),
    formattedUnitBrl: formatBRL(brl),
    formattedUnitUsd: formatUSD(usd),
  };
}
