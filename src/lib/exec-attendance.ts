import {
  format,
  parseISO,
  startOfWeek,
  subWeeks,
  endOfWeek,
  isWithinInterval,
} from "date-fns";
import type { ExecMember } from "@/lib/exec-types";

export type AttendanceCellStatus = "present" | "absent" | "unlogged";

export type AttendanceWeek = {
  weekStart: string;
  label: string;
  meetingId: string | null;
  meetingDate: string | null;
  logged: boolean;
  presentCount: number;
  totalCount: number;
};

export type AttendanceRow = {
  member: ExecMember;
  cells: AttendanceCellStatus[];
  presentCount: number;
  loggedWeeks: number;
};

export type ExecAttendanceMatrix = {
  weeks: AttendanceWeek[];
  rows: AttendanceRow[];
};

export type MeetingNoteAttendance = {
  id: string;
  meetingDate: string;
  attendeeIds: string | null;
};

export const PREZ_COMMITTEE_ID = "committee-prez";
export const EXEC_COMMITTEE_ID = "committee-exec";
export const EXEC_COMMITTEE_SLUG = "exec";
export const DEFAULT_ATTENDANCE_WEEKS = 12;

/** Parse YYYY-MM-DD as local calendar date (avoids UTC day-shift). */
export function parseMeetingDate(date: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return parseISO(date);
}

export function weekStartKey(date: Date | string): string {
  const d =
    typeof date === "string" ? parseMeetingDate(date) : date;
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function parseAttendeeIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function noteForWeek(
  notes: MeetingNoteAttendance[],
  weekStart: string,
): MeetingNoteAttendance | null {
  const weekStartDate = parseMeetingDate(weekStart);
  const weekEnd = endOfWeek(weekStartDate, { weekStartsOn: 1 });

  const inWeek = notes.filter((note) =>
    isWithinInterval(parseMeetingDate(note.meetingDate), {
      start: weekStartDate,
      end: weekEnd,
    }),
  );

  if (inWeek.length === 0) return null;

  return inWeek.sort(
    (a, b) =>
      parseMeetingDate(b.meetingDate).getTime() -
      parseMeetingDate(a.meetingDate).getTime(),
  )[0];
}

export function buildExecAttendanceMatrix(
  roster: ExecMember[],
  notes: MeetingNoteAttendance[],
  weeksBack = DEFAULT_ATTENDANCE_WEEKS,
): ExecAttendanceMatrix {
  const today = new Date();
  const weekStartSet = new Set<string>();

  for (let i = weeksBack - 1; i >= 0; i--) {
    weekStartSet.add(weekStartKey(subWeeks(today, i)));
  }

  for (const note of notes) {
    weekStartSet.add(weekStartKey(note.meetingDate));
  }

  const weekStarts = Array.from(weekStartSet).sort();

  const weeks: AttendanceWeek[] = weekStarts.map((weekStart) => {
    const note = noteForWeek(notes, weekStart);
    const attendeeIds = note ? parseAttendeeIds(note.attendeeIds) : [];
    const logged = !!note;
    const presentCount = logged
      ? roster.filter((m) => attendeeIds.includes(m.id)).length
      : 0;

    return {
      weekStart,
      label: note
        ? format(parseMeetingDate(note.meetingDate), "MMM d")
        : format(parseMeetingDate(weekStart), "MMM d"),
      meetingId: note?.id ?? null,
      meetingDate: note?.meetingDate ?? null,
      logged,
      presentCount,
      totalCount: roster.length,
    };
  });

  const rows: AttendanceRow[] = roster.map((member) => {
    const cells: AttendanceCellStatus[] = weeks.map((week) => {
      if (!week.logged) return "unlogged";
      const note = noteForWeek(notes, week.weekStart);
      if (!note) return "unlogged";
      const attendeeIds = parseAttendeeIds(note.attendeeIds);
      return attendeeIds.includes(member.id) ? "present" : "absent";
    });

    const loggedWeeks = weeks.filter((w) => w.logged).length;
    const presentCount = cells.filter((c) => c === "present").length;

    return { member, cells, presentCount, loggedWeeks };
  });

  return { weeks, rows };
}
