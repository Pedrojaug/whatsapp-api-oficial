export type Plan = {
  slug: string;
  name: string;
  price: number;
  period: string;
  /** Quantos meses de acesso o pagamento cobre. Base do cálculo de economia. */
  months: number;
  /** Selo curto exibido no card. */
  badge?: string;
  /** Destaca o plano como recomendado na grade de preços. */
  featured?: boolean;
  /** Frase de apoio abaixo do preço. */
  note: string;
};

export const plans: Plan[] = [
  {
    slug: "mensal",
    name: "Mensal",
    price: 197,
    period: "/mês",
    months: 1,
    note: "Sem fidelidade. Cancele quando quiser.",
  },
  {
    slug: "trimestral",
    name: "Trimestral",
    price: 497,
    period: "/trimestre",
    months: 3,
    badge: "Mais escolhido",
    featured: true,
    note: "Tempo suficiente para maturar o número na Meta.",
  },
  {
    slug: "anual",
    name: "Anual",
    price: 1797,
    period: "/ano",
    months: 12,
    badge: "Melhor custo",
    note: "O menor valor por mês da plataforma.",
  },
];

const baseMonthlyPrice = plans[0].price;

export function getPlan(slug?: string) {
  return plans.find((plan) => plan.slug === slug) ?? plans[0];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencyPrecise(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Valor por mês equivalente ao período contratado. */
export function monthlyEquivalent(plan: Plan) {
  return plan.price / plan.months;
}

/** Quanto o cliente deixa de pagar em relação a assinar o mensal pelo mesmo período. */
export function savingsAmount(plan: Plan) {
  return baseMonthlyPrice * plan.months - plan.price;
}

/** Percentual de desconto sobre o mensal, arredondado para baixo. */
export function savingsPercent(plan: Plan) {
  const fullPrice = baseMonthlyPrice * plan.months;

  if (fullPrice <= 0) {
    return 0;
  }

  return Math.floor((savingsAmount(plan) / fullPrice) * 100);
}
