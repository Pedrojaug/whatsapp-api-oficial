import { describe, it, expect, vi, afterEach } from "vitest";
import { calculateNextRun } from "../utils/campaignScheduler";

// Horários em UTC; Brasília = UTC-3 (sem horário de verão desde 2019).
function at(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => vi.useRealTimers());

describe("calculateNextRun — DAILY", () => {
  it("09:00 BRT ativada de manhã cedo roda no mesmo dia", () => {
    at("2026-11-04T10:00:00Z"); // 07:00 BRT
    expect(calculateNextRun({ scheduleType: "DAILY", scheduleTime: "09:00" })?.toISOString()).toBe("2026-11-04T12:00:00.000Z");
  });

  it("09:00 BRT ativada depois do horário roda no dia seguinte", () => {
    at("2026-11-04T13:00:00Z"); // 10:00 BRT
    expect(calculateNextRun({ scheduleType: "DAILY", scheduleTime: "09:00" })?.toISOString()).toBe("2026-11-05T12:00:00.000Z");
  });

  it("23:00 BRT ativada às 22:30 BRT roda na mesma noite (não pula um dia)", () => {
    at("2026-11-05T01:30:00Z"); // 04/11 22:30 BRT
    expect(calculateNextRun({ scheduleType: "DAILY", scheduleTime: "23:00" })?.toISOString()).toBe("2026-11-05T02:00:00.000Z");
  });

  it("23:00 BRT ativada à tarde roda na mesma noite", () => {
    at("2026-11-04T18:00:00Z"); // 15:00 BRT
    expect(calculateNextRun({ scheduleType: "DAILY", scheduleTime: "23:00" })?.toISOString()).toBe("2026-11-05T02:00:00.000Z");
  });

  it("logo após rodar às 23:00 BRT, a próxima é na noite seguinte", () => {
    at("2026-11-05T02:00:02Z"); // 04/11 23:00:02 BRT
    expect(calculateNextRun({ scheduleType: "DAILY", scheduleTime: "23:00" })?.toISOString()).toBe("2026-11-06T02:00:00.000Z");
  });

  it("horário inválido retorna null", () => {
    expect(calculateNextRun({ scheduleType: "DAILY", scheduleTime: "aa:bb" })).toBeNull();
    expect(calculateNextRun({ scheduleType: "DAILY" })).toBeNull();
  });
});

describe("calculateNextRun — WEEKLY", () => {
  // 04/11/2026 é quarta-feira (3)
  it("segunda e quarta 10:00 BRT, ativada quarta 08:00 BRT → hoje", () => {
    at("2026-11-04T11:00:00Z");
    expect(calculateNextRun({ scheduleType: "WEEKLY", scheduleTime: "10:00", scheduleDays: [1, 3] })?.toISOString()).toBe("2026-11-04T13:00:00.000Z");
  });

  it("segunda e quarta 10:00 BRT, ativada quarta 11:00 BRT → próxima segunda", () => {
    at("2026-11-04T14:00:00Z");
    expect(calculateNextRun({ scheduleType: "WEEKLY", scheduleTime: "10:00", scheduleDays: [1, 3] })?.toISOString()).toBe("2026-11-09T13:00:00.000Z");
  });

  it("quarta 22:00 BRT, ativada quarta 21:30 BRT → hoje à noite", () => {
    at("2026-11-05T00:30:00Z"); // quarta 21:30 BRT, já quinta em UTC
    expect(calculateNextRun({ scheduleType: "WEEKLY", scheduleTime: "22:00", scheduleDays: [3] })?.toISOString()).toBe("2026-11-05T01:00:00.000Z");
  });

  it("sábado 23:30 BRT, ativada sábado 23:40 BRT → sábado seguinte", () => {
    at("2026-11-08T02:40:00Z"); // sábado 07/11 23:40 BRT
    expect(calculateNextRun({ scheduleType: "WEEKLY", scheduleTime: "23:30", scheduleDays: [6] })?.toISOString()).toBe("2026-11-15T02:30:00.000Z");
  });

  it("seg, qua e sex 09:00 BRT: depois de rodar na quarta, a próxima é sexta (não segunda)", () => {
    at("2026-11-04T12:00:03Z"); // quarta 09:00:03 BRT
    expect(calculateNextRun({ scheduleType: "WEEKLY", scheduleTime: "09:00", scheduleDays: [1, 3, 5] })?.toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });

  it("sem dias retorna null", () => {
    expect(calculateNextRun({ scheduleType: "WEEKLY", scheduleTime: "10:00", scheduleDays: [] })).toBeNull();
  });
});

describe("calculateNextRun — MONTHLY", () => {
  it("dia 10 às 09:00 BRT, ativada dia 04 → dia 10 deste mês", () => {
    at("2026-11-04T13:00:00Z");
    expect(calculateNextRun({ scheduleType: "MONTHLY", scheduleTime: "09:00", scheduleDays: [10] })?.toISOString()).toBe("2026-11-10T12:00:00.000Z");
  });

  it("dia 31 em novembro (30 dias) roda no último dia do mês, não em 01/12", () => {
    at("2026-11-04T13:00:00Z");
    expect(calculateNextRun({ scheduleType: "MONTHLY", scheduleTime: "09:00", scheduleDays: [31] })?.toISOString()).toBe("2026-11-30T12:00:00.000Z");
  });

  it("depois de rodar em 31/01, a próxima é 28/02 (não 03/03)", () => {
    at("2027-01-31T12:00:05Z");
    expect(calculateNextRun({ scheduleType: "MONTHLY", scheduleTime: "09:00", scheduleDays: [31] })?.toISOString()).toBe("2027-02-28T12:00:00.000Z");
  });

  it("dia 31 às 22:00 BRT em dezembro → 31/12 22:00 BRT (01/01 01:00 UTC)", () => {
    at("2026-12-10T12:00:00Z");
    expect(calculateNextRun({ scheduleType: "MONTHLY", scheduleTime: "22:00", scheduleDays: [31] })?.toISOString()).toBe("2027-01-01T01:00:00.000Z");
  });

  it("dia 5 às 08:00 BRT, ativada dia 31/01 → 05/02", () => {
    at("2027-01-31T15:00:00Z");
    expect(calculateNextRun({ scheduleType: "MONTHLY", scheduleTime: "08:00", scheduleDays: [5] })?.toISOString()).toBe("2027-02-05T11:00:00.000Z");
  });
});

describe("calculateNextRun — ONCE", () => {
  it("data futura é mantida; data passada retorna null", () => {
    at("2026-11-04T13:00:00Z");
    expect(calculateNextRun({ scheduleType: "ONCE", scheduleDate: "2026-11-05T19:00:00.000Z" })?.toISOString()).toBe("2026-11-05T19:00:00.000Z");
    expect(calculateNextRun({ scheduleType: "ONCE", scheduleDate: "2026-11-03T19:00:00.000Z" })).toBeNull();
  });
});
