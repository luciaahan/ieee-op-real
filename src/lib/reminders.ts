import { format, addDays } from "date-fns";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  actionItems,
  committees,
  events,
  eventChecklistItems,
  users,
} from "@/lib/db/schema";
import { isOverdue } from "@/lib/checklist";
import type { ReminderDigest } from "@/lib/email";

export async function buildReminderDigest(): Promise<ReminderDigest> {
  const today = format(new Date(), "yyyy-MM-dd");
  const in14Days = format(addDays(new Date(), 14), "yyyy-MM-dd");

  const allCommittees = await db.select().from(committees);
  const committeeMap = Object.fromEntries(
    allCommittees.map((c) => [c.id, c.name]),
  );

  const openActions = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.status, "open"));

  const overdueActionItems = openActions
    .filter((a) => a.dueDate && a.dueDate < today)
    .map((a) => ({
      description: a.description,
      committee: committeeMap[a.committeeId] ?? "Unknown",
      dueDate: a.dueDate,
    }));

  const allEvents = await db
    .select()
    .from(events)
    .where(isNull(events.deletedAt));

  const upcomingEvents = allEvents
    .filter(
      (e) =>
        e.startAt.slice(0, 10) >= today &&
        e.startAt.slice(0, 10) <= in14Days &&
        e.status !== "completed",
    )
    .map((e) => ({
      title: e.title,
      committee: committeeMap[e.committeeId] ?? "Unknown",
      startAt: e.startAt,
    }));

  const checklistItems = await db.select().from(eventChecklistItems);
  const overdueChecklistEvents = allEvents
    .filter((e) => e.usePlanningChecklist && new Date(e.startAt) > new Date())
    .filter((e) =>
      checklistItems
        .filter((c) => c.eventId === e.id)
        .some((item) => isOverdue(item.dueDate, item.status)),
    )
    .map((e) => ({
      title: e.title,
      committee: committeeMap[e.committeeId] ?? "Unknown",
      startAt: e.startAt,
    }));

  return {
    overdueActionItems,
    upcomingEvents,
    overdueChecklistEvents,
  };
}

export async function getExecRecipientEmails(): Promise<string[]> {
  const roster = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.status, "active"));
  return roster.map((r) => r.email);
}
