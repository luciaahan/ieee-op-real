import { endOfMonth, format, startOfMonth } from "date-fns";

export type MonthPeriod = {
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
};

export function getCurrentMonthPeriod(date = new Date()): MonthPeriod {
  return {
    monthStart: format(startOfMonth(date), "yyyy-MM-dd"),
    monthEnd: format(endOfMonth(date), "yyyy-MM-dd"),
    monthLabel: format(date, "MMMM yyyy"),
  };
}

export function isDateInMonth(dateStr: string, period: MonthPeriod): boolean {
  return dateStr >= period.monthStart && dateStr <= period.monthEnd;
}

export function formatMonthRange(period: MonthPeriod): string {
  const start = format(new Date(`${period.monthStart}T12:00:00`), "MMM d");
  const end = format(new Date(`${period.monthEnd}T12:00:00`), "MMM d, yyyy");
  return `${start} — ${end}`;
}

export function getEventsInMonth<T extends { startAt: string }>(
  events: T[],
  period: MonthPeriod,
): T[] {
  return events
    .filter((e) => isDateInMonth(e.startAt.slice(0, 10), period))
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}
