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
  announcement: "Ativação assistida incluída — sua primeira campanha no ar ainda esta semana.",
  heroBadge: "WhatsApp Business API Oficial da Meta",
  heroTitle: "Dispare campanhas no WhatsApp *sem arriscar o seu número*.",
  heroDescription:
    "O Send Inteligente é a plataforma de disparo em massa pela API Oficial da Meta: listas segmentadas, templates aprovados, campanhas recorrentes e métricas de entrega em tempo real — com opt-out automático para manter sua operação dentro da LGPD.",
  primaryCta: "Quero ativar minha conta",
  secondaryCta: "Ver como funciona",
  proofItems: ["API Oficial da Meta", "Opt-out automático (LGPD)", "Suporte na ativação"],
  previewCampaign: "Recuperação de orçamentos",
  templateMessage:
    "Olá, {{nome}}. Seu orçamento continua reservado até amanhã. Toque no botão abaixo para falar com nosso time e garantir a condição.",
  offerKicker: "Escolha seu plano",
  offerTitle: "Um preço só. Disparos, automações e relatórios inclusos.",
  offerDescription:
    "Sem taxa de setup e sem cobrança por usuário. Você assina, conecta seu número oficial e já começa a disparar — quanto maior o período, menor o valor por mês.",
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
        "Sim, o disparo acontece pela sua própria conta do WhatsApp Business na Meta. Na ativação nós conduzimos esse processo com você: conexão do número, verificação do negócio e criação dos primeiros templates.",
    },
    {
      question: "Posso usar o número que já uso hoje?",
      answer:
        "Um número só pode estar em um lugar por vez: ao migrar para a API Oficial, ele deixa de funcionar no aplicativo do WhatsApp comum. Muitas operações preferem manter o número de atendimento no app e ativar um segundo número para as campanhas. Avaliamos o seu caso na ativação.",
    },
    {
      question: "O custo das conversas está incluso na assinatura?",
      answer:
        "Não. A assinatura do Send Inteligente cobre a plataforma — disparos, automações, listas, templates e relatórios. As conversas são cobradas pela própria Meta, direto na sua conta, conforme a tabela oficial dela por país e categoria de mensagem.",
    },
    {
      question: "Corro risco de ter o número bloqueado?",
      answer:
        "O bloqueio é o risco típico de quem dispara por API não oficial. Aqui todo envio passa pela API Oficial da Meta, com templates previamente aprovados e opt-out automático: quem responde “SAIR” ou “PARAR” é removido da base e deixa de receber disparos imediatamente.",
    },
    {
      question: "Existe limite de mensagens?",
      answer:
        "O limite é o da sua própria conta na Meta, que aumenta conforme a qualidade e o histórico do seu número. A plataforma não impõe teto de disparos e trabalha com fila e reenvio automático em caso de falha temporária.",
    },
    {
      question: "Consigo integrar com meu CRM ou com o n8n?",
      answer:
        "Sim. Além do painel, existe uma API pública com chave própria para disparar mensagens e consultar status de forma programática — o que permite integrar com CRM, e-commerce, n8n ou qualquer sistema que faça requisições HTTP.",
    },
  ],
  finalCtaTitle: "Sua próxima campanha pode sair hoje.",
  finalCtaDescription:
    "Assine, conecte seu número oficial e conte com a nossa ativação assistida para colocar a primeira campanha no ar sem travar em detalhe técnico.",
};

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
