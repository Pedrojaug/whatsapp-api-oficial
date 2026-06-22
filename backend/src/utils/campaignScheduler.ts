export interface ScheduleConfig {
  scheduleType: string;
  scheduleTime?: string;   // "HH:MM" UTC
  scheduleDays?: number[]; // 0=Sun..6=Sat for WEEKLY, 1-31 for MONTHLY
  scheduleDate?: string;   // ISO datetime string for ONCE
}

export function calculateNextRun(config: ScheduleConfig): Date | null {
  const { scheduleType, scheduleTime, scheduleDays = [], scheduleDate } = config;
  const now = new Date();

  if (scheduleType === "ONCE") {
    if (!scheduleDate) return null;
    const d = new Date(scheduleDate);
    return d > now ? d : null;
  }

  if (!scheduleTime) return null;

  const [brtHours, minutes] = scheduleTime.split(":").map(Number);
  if (isNaN(brtHours) || isNaN(minutes)) return null;
  // scheduleTime is stored as BRT (UTC-3); convert to UTC for setUTCHours
  const hours = (brtHours + 3) % 24;
  const crossesMidnight = hours < brtHours; // wrapped past midnight UTC

  if (scheduleType === "DAILY") {
    const next = new Date(now);
    next.setUTCHours(hours, minutes, 0, 0);
    if (crossesMidnight) next.setUTCDate(next.getUTCDate() + 1);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (scheduleType === "WEEKLY") {
    if (!scheduleDays.length) return null;
    const days = [...scheduleDays].sort((a, b) => a - b);
    const currentDay = now.getUTCDay();
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const targetMinutes = hours * 60 + minutes;

    // Find next matching day
    for (const day of days) {
      // Adjust target day if time crosses midnight UTC
      const utcDay = (day + (crossesMidnight ? 1 : 0)) % 7;
      const daysUntil = (utcDay - currentDay + 7) % 7;
      if (daysUntil === 0 && currentMinutes >= targetMinutes) continue;
      const next = new Date(now);
      next.setUTCDate(next.getUTCDate() + (daysUntil === 0 ? 7 : daysUntil));
      next.setUTCHours(hours, minutes, 0, 0);
      return next;
    }

    // All days already passed this week — wrap to first day of next week
    const next = new Date(now);
    const firstDay = (days[0] + (crossesMidnight ? 1 : 0)) % 7;
    const daysUntilFirst = (firstDay - currentDay + 7) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilFirst);
    next.setUTCHours(hours, minutes, 0, 0);
    return next;
  }

  if (scheduleType === "MONTHLY") {
    const targetDay = scheduleDays[0] || 1;
    const next = new Date(now);
    next.setUTCDate(targetDay + (crossesMidnight ? 1 : 0));
    next.setUTCHours(hours, minutes, 0, 0);
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
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
