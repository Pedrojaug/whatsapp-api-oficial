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
  announcement: "Infraestrutura Oficial Meta Cloud v19 • Disparos sem Bloqueios e Implantação Assistida",
  heroBadge: "Meta WhatsApp Cloud API v19",
  heroTitle: "Dispare campanhas no WhatsApp com a estabilidade da API Oficial da Meta.",
  heroDescription:
    "A plataforma direta e robusta para empresas que precisam de envios em escala com templates homologados, opt-out automático (LGPD), links rastreáveis e integração nativa via n8n e REST API.",
  primaryCta: "Ver Planos de Acesso",
  secondaryCta: "Comparativo Oficial vs Paralelas",
  proofItems: [
    "Conexão direta Meta Cloud API v19",
    "Opt-out e Blacklist Automático",
    "Integração n8n & REST API",
    "Implantação e Suporte Próximo",
  ],
  previewCampaign: "Campanha de Recuperação & Avisos",
  templateMessage:
    "Olá, {{nome}}! Seu pedido #{{codigo}} foi confirmado. Para acompanhar o envio ou falar com nosso suporte, clique no botão abaixo.",
  offerKicker: "Acesso & Implantação",
  offerTitle: "Estrutura completa com suporte direto na configuração",
  offerDescription:
    "Sem burocracia corporativa ou contratos anuais amarrados: ativamos seu número oficial, organizamos seus primeiros templates e deixamos sua operação pronta para rodar.",
  inclusions: [
    "Acesso completo ao Painel Send Inteligentte",
    "Configuração assistida do número e Meta Cloud API",
    "Modelos de templates homologados pela Meta",
    "Links encurtados rastreáveis com métricas de cliques (/t/)",
    "Filtro inteligente de opt-out e blacklist (LGPD)",
    "Chave de API dedicada e templates prontos para n8n",
    "Relatórios claros de disparados, entregues e lidos",
  ],
  faqs: [
    {
      question: "Qual a diferença entre o Send Inteligentte e disparadores não oficiais (por QR Code)?",
      answer:
        "Disparadores não oficiais usam emulação de navegador ou bibliotecas como Baileys, violando os termos do WhatsApp e gerando banimento rápido do chip. O Send Inteligentte opera 100% conectado à API Oficial da Meta (Cloud API v19): as mensagens trafegam pelos servidores homologados pelo WhatsApp, garantindo alta entrega, estabilidade 24/7 sem celular ligado e total segurança para a sua marca.",
    },
    {
      question: "Posso utilizar meu número de WhatsApp atual?",
      answer:
        "Sim! Caso seu número já esteja em uso no aplicativo comum ou Business, auxiliamos na migração para a API Oficial. Também é possível ativar números novos, fixos ou 0800 diretamente no seu Meta Business Manager durante o onboarding.",
    },
    {
      question: "Como funcionam os custos de envio cobrados pela Meta?",
      answer:
        "A Meta disponibiliza mensalmente 1.000 conversas de serviço gratuitas para cada conta. Para mensagens ativas de marketing e utilidade iniciadas pela empresa, a Meta cobra uma pequena taxa oficial diretamente no cartão cadastrado no seu Gerenciador de Negócios da Meta. Nosso plano cobre toda a plataforma, infraestrutura de envio, links rastreáveis e suporte.",
    },
    {
      question: "Como funciona a implantação assistida?",
      answer:
        "Como nosso software está em constante evolução e valorizamos o sucesso de cada parceiro, fazemos questão de acompanhar os primeiros passos da sua conta: ajudamos a vincular seu Meta Business Manager, cadastrar seu número oficial e aprovar seus primeiros templates de campanha.",
    },
    {
      question: "Como integro o Send Inteligentte com n8n, Make, Typebot ou meu CRM?",
      answer:
        "Disponibilizamos uma API REST pública e segura em /api/v1 autenticada por API Key, além de webhooks de status de entrega. Você recebe templates de fluxo prontos para n8n para plugar formulários, Typebot, HubSpot, RD Station ou qualquer outro sistema em poucos cliques.",
    },
    {
      question: "Preciso manter o celular ligado à internet durante os disparos?",
      answer:
        "Não. Toda a infraestrutura roda 100% em nuvem. As mensagens são enfileiradas e processadas de forma assíncrona com controle de taxa e retentativas automáticas, funcionando mesmo com seu computador ou celular desligados.",
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
