import { describe, it, expect } from "vitest";
import { validateTemplateForCampaign, countPositionalVars, hasNamedVars } from "../utils/templateValidation";
import { isPermanentMetaError, formatMetaError } from "../utils/metaErrors";

// Mesmo formato do template send_inteligentte_novembro, que derrubou a campanha de 03/11
const imageHeaderTemplate = {
  name: "send_inteligentte_novembro",
  status: "APPROVED",
  components: [
    { type: "HEADER", format: "IMAGE", example: { header_handle: ["x"] } },
    { type: "BODY", text: "Oi! Texto fixo sem variáveis." },
    { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Quero sim" }, { type: "QUICK_REPLY", text: "Agora não" }] },
  ],
};

describe("validateTemplateForCampaign", () => {
  it("barra template com cabeçalho IMAGE quando a campanha está sem mídia", () => {
    const problems = validateTemplateForCampaign(imageHeaderTemplate, { variables: [], mediaUrl: null });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("exige uma imagem");
  });

  it("libera o mesmo template quando há mídia", () => {
    expect(validateTemplateForCampaign(imageHeaderTemplate, { variables: [], mediaUrl: "https://x/img.jpg" })).toEqual([]);
  });

  it("barra template inexistente ou não aprovado", () => {
    expect(validateTemplateForCampaign(null, {})[0]).toContain("não encontrado");
    const paused = { ...imageHeaderTemplate, status: "PAUSED" };
    expect(validateTemplateForCampaign(paused, { mediaUrl: "https://x" })[0]).toContain("não está aprovado");
  });

  it("confere a quantidade de variáveis do corpo", () => {
    const tpl = { name: "t", status: "APPROVED", components: [{ type: "BODY", text: "Olá {{1}}, seu código é {{2}}. {{1}}" }] };
    expect(validateTemplateForCampaign(tpl, { variables: ["CONTACT_NAME", "CONTACT_VAR_1"] })).toEqual([]);
    expect(validateTemplateForCampaign(tpl, { variables: ["CONTACT_NAME"] })[0]).toContain("espera 2");
    expect(validateTemplateForCampaign(tpl, { variables: null })[0]).toContain("espera 2");
  });

  it("barra valor fixo vazio", () => {
    const tpl = { name: "t", status: "APPROVED", components: [{ type: "BODY", text: "Olá {{1}} {{2}}" }] };
    const problems = validateTemplateForCampaign(tpl, { variables: ["STATIC:", "STATIC_VALUE"] });
    expect(problems).toHaveLength(2);
  });

  it("barra variáveis nomeadas, cabeçalho de texto com variável e botão dinâmico", () => {
    const named = { name: "t", status: "APPROVED", components: [{ type: "BODY", text: "Olá {{nome}}" }] };
    expect(validateTemplateForCampaign(named, { variables: [] })[0]).toContain("nomeadas");

    const textHeader = { name: "t", status: "APPROVED", components: [{ type: "HEADER", format: "TEXT", text: "Oi {{1}}" }, { type: "BODY", text: "x" }] };
    expect(validateTemplateForCampaign(textHeader, { variables: [] })[0]).toContain("cabeçalho de texto");

    const urlButton = {
      name: "t", status: "APPROVED",
      components: [{ type: "BODY", text: "x" }, { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver", url: "https://site.com/{{1}}" }] }],
    };
    expect(validateTemplateForCampaign(urlButton, { variables: [] })[0]).toContain("botão dinâmico");
  });

  it("contadores de variáveis", () => {
    expect(countPositionalVars("{{1}} {{2}} {{1}}")).toBe(2);
    expect(countPositionalVars(undefined)).toBe(0);
    expect(hasNamedVars("Olá {{nome_cliente}}")).toBe(true);
    expect(hasNamedVars("Olá {{1}}")).toBe(false);
  });
});

describe("isPermanentMetaError", () => {
  it("trata erros de template (132xxx), parâmetro e token como permanentes", () => {
    for (const code of [132012, 132000, 132001, 132015, 100, 190, 131008, 131026, 131047]) {
      expect(isPermanentMetaError(code)).toBe(true);
    }
  });

  it("mantém retentativa para limites de taxa e indisponibilidade", () => {
    for (const code of [4, 80007, 130429, 131048, 131056, 131000, 131016, 131049, undefined, "abc"]) {
      expect(isPermanentMetaError(code)).toBe(false);
    }
  });
});

describe("formatMetaError", () => {
  it("anexa o error_data.details da Meta", () => {
    const err = {
      message: "(#132012) Parameter format does not match format in the created template",
      code: 132012,
      error_data: { details: "header: Format mismatch, expected IMAGE, received UNKNOWN" },
    };
    expect(formatMetaError(err, "fallback")).toBe(
      "(#132012) Parameter format does not match format in the created template — header: Format mismatch, expected IMAGE, received UNKNOWN"
    );
  });

  it("usa o fallback quando não há erro da Meta", () => {
    expect(formatMetaError(undefined, "timeout")).toBe("timeout");
  });
});
