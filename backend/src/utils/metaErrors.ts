/**
 * Classificação dos erros da WhatsApp Cloud API para o dispatcher.
 * Referência: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */

// Erros que não mudam com nova tentativa: o payload, o template, o destinatário
// ou a credencial estão errados. Retentar só gasta chamadas e atrasa o FAILED.
const PERMANENT_CODES = new Set<number>([
  10,      // permissão negada
  100,     // parâmetro inválido
  190,     // token expirado/inválido
  200,     // permissão negada
  130472,  // número do destinatário em experimento da Meta
  131008,  // parâmetro obrigatório ausente
  131009,  // valor de parâmetro inválido
  131021,  // destinatário igual ao remetente
  131026,  // mensagem não entregável (número sem WhatsApp, versão antiga etc.)
  131030,  // destinatário fora da lista permitida (número de teste)
  131047,  // fora da janela de 24h
  131051,  // tipo de mensagem não suportado
  133010,  // número do remetente não registrado
]);

// Família 132xxx = erros de template (parâmetros, formato, template pausado/desativado/inexistente).
function isTemplateError(code: number) {
  return code >= 132000 && code < 133000;
}

export function isPermanentMetaError(code: unknown): boolean {
  const n = typeof code === "string" ? parseInt(code, 10) : (code as number);
  if (typeof n !== "number" || Number.isNaN(n)) return false;
  return PERMANENT_CODES.has(n) || isTemplateError(n);
}

/**
 * Mensagem para gravar no errorMessage: inclui o `error_data.details`, que é onde
 * a Meta diz qual componente falhou (ex.: "header: Format mismatch, expected IMAGE, received UNKNOWN").
 */
export function formatMetaError(metaError: any, fallback: string): string {
  const message: string = metaError?.message || fallback;
  const details: string | undefined = metaError?.error_data?.details;
  if (details && !message.includes(details)) return `${message} — ${details}`;
  return message;
}
