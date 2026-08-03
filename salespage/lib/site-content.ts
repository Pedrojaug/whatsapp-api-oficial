import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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
};

export const defaultSiteContent: SiteContent = {
  announcement: "Oferta especial para operações comerciais que querem vender mais pelo WhatsApp.",
  heroBadge: "WhatsApp Business API Oficial",
  heroTitle: "Dispare campanhas no WhatsApp com uma estrutura feita para vender.",
  heroDescription:
    "O Send Inteligente centraliza listas, templates aprovados pela Meta, envios em escala e acompanhamento de entrega em um painel claro para times comerciais.",
  primaryCta: "Quero vender pelo WhatsApp",
  secondaryCta: "Ver o que inclui",
  proofItems: ["API Oficial da Meta", "Templates aprovados", "Checkout Asaas"],
  previewCampaign: "Recuperação de orçamentos",
  templateMessage:
    "Olá, {{nome}}. Seu atendimento está pronto para continuar. Clique no botão abaixo para falar com nosso time.",
  offerKicker: "Oferta de implantação",
  offerTitle: "Comece com o Send Inteligente pronto para sua primeira campanha.",
  offerDescription:
    "Assine, conclua o pagamento pelo Asaas e receba o fluxo de boas-vindas com os próximos passos para ativar sua operação de disparos.",
  inclusions: [
    "Configuração inicial do ambiente",
    "Organização de listas e tags",
    "Orientação para templates Meta",
    "Boas-vindas automatizadas após pagamento",
  ],
};

const contentPath = path.join(process.cwd(), "data", "site-content.json");

function cleanList(items: string[], fallback: string[]) {
  const cleaned = items.map((item) => item.trim()).filter(Boolean);
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
