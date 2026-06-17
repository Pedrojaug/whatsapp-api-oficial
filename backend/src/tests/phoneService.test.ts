import { describe, it, expect } from "vitest";
import { normalizePhone, phoneVariants } from "../services/phoneService";

describe("normalizePhone", () => {
  it("adiciona 9º dígito em número BR de 12 dígitos", () => {
    expect(normalizePhone("558386241167")).toBe("5583986241167");
  });

  it("mantém número BR de 13 dígitos inalterado", () => {
    expect(normalizePhone("5583986241167")).toBe("5583986241167");
  });

  it("remove caracteres não numéricos", () => {
    expect(normalizePhone("+55 (83) 9 8624-1167")).toBe("5583986241167");
  });

  it("não altera número internacional sem prefixo 55", () => {
    expect(normalizePhone("12025550179")).toBe("12025550179");
  });
});

describe("phoneVariants", () => {
  it("retorna variantes com e sem 9º dígito para BR", () => {
    const variants = phoneVariants("5583986241167");
    expect(variants).toContain("5583986241167"); // com 9
    expect(variants).toContain("558386241167");  // sem 9
  });

  it("retorna ao menos a própria versão normalizada", () => {
    const variants = phoneVariants("558386241167");
    expect(variants).toContain("5583986241167");
  });
});
