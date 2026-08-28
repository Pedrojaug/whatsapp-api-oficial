import { describe, it, expect } from "vitest";
import { normalizePhone, phoneVariants } from "../services/phoneService";

describe("normalizePhone", () => {
  it("adiciona 9º dígito em número BR de 12 dígitos (55 + DDD + 8d)", () => {
    expect(normalizePhone("558386241167")).toBe("5583986241167");
  });

  it("mantém número BR de 13 dígitos inalterado", () => {
    expect(normalizePhone("5583986241167")).toBe("5583986241167");
  });

  it("adiciona DDI 55 em número BR de 11 dígitos (DDD + 9d)", () => {
    expect(normalizePhone("83993875369")).toBe("5583993875369");
    expect(normalizePhone("77988380867")).toBe("5577988380867");
  });

  it("adiciona DDI 55 e 9º dígito em número BR de 10 dígitos (DDD + 8d)", () => {
    expect(normalizePhone("8386241167")).toBe("5583986241167");
  });

  it("remove caracteres não numéricos e formata corretamente", () => {
    expect(normalizePhone("+55 (83) 9 8624-1167")).toBe("5583986241167");
    expect(normalizePhone("(83) 98624-1167")).toBe("5583986241167");
    expect(normalizePhone("(83) 8624-1167")).toBe("5583986241167");
  });

  it("não altera número internacional sem prefixo 55", () => {
    expect(normalizePhone("12025550179")).toBe("12025550179");
  });

  it("retorna string vazia para entrada vazia ou inválida", () => {
    expect(normalizePhone("")).toBe("");
  });
});

describe("phoneVariants", () => {
  it("retorna variantes completas (com/sem 9, com/sem DDI 55) para BR", () => {
    const variants = phoneVariants("5583986241167");
    expect(variants).toContain("5583986241167"); // 13d (55 + 9)
    expect(variants).toContain("558386241167");  // 12d (55 sem 9)
    expect(variants).toContain("83986241167");   // 11d (sem 55 com 9)
    expect(variants).toContain("8386241167");    // 10d (sem 55 sem 9)
  });

  it("retorna ao menos a própria versão normalizada", () => {
    const variants = phoneVariants("83986241167");
    expect(variants).toContain("5583986241167");
  });
});
