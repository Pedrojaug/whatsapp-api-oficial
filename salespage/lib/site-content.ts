import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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
  faqs?: FaqItem[];
};

export const defaultSiteContent: Required<SiteContent> = {
  announcement: "Infraestrutura Oficial do WhatsApp • Campanhas Estáveis e Onboarding Assistido",
  heroBadge: "API Oficial do WhatsApp",
  heroTitle: "Seu WhatsApp comercial. Sem depender de celular, QR Code ou improviso.",
  heroDescription:
    "O Send Inteligentte coloca suas campanhas para rodar pela API oficial do WhatsApp, com gestão de contatos, templates homologados, automações e acompanhamento de entregas em um só lugar.",
  primaryCta: "Quero começar",
  secondaryCta: "Ver como funciona",
  proofItems: [
    "API oficial do WhatsApp",
    "Disparos programados em nuvem",
    "Opt-out automático (LGPD)",
    "Integração via REST API & n8n",
  ],
  previewCampaign: "Campanha Promocional & Avisos",
  templateMessage:
    "Olá, {{nome}}! Seu pedido #{{codigo}} foi confirmado. Para acompanhar o envio ou falar com nosso atendimento, clique no botão abaixo.",
  offerKicker: "Previsibilidade & Estrutura",
  offerTitle: "Não vendemos disparo. Vendemos previsibilidade.",
  offerDescription:
    "Seu time não precisa pensar em sessão, QR Code, celular conectado ou infraestrutura de envio. Você define a campanha; o Send Inteligentte cuida da operação com acompanhamento assistido.",
  inclusions: [
    "Acesso completo ao painel operacional Send Inteligentte",
    "Configuração assistida do número e WhatsApp Cloud API",
    "Auxílio na criação e aprovação de templates homologados",
    "Links rastreáveis com métricas de cliques (/t/:slug)",
    "Identificação e blacklist automática de descadastro (LGPD)",
    "Chave de API dedicada e webhooks para integração com CRM",
    "Acompanhamento e suporte humano direto com nossa equipe",
  ],
  faqs: [
    {
      question: "Preciso deixar o celular ligado?",
      answer: "Não. Tudo roda na nuvem da Meta, com seu celular e computador desligados.",
    },
    {
      question: "Posso usar meu número atual?",
      answer: "Sim, e nós fazemos a migração com você. Números novos, fixos e 0800 também funcionam.",
    },
    {
      question: "Meu número ainda pode ser bloqueado?",
      answer:
        "O risco cai muito: você usa o canal oficial, com mensagens aprovadas pela Meta e descadastro automático. E a gente te mostra as boas práticas desde o começo.",
    },
    {
      question: "Não entendo nada de tecnologia. Consigo usar?",
      answer:
        "Consegue. Nossa equipe faz a configuração com você e aprova suas primeiras mensagens. Depois, é subir a planilha e enviar.",
    },
  ],
};

const contentFilePath = path.join(process.cwd(), "data", "landing-content.json");

export async function getSiteContent(): Promise<Required<SiteContent>> {
  try {
    const raw = await readFile(contentFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      ...defaultSiteContent,
      ...parsed,
      faqs: parsed.faqs && parsed.faqs.length > 0 ? parsed.faqs : defaultSiteContent.faqs,
    };
  } catch {
    return defaultSiteContent;
  }
}

export async function saveSiteContent(content: Partial<SiteContent>): Promise<void> {
  const current = await getSiteContent();
  const merged = { ...current, ...content };
  await mkdir(path.dirname(contentFilePath), { recursive: true });
  await writeFile(contentFilePath, JSON.stringify(merged, null, 2), "utf-8");
}
