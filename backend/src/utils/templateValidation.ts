/**
 * Checagem prévia de compatibilidade entre um template da Meta e o que o
 * dispatcher vai enviar (mídia de cabeçalho e variáveis do corpo).
 *
 * Roda antes de enfileirar uma campanha: um template incompatível derruba
 * todas as mensagens com o mesmo erro (ex.: #132012 quando falta a mídia do
 * cabeçalho), então é melhor barrar a execução inteira com um motivo claro.
 */

const MEDIA_FORMATS: Record<string, string> = {
  IMAGE: "uma imagem",
  VIDEO: "um vídeo",
  DOCUMENT: "um documento",
};

export interface TemplateLike {
  name: string;
  status?: string | null;
  components?: unknown;
}

export interface CampaignSendConfig {
  /** Mapeamentos de variáveis da campanha (CONTACT_NAME, STATIC:valor, ...). */
  variables?: unknown;
  mediaUrl?: string | null;
}

function findComponent(components: any[], type: string) {
  return components.find((c: any) => String(c?.type || "").toUpperCase() === type);
}

/** Variáveis posicionais distintas ({{1}}, {{2}}) presentes no texto. */
export function countPositionalVars(text: string | undefined | null): number {
  const matches = (text || "").match(/\{\{\s*\d+\s*\}\}/g);
  return matches ? new Set(matches.map((m) => m.replace(/\s/g, ""))).size : 0;
}

/** Variáveis nomeadas ({{nome}}), que o dispatcher ainda não envia. */
export function hasNamedVars(text: string | undefined | null): boolean {
  return /\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}/.test(text || "");
}

/**
 * Retorna a lista de problemas que impedem o envio. Lista vazia = pode enviar.
 */
export function validateTemplateForCampaign(
  template: TemplateLike | null | undefined,
  campaign: CampaignSendConfig
): string[] {
  if (!template) {
    return ["Template não encontrado nesta conta. Sincronize os templates na aba Templates."];
  }

  const problems: string[] = [];
  const components: any[] = Array.isArray(template.components) ? (template.components as any[]) : [];

  if (template.status && template.status !== "APPROVED") {
    problems.push(`O template "${template.name}" não está aprovado pela Meta (status: ${template.status}).`);
  }

  // Cabeçalho
  const header = findComponent(components, "HEADER");
  const headerFormat = String(header?.format || "").toUpperCase();
  if (MEDIA_FORMATS[headerFormat] && !campaign.mediaUrl?.trim()) {
    problems.push(
      `O template "${template.name}" exige ${MEDIA_FORMATS[headerFormat]} no cabeçalho, mas a campanha está sem mídia. Escolha a mídia na campanha antes de ativar.`
    );
  }
  if (headerFormat === "TEXT" && (countPositionalVars(header?.text) > 0 || hasNamedVars(header?.text))) {
    problems.push("Templates com variável no cabeçalho de texto ainda não são suportados em campanhas.");
  }

  // Corpo
  const body = findComponent(components, "BODY");
  if (hasNamedVars(body?.text)) {
    problems.push("Templates com variáveis nomeadas (ex.: {{nome}}) ainda não são suportados. Use variáveis numeradas ({{1}}, {{2}}).");
  } else {
    const expected = countPositionalVars(body?.text);
    const mappings: unknown[] = Array.isArray(campaign.variables) ? campaign.variables : [];
    if (mappings.length !== expected) {
      problems.push(
        `O template espera ${expected} variável(is) no corpo, mas a campanha tem ${mappings.length} mapeada(s). Edite a campanha e refaça o mapeamento.`
      );
    } else {
      mappings.forEach((m, idx) => {
        if (m === "STATIC_VALUE" || (typeof m === "string" && m.startsWith("STATIC:") && !m.slice(7).trim())) {
          problems.push(`A variável {{${idx + 1}}} está como valor fixo, mas sem valor preenchido.`);
        }
      });
    }
  }

  // Botões com parâmetro dinâmico (URL com {{1}}, copiar código)
  const buttons = findComponent(components, "BUTTONS");
  const dynamicButton = Array.isArray(buttons?.buttons)
    ? buttons.buttons.some(
        (b: any) =>
          (String(b?.type).toUpperCase() === "URL" && /\{\{.+?\}\}/.test(b?.url || "")) ||
          String(b?.type).toUpperCase() === "COPY_CODE"
      )
    : false;
  if (dynamicButton) {
    problems.push("Templates com botão dinâmico (URL com variável ou copiar código) ainda não são suportados em campanhas.");
  }

  return problems;
}
