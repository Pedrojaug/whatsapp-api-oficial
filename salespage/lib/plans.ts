export type Plan = {
  slug: string;
  name: string;
  price: number;
  period: string;
};

export const plans: Plan[] = [
  {
    slug: "mensal",
    name: "Mensal",
    price: 197,
    period: "/mês",
  },
  {
    slug: "trimestral",
    name: "Trimestral",
    price: 497,
    period: "/trimestre",
  },
  {
    slug: "anual",
    name: "Anual",
    price: 1797,
    period: "/ano",
  },
];

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
