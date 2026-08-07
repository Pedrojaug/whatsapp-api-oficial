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
  faqs: FaqItem[];
};

export const defaultSiteContent: SiteContent = {
  announcement: "🚀 API Oficial Meta Cloud v19 • Estrutura de Alta Conversão sem Risco de Banimento",
  heroBadge: "WhatsApp Business Cloud API Oficial",
  heroTitle: "Dispare campanhas no WhatsApp com 0% de risco de banimento.",
  heroDescription:
    "O Send Inteligentte une a API Oficial da Meta, disparos em massa automatizados, encurtador de links rastreável e integração simples via n8n e REST API para escalar suas vendas com segurança total.",
  primaryCta: "Escolher meu Plano",
  secondaryCta: "Ver Comparativo Meta",
  proofItems: ["✓ 100% API Oficial Meta", "✓ Links Rastreáveis", "✓ Integração n8n & API Key", "✓ Checkout Seguro Asaas"],
  previewCampaign: "Recuperação de Vendas de Alta Conversão",
  templateMessage:
    "Olá, {{nome}}! Notei que você deixou itens no carrinho. Preparamos uma condição especial exclusiva para você hoje. Clique no botão abaixo para garantir!",
  offerKicker: "Planos de Implantação e Assinatura",
  offerTitle: "Escolha a estrutura ideal para a sua operação",
  offerDescription:
    "Ativação rápida, sem fidelidade oculta e com infraestrutura em nuvem pronta para disparar milhares de mensagens com máxima entregabilidade.",
  inclusions: [
    "Acesso imediato ao Dashboard Send Inteligentte",
    "Conexão direta via Meta Cloud API v19",
    "Links rastreáveis com estatísticas de clique",
    "Blacklist e Opt-out automático (Anti-Spam)",
    "API Key dedicada e suporte a n8n / Webhooks",
    "Relatórios detalhados de disparados, entregues e lidos",
  ],
  faqs: [
    {
      question: "O Send Inteligentte corre o risco de banir meu número de WhatsApp?",
      answer:
        "Não! Diferente de disparadores não oficiais (que usam automação por navegador ou Baileys e banem seu chip em poucos dias), o Send Inteligentte opera exclusivamente com a Meta WhatsApp Business Cloud API v19. Todas as mensagens trafegam pelos servidores oficiais da Meta com 100% de segurança.",
    },
    {
      question: "Como funcionam os custos da Meta pelas mensagens?",
      answer:
        "A Meta oferece 1.000 conversas de atendimento (iniciadas pelo cliente) totalmente gratuitas todos os meses. Para mensagens ativas de campanhas (iniciadas pela empresa), a Meta cobra uma pequena tarifa por conversa diretamente no seu Meta Business Manager.",
    },
    {
      question: "Consigo integrar o Send Inteligentte com n8n, Make, Typebot ou meu CRM?",
      answer:
        "Sim! O Send possui uma API REST pública em `/api/v1` protegida por API Key e suporte a Webhooks. Disponibilizamos templates de workflow prontos para n8n para você conectar seu CRM ou funil de vendas em minutos.",
    },
    {
      question: "Preciso manter o celular ligado à internet durante os disparos?",
      answer:
        "Não! Como a integração roda em nuvem através da API Oficial da Meta, seus disparos e campanhas são executados 24/7 de forma 100% independente do seu aparelho celular ou conexão de internet.",
    },
    {
      question: "Como funciona o rastreamento de links das campanhas?",
      answer:
        "Cada link inserido na sua campanha pode ser encurtado com o nosso sistema nativo `/t/:shortCode`. Quando o contato clica no WhatsApp, registramos o clique em tempo real no seu painel para você saber exatamente quem respondeu ao CTA.",
    },
    {
      question: "Como é feita a ativação da minha conta após o pagamento?",
      answer:
        "O pagamento é processado via Asaas (Pix ou Cartão de Crédito). Assim que confirmado, você recebe as instruções instantâneas no seu e-mail e WhatsApp para acessar o painel e conectar sua conta da Meta.",
    },
  ],
};

const contentFilePath = path.join(process.cwd(), "data", "landing-content.json");

export async function getSiteContent(): Promise<SiteContent> {
  try {
    const raw = await readFile(contentFilePath, "utf-8");
    return { ...defaultSiteContent, ...JSON.parse(raw) };
  } catch {
    return defaultSiteContent;
  }
}

export async function saveSiteContent(content: SiteContent): Promise<void> {
  await mkdir(path.dirname(contentFilePath), { recursive: true });
  await writeFile(contentFilePath, JSON.stringify(content, null, 2), "utf-8");
}
