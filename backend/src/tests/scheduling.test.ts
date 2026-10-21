import { describe, it, expect } from "vitest";
import { parseScheduledAt, formatBrt } from "../utils/scheduling";

// 20/10/2026 22:15 em Brasília
const NOW = Date.parse("2026-10-21T01:15:00Z");

describe("parseScheduledAt", () => {
  it("sem data → envio imediato", () => {
    expect(parseScheduledAt(undefined, NOW)).toEqual({ ok: true, date: null });
    expect(parseScheduledAt("", NOW)).toEqual({ ok: true, date: null });
  });

  it("data sem fuso é horário de Brasília, não o fuso do servidor", () => {
    const r = parseScheduledAt("2026-10-21T07:30", NOW);
    expect(r.ok && r.date?.toISOString()).toBe("2026-10-21T10:30:00.000Z");
  });

  it("mantém datas com fuso explícito", () => {
    const r = parseScheduledAt("2026-10-21T10:30:00.000Z", NOW);
    expect(r.ok && r.date?.toISOString()).toBe("2026-10-21T10:30:00.000Z");
  });

  it("recusa data no passado (antes era enviada na hora)", () => {
    // 20/10 07:30: só o horário foi trocado, a data ficou a de hoje
    const r = parseScheduledAt("2026-10-20T07:30", NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("20/10/2026");
  });

  it("aceita poucos segundos de diferença de relógio", () => {
    const r = parseScheduledAt(new Date(NOW - 30_000).toISOString(), NOW);
    expect(r.ok).toBe(true);
  });

  it("recusa valores inválidos", () => {
    expect(parseScheduledAt("amanhã cedo", NOW).ok).toBe(false);
    expect(parseScheduledAt(123, NOW).ok).toBe(false);
  });

  it("formata no horário de Brasília", () => {
    expect(formatBrt(new Date("2026-10-21T10:30:00Z"))).toBe("21/10/2026, 07:30");
  });
});
