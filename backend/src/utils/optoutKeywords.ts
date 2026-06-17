const OPT_OUT_KEYWORDS = new Set([
  "stop", "parar", "para", "cancelar", "sair", "remover",
  "descadastrar", "descadastre", "desinscrever", "desinscreverm",
  "nao quero", "nao quero mais", "chega", "pare",
  "cancelamento", "opt out", "optout", "unsubscribe",
  "nao me mande", "nao mande mais", "nao envie mais",
]);

/** Remove acentos e normaliza para minúsculas para comparação. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Retorna true se o texto da mensagem é um pedido de opt-out.
 * Compara a mensagem normalizada (sem acentos, minúsculas) com a lista de keywords.
 */
export function isOptOutMessage(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return OPT_OUT_KEYWORDS.has(normalized);
}
