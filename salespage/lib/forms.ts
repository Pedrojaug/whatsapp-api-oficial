/**
 * Máscaras e validações dos campos do checkout.
 * Validar CPF/CNPJ aqui evita que dado inválido chegue no Asaas e vire
 * cobrança recusada depois do usuário já ter saído da página.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d{0,2})/, "($1");
  if (d.length <= 6) return d.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function maskDocument(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) {
      sum += Number(cpf[i]) * (slice + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digit = (slice: number) => {
    const weights =
      slice === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < slice; i++) {
      sum += Number(cnpj[i]) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export type CheckoutFields = {
  name: string;
  email: string;
  whatsapp: string;
  document: string;
  acceptedTerms: boolean;
};

export type CheckoutErrors = Partial<Record<keyof CheckoutFields, string>>;

export function validateCheckout(fields: CheckoutFields): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (fields.name.trim().length < 3) {
    errors.name = "Informe seu nome completo.";
  } else if (!fields.name.trim().includes(" ")) {
    errors.name = "Inclua o sobrenome.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }

  const phone = onlyDigits(fields.whatsapp);
  if (phone.length < 10 || phone.length > 11) {
    errors.whatsapp = "Informe o DDD e o número completo.";
  }

  const doc = onlyDigits(fields.document);
  if (doc.length !== 11 && doc.length !== 14) {
    errors.document = "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).";
  } else if (doc.length === 11 && !isValidCpf(doc)) {
    errors.document = "CPF inválido — confira os números.";
  } else if (doc.length === 14 && !isValidCnpj(doc)) {
    errors.document = "CNPJ inválido — confira os números.";
  }

  if (!fields.acceptedTerms) {
    errors.acceptedTerms = "É necessário aceitar os termos para continuar.";
  }

  return errors;
}
