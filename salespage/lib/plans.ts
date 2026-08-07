export type Plan = {
  slug: string;
  name: string;
  price: number;
  period: string;
  badge?: string;
  highlighted?: boolean;
  monthlyEquivalent?: number;
  description: string;
  features: string[];
};

export const plans: Plan[] = [
  {
    slug: "mensal",
    name: "Plano Mensal",
    price: 197,
    period: "/mês",
    description: "Ideal para testar e validar operações com disparos oficiais.",
    features: [
      "Conexão API Oficial Meta Cloud v19",
      "Envios de Campanhas Ilimitados",
      "Gestão de Listas & Segmentações",
      "Templates Aprovados pela Meta",
      "Link Tracking Rastreável (/t/)",
      "API Key REST & Webhooks",
      "Suporte via WhatsApp",
    ],
  },
  {
    slug: "trimestral",
    name: "Plano Trimestral",
    price: 497,
    period: "/trimestre",
    badge: "Mais Escolhido",
    highlighted: true,
    monthlyEquivalent: 165,
    description: "Para empresas que buscam escalar vendas com desconto contínuo.",
    features: [
      "Tudo do Plano Mensal",
      "Economia de R$ 94 no trimestre",
      "Suporte Prioritário",
      "Templates n8n Prontos para Uso",
      "Blacklist & Opt-out Automático",
      "Múltiplos Números no Painel",
      "Relatórios de Performance Avançados",
    ],
  },
  {
    slug: "anual",
    name: "Plano Anual",
    price: 1497,
    period: "/ano",
    badge: "Melhor Valor (Economize 36%)",
    monthlyEquivalent: 124,
    description: "Estrutura completa com o menor custo por mês do mercado.",
    features: [
      "Tudo do Plano Trimestral",
      "Economia de R$ 867 no ano",
      "Onboarding Pessoal de Configuração",
      "Prioridade Máxima na Fila de Disparo",
      "Garantia de Atualizações de API Meta",
      "Gerente de Conta Dedicado",
    ],
  },
];

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
