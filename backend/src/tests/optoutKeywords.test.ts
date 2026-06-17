import { describe, it, expect } from "vitest";
import { isOptOutMessage } from "../utils/optoutKeywords";

describe("isOptOutMessage", () => {
  it("reconhece 'STOP' (maiúsculas)", () => {
    expect(isOptOutMessage("STOP")).toBe(true);
  });

  it("reconhece 'stop' (minúsculas)", () => {
    expect(isOptOutMessage("stop")).toBe(true);
  });

  it("reconhece 'parar' com acento normalizado", () => {
    expect(isOptOutMessage("parar")).toBe(true);
  });

  it("reconhece 'cancelar'", () => {
    expect(isOptOutMessage("cancelar")).toBe(true);
  });

  it("reconhece 'não quero' com espaços e acento", () => {
    expect(isOptOutMessage("não quero")).toBe(true);
  });

  it("reconhece 'nao quero' sem acento", () => {
    expect(isOptOutMessage("nao quero")).toBe(true);
  });

  it("ignora mensagem normal", () => {
    expect(isOptOutMessage("Olá, quero saber mais!")).toBe(false);
  });

  it("ignora mensagem vazia", () => {
    expect(isOptOutMessage("")).toBe(false);
  });

  it("ignora mensagem com keyword embutida no meio", () => {
    expect(isOptOutMessage("quero parar de fumar")).toBe(false);
  });
});
