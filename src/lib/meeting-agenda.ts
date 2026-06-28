import { addDays, format, parseISO, subDays } from "date-fns";
import type { Event, EventChecklistItem } from "@/lib/db/schema";

export type WeekRange = { start: string; end: string };

/** Mon–Fri immediately before a typical weekend exec meeting. */
export function getRecapWeekRange(meetingDateStr: string): WeekRange {
  const meetingDate = parseISO(meetingDateStr.slice(0, 10));
  const day = meetingDate.getDay();

  let friday: Date;
  if (day === 0) {
    friday = subDays(meetingDate, 2);
  } else if (day === 6) {
    friday = subDays(meetingDate, 1);
  } else {
    friday = subDays(meetingDate, day + 2);
  }

  const monday = subDays(friday, 4);
  return {
    start: format(monday, "yyyy-MM-dd"),
    end: format(friday, "yyyy-MM-dd"),
  };
}

/** Mon–Fri of the week following the recap week. */
export function getNextWeekRange(meetingDateStr: string): WeekRange {
  const recap = getRecapWeekRange(meetingDateStr);
  const monday = addDays(parseISO(recap.end), 3);
  const friday = addDays(monday, 4);
  return {
    start: format(monday, "yyyy-MM-dd"),
    end: format(friday, "yyyy-MM-dd"),
  };
}

function dateInRange(dateStr: string, range: WeekRange): boolean {
  const d = dateStr.slice(0, 10);
  return d >= range.start && d <= range.end;
}

function formatRangeLabel(range: WeekRange): string {
  const start = parseISO(range.start);
  const end = parseISO(range.end);
  return `${format(start, "EEE, MMM d")} – ${format(end, "EEE, MMM d")}`;
}

function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr.slice(0, 10)), "EEE, MMM d");
}

export type AgendaEvent = {
  id: string;
  title: string;
  startAt: string;
  committeeName: string;
};

export type AgendaChecklistGroup = {
  event: AgendaEvent;
  items: { title: string; dueDate: string }[];
};

export type MeetingAgenda = {
  meetingDate: string;
  recapRange: WeekRange;
  nextWeekRange: WeekRange;
  recapEvents: AgendaEvent[];
  checklistGroups: AgendaChecklistGroup[];
  text: string;
};

export function buildMeetingAgenda(input: {
  meetingDate: string;
  events: Event[];
  checklistItems: EventChecklistItem[];
  committeeNames: Record<string, string>;
}): MeetingAgenda {
  const recapRange = getRecapWeekRange(input.meetingDate);
  const nextWeekRange = getNextWeekRange(input.meetingDate);

  const activeEvents = input.events.filter((e) => !e.deletedAt);
  const eventsById = Object.fromEntries(activeEvents.map((e) => [e.id, e]));

  const recapEvents = activeEvents
    .filter((e) => dateInRange(e.startAt, recapRange))
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
    .map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      committeeName: input.committeeNames[e.committeeId] ?? "Unknown",
    }));

  const itemsByEvent = new Map<string, { title: string; dueDate: string }[]>();
  for (const item of input.checklistItems) {
    if (!dateInRange(item.dueDate, nextWeekRange)) continue;
    const event = eventsById[item.eventId];
    if (!event || !event.usePlanningChecklist) continue;
    if (item.status === "done" || item.status === "not_applicable") continue;

    const list = itemsByEvent.get(item.eventId) ?? [];
    list.push({ title: item.title, dueDate: item.dueDate });
    itemsByEvent.set(item.eventId, list);
  }

  const checklistGroups: AgendaChecklistGroup[] = [...itemsByEvent.entries()]
    .map(([eventId, items]) => {
      const event = eventsById[eventId]!;
      return {
        event: {
          id: event.id,
          title: event.title,
          startAt: event.startAt,
          committeeName: input.committeeNames[event.committeeId] ?? "Unknown",
        },
        items: items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      };
    })
    .sort(
      (a, b) =>
        new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime(),
    );

  const lines: string[] = [
    `Agenda — ${formatShortDate(input.meetingDate)}`,
    "",
    `Recap (${formatRangeLabel(recapRange)})`,
  ];

  if (recapEvents.length === 0) {
    lines.push("• No events last week");
  } else {
    for (const ev of recapEvents) {
      lines.push(
        `• ${ev.title} — ${ev.committeeName} · ${formatShortDate(ev.startAt)}`,
      );
      lines.push("  - How did it go?");
    }
  }

  lines.push("");
  lines.push(`Upcoming planning (${formatRangeLabel(nextWeekRange)})`);

  if (checklistGroups.length === 0) {
    lines.push("• No checklist items due next week");
  } else {
    for (const group of checklistGroups) {
      lines.push(
        `• ${group.event.title} — ${group.event.committeeName} · ${formatShortDate(group.event.startAt)}`,
      );
      for (const item of group.items) {
        lines.push(
          `  - ${item.title} (due ${formatShortDate(item.dueDate)})`,
        );
      }
    }
  }

  return {
    meetingDate: input.meetingDate,
    recapRange,
    nextWeekRange,
    recapEvents,
    checklistGroups,
    text: lines.join("\n"),
  };
}
