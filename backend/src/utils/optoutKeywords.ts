const OPT_OUT_KEYWORDS = new Set([
  "stop", "parar", "para", "cancelar", "sair", "remover",
  "descadastrar", "descadastre", "desinscrever", "desinscreverm",
  "nao quero", "nao quero mais", "chega", "pare",
  "cancelamento", "opt out", "optout", "unsubscribe",
  "nao me mande", "nao mande mais", "nao envie mais",
]);

/** Expressões ou frases indicativas de recusa, engano ou falta de consentimento */
const OPT_OUT_PHRASES = [
  "nao me inscrevi",
  "nunca me inscrevi",
  "nao sei que curso",
  "numero errado",
  "numero trocado",
  "engano",
  "foi engano",
  "e engano",
  "tire meu numero",
  "apague meu numero",
  "apagar meu numero",
  "me tire",
  "me remova",
  "me descadastre",
  "favor nao enviar",
  "favor nao mandar",
  "nao tenho interesse",
  "sem interesse",
  "nao autorizei",
  "nao solicitei",
];

/** Remove acentos e normaliza para minúsculas para comparação. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Retorna true se o texto da mensagem é um pedido de opt-out ou recusa clara.
 */
export function isOptOutMessage(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);

  if (OPT_OUT_KEYWORDS.has(normalized)) {
    return true;
  }

  for (const phrase of OPT_OUT_PHRASES) {
    if (normalized.includes(phrase)) {
      return true;
    }
  }

  return false;
}
