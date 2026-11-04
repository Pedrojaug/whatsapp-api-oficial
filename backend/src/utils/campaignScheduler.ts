export interface ScheduleConfig {
  scheduleType: string;
  scheduleTime?: string;   // "HH:MM" no horário de Brasília
  scheduleDays?: number[]; // 0=Dom..6=Sáb para WEEKLY; 1-31 para MONTHLY
  scheduleDate?: string;   // ISO datetime para ONCE
}

// Brasília é UTC-3 fixo (sem horário de verão desde 2019).
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Todo o cálculo é feito no "relógio de Brasília": desloca o agora em -3h,
 * trabalha com os métodos getUTC/setUTC como se fosse a hora local de Brasília e
 * desloca o resultado de volta. Assim dia da semana, dia do mês e virada de
 * dia são os de Brasília, não os de UTC (que vira 3h antes).
 */
function toBrt(d: Date) {
  return new Date(d.getTime() - BRT_OFFSET_MS);
}
function fromBrt(d: Date) {
  return new Date(d.getTime() + BRT_OFFSET_MS);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Data (relógio BRT) no dia `day` do mês, limitado ao último dia (31 → 30/28/29). */
function monthlyCandidate(year: number, month: number, day: number, h: number, m: number) {
  const clamped = Math.min(day, daysInMonth(year, month));
  return new Date(Date.UTC(year, month, clamped, h, m, 0, 0));
}

export function calculateNextRun(config: ScheduleConfig): Date | null {
  const { scheduleType, scheduleTime, scheduleDays = [], scheduleDate } = config;
  const now = new Date();

  if (scheduleType === "ONCE") {
    if (!scheduleDate) return null;
    const d = new Date(scheduleDate);
    if (isNaN(d.getTime())) return null;
    return d > now ? d : null;
  }

  if (!scheduleTime) return null;
  const [hours, minutes] = scheduleTime.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const nowBrt = toBrt(now);
  const todayAt = (offsetDays: number) =>
    new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate() + offsetDays, hours, minutes, 0, 0));

  if (scheduleType === "DAILY") {
    const candidate = todayAt(0);
    return fromBrt(candidate > nowBrt ? candidate : todayAt(1));
  }

  if (scheduleType === "WEEKLY") {
    const days = new Set(scheduleDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
    if (days.size === 0) return null;
    // Procura o dia mais próximo (hoje inclusive, se o horário ainda não passou) nos próximos 7 dias.
    for (let offset = 0; offset <= 7; offset++) {
      const candidate = todayAt(offset);
      if (days.has(candidate.getUTCDay()) && candidate > nowBrt) return fromBrt(candidate);
    }
    return null;
  }

  if (scheduleType === "MONTHLY") {
    const targetDay = scheduleDays[0] || 1;
    if (!Number.isInteger(targetDay) || targetDay < 1 || targetDay > 31) return null;
    const y = nowBrt.getUTCFullYear();
    const mo = nowBrt.getUTCMonth();
    const thisMonth = monthlyCandidate(y, mo, targetDay, hours, minutes);
    if (thisMonth > nowBrt) return fromBrt(thisMonth);
    // Date.UTC normaliza mês 12 → janeiro do ano seguinte
    const nextMonthRef = new Date(Date.UTC(y, mo + 1, 1));
    return fromBrt(monthlyCandidate(nextMonthRef.getUTCFullYear(), nextMonthRef.getUTCMonth(), targetDay, hours, minutes));
  }

  return null;
}

export function describeSchedule(
  scheduleType: string,
  scheduleTime?: string | null,
  scheduleDays?: number[] | null,
  scheduleDate?: Date | string | null
): string {
  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  if (scheduleType === "ONCE" && scheduleDate) {
    return `Uma vez em ${new Date(scheduleDate).toLocaleString("pt-BR")}`;
  }
  if (scheduleType === "DAILY" && scheduleTime) {
    return `Diariamente às ${scheduleTime} (Horário de Brasília)`;
  }
  if (scheduleType === "WEEKLY" && scheduleTime && scheduleDays?.length) {
    const days = scheduleDays.map((d) => DAY_NAMES[d] ?? d).join(", ");
    return `Semanal — ${days} às ${scheduleTime} (Horário de Brasília)`;
  }
  if (scheduleType === "MONTHLY" && scheduleTime && scheduleDays?.length) {
    return `Mensal — dia ${scheduleDays[0]} às ${scheduleTime} (Horário de Brasília)`;
  }
  return scheduleType;
}
