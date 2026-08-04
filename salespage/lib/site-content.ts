import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type Metric = {
  value: string;
  label: string;
};

export type Testimonial = {
  quote: string;
  author: string;
  role: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type SiteContent = {
  announcement: string;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  primaryCta: string;
  secondaryCta: string;
  proofItems: string[];
  previewCampaign: string;
  templateMessage: string;
  offerKicker: string;
  offerTitle: string;
  offerDescription: string;
  inclusions: string[];
  socialProofLabel: string;
  metrics: Metric[];
  testimonials: Testimonial[];
  guarantee: string;
  faq: FaqItem[];
  finalCtaTitle: string;
  finalCtaDescription: string;
};

export const defaultSiteContent: SiteContent = {
  announcement: "Ativação assistida incluída — primeira campanha no ar esta semana.",
  heroBadge: "WhatsApp Business API Oficial da Meta",
  heroTitle: "Dispare campanhas no WhatsApp *sem arriscar o seu número*.",
  heroDescription:
    "Disparo em massa pela API Oficial da Meta: templates aprovados, campanhas recorrentes e opt-out automático para cumprir a LGPD.",
  primaryCta: "Quero ativar minha conta",
  secondaryCta: "Ver como funciona",
  proofItems: ["API Oficial da Meta", "Opt-out automático (LGPD)", "Suporte na ativação"],
  previewCampaign: "Recuperação de orçamentos",
  templateMessage:
    "Olá, {{nome}}. Seu orçamento continua reservado até amanhã. Toque no botão abaixo para falar com nosso time e garantir a condição.",
  offerKicker: "Planos",
  offerTitle: "Um plano só. Escolha a periodicidade.",
  offerDescription: "Todo mundo recebe todos os recursos. Quanto maior o período, menor o valor por mês.",
  inclusions: [
    "Configuração assistida do número oficial",
    "Importação e organização das suas listas",
    "Criação dos primeiros templates Meta",
    "Acompanhamento na primeira campanha",
  ],
  socialProofLabel: "Operações que já disparam com o Send Inteligente",
  metrics: [
    { value: "[NÚMERO]", label: "mensagens entregues por mês" },
    { value: "[NÚMERO]", label: "operações comerciais ativas" },
    { value: "[NÚMERO]%", label: "de taxa média de entrega" },
    { value: "[NÚMERO]", label: "minutos para colocar no ar" },
  ],
  testimonials: [
    {
      quote:
        "[SUBSTITUIR: depoimento real de um cliente, citando um resultado concreto — ex.: quantos orçamentos foram recuperados no primeiro mês.]",
      author: "[Nome do cliente]",
      role: "[Cargo] · [Empresa]",
    },
    {
      quote:
        "[SUBSTITUIR: depoimento real focado em segurança e conformidade — ex.: parou de usar API não oficial e nunca mais teve número bloqueado.]",
      author: "[Nome do cliente]",
      role: "[Cargo] · [Empresa]",
    },
    {
      quote:
        "[SUBSTITUIR: depoimento real focado em produtividade — ex.: tempo economizado por semana com campanhas recorrentes.]",
      author: "[Nome do cliente]",
      role: "[Cargo] · [Empresa]",
    },
  ],
  guarantee:
    "[SUBSTITUIR OU REMOVER: descreva aqui a sua garantia real — por exemplo, período de teste, política de reembolso ou compromisso de ativação. Não publique uma garantia que você não pretende honrar.]",
  faq: [
    {
      question: "Preciso ter uma conta na Meta para usar?",
      answer:
        "Sim, o disparo acontece pela sua conta do WhatsApp Business. Na ativação conduzimos tudo com você: conexão do número, verificação do negócio e primeiros templates.",
    },
    {
      question: "Posso usar o número que já uso hoje?",
      answer:
        "Ao migrar para a API Oficial, o número sai do app comum — ele só existe em um lugar por vez. Muita gente mantém o atendimento no número atual e ativa um segundo para campanhas.",
    },
    {
      question: "O custo das conversas está incluso na assinatura?",
      answer:
        "Não. A assinatura cobre a plataforma. As conversas são cobradas pela própria Meta, direto na sua conta, pela tabela oficial dela.",
    },
    {
      question: "Corro risco de ter o número bloqueado?",
      answer:
        "O bloqueio é o risco de quem usa API não oficial. Aqui todo envio passa pela API Oficial, com templates aprovados e opt-out automático de quem responde “SAIR”.",
    },
    {
      question: "Existe limite de mensagens?",
      answer:
        "O limite é o da sua conta na Meta, que sobe conforme a qualidade do número. A plataforma não impõe teto e reenvia sozinha em caso de falha.",
    },
    {
      question: "Consigo integrar com meu CRM ou com o n8n?",
      answer:
        "Sim. Uma API pública com chave própria dispara e consulta status via código — integra com CRM, e-commerce, n8n ou qualquer sistema HTTP.",
    },
  ],
  finalCtaTitle: "Sua próxima campanha pode sair hoje.",
  finalCtaDescription: "Assine, conecte seu número oficial e coloque a primeira campanha no ar com a gente junto.",
};

/**
 * Reconhece conteúdo de exemplo ainda não preenchido — "[SUBSTITUIR: ...]",
 * "[NÚMERO]", "[Nome do cliente]".
 *
 * O texto continua no JSON e visível no editor, servindo de instrução para
 * quem preenche; a landing é que não publica. Métrica ou depoimento inventado
 * é prova social falsa, e "[SUBSTITUIR]" no ar converte pior que a ausência
 * da seção.
 */
export function isPlaceholder(value: string | undefined) {
  return /\[\s*(SUBSTITUIR|N[ÚU]MERO|Nome|Cargo|Empresa)/i.test(value ?? "");
}

const contentPath = path.join(process.cwd(), "data", "site-content.json");

function cleanList(items: string[], fallback: string[]) {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : fallback;
}

function cleanMetrics(items: Metric[], fallback: Metric[]) {
  const cleaned = items
    .map((item) => ({ value: item?.value?.trim() ?? "", label: item?.label?.trim() ?? "" }))
    .filter((item) => item.value && item.label);

  return cleaned.length > 0 ? cleaned : fallback;
}

function cleanTestimonials(items: Testimonial[], fallback: Testimonial[]) {
  const cleaned = items
    .map((item) => ({
      quote: item?.quote?.trim() ?? "",
      author: item?.author?.trim() ?? "",
      role: item?.role?.trim() ?? "",
    }))
    .filter((item) => item.quote && item.author);

  return cleaned.length > 0 ? cleaned : fallback;
}

function cleanFaq(items: FaqItem[], fallback: FaqItem[]) {
  const cleaned = items
    .map((item) => ({ question: item?.question?.trim() ?? "", answer: item?.answer?.trim() ?? "" }))
    .filter((item) => item.question && item.answer);

  return cleaned.length > 0 ? cleaned : fallback;
}

function normalizeContent(content: Partial<SiteContent>): SiteContent {
  return {
    announcement: content.announcement?.trim() ?? defaultSiteContent.announcement,
    heroBadge: content.heroBadge?.trim() || defaultSiteContent.heroBadge,
    heroTitle: content.heroTitle?.trim() || defaultSiteContent.heroTitle,
    heroDescription: content.heroDescription?.trim() || defaultSiteContent.heroDescription,
    primaryCta: content.primaryCta?.trim() || defaultSiteContent.primaryCta,
    secondaryCta: content.secondaryCta?.trim() || defaultSiteContent.secondaryCta,
    proofItems: cleanList(content.proofItems ?? [], defaultSiteContent.proofItems),
    previewCampaign: content.previewCampaign?.trim() || defaultSiteContent.previewCampaign,
    templateMessage: content.templateMessage?.trim() || defaultSiteContent.templateMessage,
    offerKicker: content.offerKicker?.trim() || defaultSiteContent.offerKicker,
    offerTitle: content.offerTitle?.trim() || defaultSiteContent.offerTitle,
    offerDescription: content.offerDescription?.trim() || defaultSiteContent.offerDescription,
    inclusions: cleanList(content.inclusions ?? [], defaultSiteContent.inclusions),
    socialProofLabel: content.socialProofLabel?.trim() || defaultSiteContent.socialProofLabel,
    metrics: cleanMetrics(content.metrics ?? [], defaultSiteContent.metrics),
    testimonials: cleanTestimonials(content.testimonials ?? [], defaultSiteContent.testimonials),
    guarantee: content.guarantee?.trim() ?? defaultSiteContent.guarantee,
    faq: cleanFaq(content.faq ?? [], defaultSiteContent.faq),
    finalCtaTitle: content.finalCtaTitle?.trim() || defaultSiteContent.finalCtaTitle,
    finalCtaDescription: content.finalCtaDescription?.trim() || defaultSiteContent.finalCtaDescription,
  };
}

export async function getSiteContent() {
  try {
    const rawContent = await readFile(contentPath, "utf8");
    return normalizeContent(JSON.parse(rawContent) as Partial<SiteContent>);
  } catch {
    return defaultSiteContent;
  }
}

export async function saveSiteContent(content: SiteContent) {
  await mkdir(path.dirname(contentPath), { recursive: true });
  await writeFile(contentPath, `${JSON.stringify(normalizeContent(content), null, 2)}\n`, "utf8");
}
