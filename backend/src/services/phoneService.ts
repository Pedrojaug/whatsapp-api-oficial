/**
 * Normaliza números brasileiros para sempre usar 13 dígitos (com o 9º dígito).
 * Ex: 558386241167 (12d) → 5583986241167 (13d)
 * Evita conversas duplicadas causadas pela transição do 9º dígito no Brasil.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Brasil: 55 + DDD(2) + número — sem o 9 = 12 dígitos, com o 9 = 13 dígitos
  if (digits.startsWith("55") && digits.length === 12) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

/** Retorna ambas as variantes do número (com e sem 9º dígito) para queries. */
export function phoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const digits = phone.replace(/\D/g, "");
  const variants = new Set([phone, digits, normalized]);
  if (normalized.startsWith("55") && normalized.length === 13) {
    variants.add(normalized.slice(0, 4) + normalized.slice(5)); // versão sem o 9
  }
  return Array.from(variants);
}
