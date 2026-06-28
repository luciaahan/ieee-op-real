import { addDays, format } from "date-fns";

export type AnnouncementEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  description: string | null;
  signupFormUrl: string | null;
  status: string;
};

function ordinalDay(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };
  return `${day}${suffixes[day % 10] ?? "th"}`;
}

function formatHourCompact(date: Date): string {
  return format(date, "h");
}

export function formatAnnouncementDateLine(
  startAt: string,
  endAt: string | null,
): string {
  const start = new Date(startAt);
  const weekday = format(start, "EEEE");
  const month = format(start, "MMMM");
  const day = ordinalDay(start.getDate());

  let timePart: string;
  if (endAt) {
    const end = new Date(endAt);
    const startPeriod = format(start, "a").toUpperCase();
    const endPeriod = format(end, "a").toUpperCase();
    if (startPeriod === endPeriod) {
      timePart = `${formatHourCompact(start)}-${formatHourCompact(end)}${endPeriod}`;
    } else {
      timePart = `${formatHourCompact(start)}${startPeriod}-${formatHourCompact(end)}${endPeriod}`;
    }
  } else {
    timePart = `${formatHourCompact(start)}${format(start, "a").toUpperCase()}`;
  }

  return `${weekday}, ${month} ${day}, ${timePart}`;
}

export function filterEventsInRange(
  events: AnnouncementEvent[],
  start: string,
  end: string,
): AnnouncementEvent[] {
  return events
    .filter((e) => e.status !== "cancelled" && e.status !== "completed")
    .filter((e) => {
      const d = e.startAt.slice(0, 10);
      return d >= start && d <= end;
    })
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
}

export function formatEventAnnouncement(event: AnnouncementEvent): string {
  const lines = [
    event.title,
    `Date: ${formatAnnouncementDateLine(event.startAt, event.endAt)}`,
  ];

  if (event.location?.trim()) {
    lines.push(`Location: ${event.location.trim()}`);
  }
  if (event.description?.trim()) {
    lines.push(event.description.trim());
  }
  if (event.signupFormUrl?.trim()) {
    lines.push(`RSVP Link: ${event.signupFormUrl.trim()}`);
  }

  return lines.join("\n");
}

export function buildWeeklyAnnouncement(
  events: AnnouncementEvent[],
  start: string,
  end: string,
): { events: AnnouncementEvent[]; text: string } {
  const filtered = filterEventsInRange(events, start, end);
  const text =
    filtered.length === 0
      ? "No events in this date range."
      : filtered.map(formatEventAnnouncement).join("\n\n");

  return { events: filtered, text };
}

export function defaultAnnouncementRange(): { start: string; end: string } {
  const today = new Date();
  return {
    start: format(today, "yyyy-MM-dd"),
    end: format(addDays(today, 7), "yyyy-MM-dd"),
  };
}
