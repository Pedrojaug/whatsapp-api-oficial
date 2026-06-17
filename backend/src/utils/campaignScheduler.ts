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

  const [hours, minutes] = scheduleTime.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;

  if (scheduleType === "DAILY") {
    const next = new Date(now);
    next.setUTCHours(hours, minutes, 0, 0);
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
      const daysUntil = (day - currentDay + 7) % 7;
      if (daysUntil === 0 && currentMinutes >= targetMinutes) continue;
      const next = new Date(now);
      next.setUTCDate(next.getUTCDate() + (daysUntil === 0 ? 7 : daysUntil));
      next.setUTCHours(hours, minutes, 0, 0);
      return next;
    }

    // All days already passed this week — wrap to first day of next week
    const next = new Date(now);
    const firstDay = days[0];
    const daysUntilFirst = (firstDay - currentDay + 7) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilFirst);
    next.setUTCHours(hours, minutes, 0, 0);
    return next;
  }

  if (scheduleType === "MONTHLY") {
    const targetDay = scheduleDays[0] || 1;
    const next = new Date(now);
    next.setUTCDate(targetDay);
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
    return `Diariamente às ${scheduleTime} UTC`;
  }
  if (scheduleType === "WEEKLY" && scheduleTime && scheduleDays?.length) {
    const days = scheduleDays.map((d) => DAY_NAMES[d] ?? d).join(", ");
    return `Semanal — ${days} às ${scheduleTime} UTC`;
  }
  if (scheduleType === "MONTHLY" && scheduleTime && scheduleDays?.length) {
    return `Mensal — dia ${scheduleDays[0]} às ${scheduleTime} UTC`;
  }
  return scheduleType;
}
