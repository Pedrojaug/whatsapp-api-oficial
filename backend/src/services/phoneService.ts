/**
 * Normaliza números de telefone garantindo formato internacional E.164.
 * Para números brasileiros:
 * - 10 dígitos (DDD + 8d): 8386241167 → 5583986241167 (13d)
 * - 11 dígitos (DDD + 9d): 83986241167 → 5583986241167 (13d)
 * - 12 dígitos (55 + DDD + 8d): 558386241167 → 5583986241167 (13d)
 * - 13 dígitos (55 + DDD + 9d): 5583986241167 → 5583986241167 (13d)
 * Números internacionais com DDI permanecem inalterados.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");

  // Já começa com 55 (Brasil)
  if (digits.startsWith("55")) {
    if (digits.length === 12) {
      // 55 + DDD (2) + 8 dígitos -> adiciona o 9
      return digits.slice(0, 4) + "9" + digits.slice(4);
    }
    return digits;
  }

  // Celular brasileiro sem DDI: 11 dígitos (ex: 83 9 8624-1167 -> 83986241167)
  if (digits.length === 11 && /^[1-9]{2}9[0-9]{8}$/.test(digits)) {
    return "55" + digits;
  }

  // Telefone brasileiro sem DDI e sem 9º dígito: 10 dígitos (ex: 83 8624-1167 -> 8386241167)
  if (digits.length === 10 && /^[1-9]{2}[2-9][0-9]{7}$/.test(digits)) {
    return "55" + digits.slice(0, 2) + "9" + digits.slice(2);
  }

  return digits;
}

/** Retorna todas as variantes do número (com e sem 9º dígito, com e sem DDI) para queries. */
export function phoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const digits = phone.replace(/\D/g, "");
  const variants = new Set([phone, digits, normalized]);
  if (normalized.startsWith("55") && normalized.length === 13) {
    // Versão sem o 9º dígito: 558386241167
    variants.add(normalized.slice(0, 4) + normalized.slice(5));
    // Versão sem o 55 com 9: 83986241167
    variants.add(normalized.slice(2));
    // Versão sem o 55 sem 9: 8386241167
    variants.add(normalized.slice(2, 4) + normalized.slice(5));
  }
  return Array.from(variants).filter(Boolean);
}
