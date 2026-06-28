import { differenceInDays, format, parseISO } from "date-fns";
import type { Event, Goal } from "@/lib/db/schema";
import type { SemesterSettings } from "@/lib/semester-types";
import {
  findSemesterEventGoal,
  parseEventTarget,
} from "@/lib/goals";
import { isDateInSemester } from "@/lib/semester-types";
import { posterDueDate, roomBookingDueDate } from "@/lib/kpi";
import type { CommitteeStatus } from "@/lib/committee-status-labels";

export type { CommitteeStatus } from "@/lib/committee-status-labels";
export {
  COMMITTEE_STATUS_LABELS,
  committeeNeedsAttention,
} from "@/lib/committee-status-labels";

type DeliverableRow = {
  status: string;
  dueDate: string | null;
  linkedEventId: string | null;
};

function eventDateKey(startAt: string): string {
  return startAt.slice(0, 10);
}

export function countCompletedEventsInSemester(
  events: Event[],
  semester: SemesterSettings,
): number {
  return events.filter(
    (e) =>
      e.status === "completed" &&
      !e.deletedAt &&
      isDateInSemester(eventDateKey(e.startAt), semester),
  ).length;
}

export function eventCommitteeStatus(
  committeeEvents: Event[],
  goals: Goal[],
  semester: SemesterSettings,
  now = new Date(),
): CommitteeStatus {
  const semesterGoal = findSemesterEventGoal(goals);
  const target = parseEventTarget(semesterGoal?.targetMetric ?? null);
  if (target == null) return "no_goals";

  const completed = countCompletedEventsInSemester(committeeEvents, semester);
  if (completed >= target) return "on_track";

  const start = parseISO(semester.semesterStart);
  const end = parseISO(semester.semesterEnd);
  const totalDays = Math.max(1, differenceInDays(end, start));
  const elapsed = Math.max(0, Math.min(totalDays, differenceInDays(now, start)));
  const expected = (target * elapsed) / totalDays;

  if (completed >= expected - 0.5) return "on_track";
  return "keep_going";
}

function resolveDueDate(
  deliverable: DeliverableRow,
  eventsById: Record<string, Event>,
  fallbackDueDate: (startAt: string) => string,
): string | null {
  if (deliverable.dueDate) return deliverable.dueDate;
  if (!deliverable.linkedEventId) return null;
  const event = eventsById[deliverable.linkedEventId];
  if (!event || event.deletedAt) return null;
  return fallbackDueDate(event.startAt);
}

function deliverableCommitteeStatus(
  deliverables: DeliverableRow[],
  eventsById: Record<string, Event>,
  fallbackDueDate: (startAt: string) => string,
  now = new Date(),
): CommitteeStatus {
  const today = format(now, "yyyy-MM-dd");
  const active = deliverables.filter((d) => d.status !== "done");

  for (const d of active) {
    const dueDate = resolveDueDate(d, eventsById, fallbackDueDate);
    if (dueDate && dueDate < today) return "lets_catch_up";
  }

  for (const d of active) {
    if (d.status !== "not_started") continue;
    const dueDate = resolveDueDate(d, eventsById, fallbackDueDate);
    if (!dueDate) continue;
    const daysUntil = differenceInDays(parseISO(dueDate), now);
    if (daysUntil >= 0 && daysUntil <= 3) return "due_soon";
  }

  return "on_track";
}

export function posterCommitteeStatus(
  posters: DeliverableRow[],
  eventsById: Record<string, Event>,
  now = new Date(),
): CommitteeStatus {
  return deliverableCommitteeStatus(posters, eventsById, posterDueDate, now);
}

export function roomCommitteeStatus(
  roomBookings: DeliverableRow[],
  eventsById: Record<string, Event>,
  now = new Date(),
): CommitteeStatus {
  return deliverableCommitteeStatus(
    roomBookings,
    eventsById,
    roomBookingDueDate,
    now,
  );
}
