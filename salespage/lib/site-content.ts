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
      question: "Preciso manter o celular ligado à internet durante os disparos?",
      answer:
        "Não. Toda a infraestrutura roda 100% em nuvem. As mensagens trafegam diretamente pelos servidores oficiais da Meta, funcionando mesmo com seu computador e celular desligados.",
    },
    {
      question: "A API é oficial do WhatsApp?",
      answer:
        "Sim. A operação utiliza a infraestrutura oficial do WhatsApp Business Platform (Meta Cloud API). Isso elimina o risco de banimento de chip comum em disparadores não oficiais por emulação de QR Code.",
    },
    {
      question: "Posso utilizar meu número de telefone atual?",
      answer:
        "Sim! Se o seu número já estiver no WhatsApp comum ou Business, auxiliamos na migração para a API Oficial. Você também pode ativar números novos, fixos ou 0800 diretamente no seu Meta Business Manager.",
    },
    {
      question: "Como integro o Send Inteligentte com n8n, Make ou meu CRM?",
      answer:
        "Disponibilizamos uma API REST pública e segura autenticada por API Key, além de webhooks em tempo real de eventos de entrega, leitura e cliques em links. Você também recebe templates prontos de fluxo para n8n.",
    },
    {
      question: "Consigo acompanhar os resultados de entrega das minhas campanhas?",
      answer:
        "Sim. O painel exibe detalhadamente quais contatos receberam, leram e clicaram nos links das suas mensagens, além de registrar automaticamente qualquer pedido de descadastro.",
    },
    {
      question: "Vocês ajudam na configuração inicial (onboarding)?",
      answer:
        "Sim! Nossa equipe acompanha os primeiros passos da sua conta: ajudamos a vincular seu Meta Business Manager, configurar seu número oficial e homologar seus primeiros templates de campanha.",
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
