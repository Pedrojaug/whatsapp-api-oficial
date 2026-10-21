// Agendamentos: datas sempre interpretadas no Horário de Brasília quando vierem sem fuso.
// O servidor roda em UTC (Render): new Date("2026-10-21T07:30") lá vira 07:30 UTC = 04:30 em Brasília.

// Brasil sem horário de verão desde 2019: offset fixo
const BRT_OFFSET = "-03:00";
const NO_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

// Folga para relógios levemente diferentes entre navegador e servidor
export const SCHEDULE_PAST_TOLERANCE_MS = 2 * 60 * 1000;

export type ParsedSchedule =
  | { ok: true; date: Date | null }
  | { ok: false; error: string };

/**
 * Converte o scheduledAt recebido. Vazio → sem agendamento (envio imediato).
 * Data no passado (além da folga) é recusada: antes ela era enviada na hora, sem aviso.
 */
export function parseScheduledAt(input: unknown, now: number = Date.now()): ParsedSchedule {
  if (input === undefined || input === null || input === "") return { ok: true, date: null };
  if (typeof input !== "string") return { ok: false, error: "Data de agendamento inválida." };

  const raw = input.trim();
  const date = new Date(NO_TIMEZONE.test(raw) ? `${raw}${BRT_OFFSET}` : raw);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Data de agendamento inválida." };

  if (date.getTime() < now - SCHEDULE_PAST_TOLERANCE_MS) {
    return {
      ok: false,
      error: `A data de agendamento já passou (${formatBrt(date)}, horário de Brasília). Escolha um horário futuro.`,
    };
  }
  return { ok: true, date };
}

export function formatBrt(date: Date): string {
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
