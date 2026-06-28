import { randomUUID } from "crypto";
import { eq, and, isNull, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  deliverables,
  eventChecklistItems,
  eventPlanningTemplates,
  committees,
} from "@/lib/db/schema";
import {
  computeDueDate,
  itemApplies,
  shouldUsePlanningChecklist,
} from "@/lib/checklist";
import { posterDueDate, roomBookingDueDate } from "@/lib/kpi";
import type { ChecklistCondition } from "@/lib/seed-data";

const PR_COMMITTEE_ID = "committee-pr";
const IR_COMMITTEE_ID = "committee-internal-relations";

export async function createEvent(input: {
  committeeId: string;
  committeeSlug: string;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
  signupFormUrl?: string;
  posterNotes?: string;
  recurrence?: string;
  status?: string;
  needsFood?: boolean;
  needsFoodSponsored?: boolean;
  needsFoodInternal?: boolean;
  needsSupplies?: boolean;
  hasExternalGuests?: boolean;
  requestRoomBooking?: boolean;
  roomBookingNotes?: string;
}) {
  const recurrence = input.recurrence ?? "none";
  const usePlanningChecklist = shouldUsePlanningChecklist(
    input.committeeSlug,
    recurrence,
  );

  const needsFoodSponsored = input.needsFoodSponsored ?? false;
  const needsFoodInternal = input.needsFoodInternal ?? false;
  const needsFood =
    needsFoodSponsored || needsFoodInternal || (input.needsFood ?? false);

  const eventId = randomUUID();
  await db.insert(events).values({
    id: eventId,
    committeeId: input.committeeId,
    title: input.title,
    startAt: input.startAt,
    endAt: input.endAt,
    location: input.location,
    description: input.description,
    signupFormUrl: input.signupFormUrl?.trim() ?? null,
    recurrence,
    status: input.status ?? "planned",
    needsFood,
    needsFoodSponsored,
    needsFoodInternal,
    needsSupplies: input.needsSupplies ?? false,
    hasExternalGuests: input.hasExternalGuests ?? false,
    usePlanningChecklist,
  });

  let deliverableId: string | null = null;
  let posterRequested = false;
  let roomBookingRequested = false;
  if (input.committeeSlug !== "pr") {
    deliverableId = randomUUID();
    const posterSummary = input.posterNotes?.trim() || null;
    await db.insert(deliverables).values({
      id: deliverableId,
      committeeId: PR_COMMITTEE_ID,
      linkedEventId: eventId,
      type: "poster",
      status: "not_started",
      dueDate: posterDueDate(input.startAt),
      captionSummary: posterSummary,
    });
    posterRequested = true;
  }

  if (input.requestRoomBooking && input.committeeSlug !== "internal-relations") {
    const roomSummary = [
      input.title,
      input.location ? `Preferred: ${input.location}` : null,
      input.roomBookingNotes,
    ]
      .filter(Boolean)
      .join(" — ");
    await db.insert(deliverables).values({
      id: randomUUID(),
      committeeId: IR_COMMITTEE_ID,
      linkedEventId: eventId,
      type: "room_booking",
      status: "not_started",
      dueDate: roomBookingDueDate(input.startAt),
      captionSummary: roomSummary || null,
    });
    roomBookingRequested = true;
  }

  if (usePlanningChecklist) {
    await generateChecklistForEvent(eventId, input.startAt, deliverableId);
  }

  return { eventId, posterRequested, roomBookingRequested };
}

export async function generateChecklistForEvent(
  eventId: string,
  startAt: string,
  deliverableId: string | null,
) {
  const templates = await db.select().from(eventPlanningTemplates);
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event) return;

  for (const template of templates) {
    if (
      !itemApplies(template.condition as ChecklistCondition, event)
    ) {
      continue;
    }

    await db.insert(eventChecklistItems).values({
      id: randomUUID(),
      eventId,
      offsetDays: template.offsetDays,
      title: template.title,
      sortOrder: template.sortOrder,
      isOptional: template.isOptional,
      isRecommended: template.isRecommended,
      condition: template.condition,
      status: "pending",
      dueDate: computeDueDate(startAt, template.offsetDays),
      linkedDeliverableId:
        template.linksToDeliverable && deliverableId ? deliverableId : null,
    });
  }
}

/** Add conditional checklist items when planning flags are enabled after create. */
export async function syncConditionalChecklistItems(eventId: string) {
  const [event] = await db.select().from(events).where(eq(events.id, eventId));
  if (!event || !event.usePlanningChecklist) return;

  const templates = await db.select().from(eventPlanningTemplates);
  const conditionalTemplates = templates.filter((t) => t.condition !== "always");

  const existing = await db
    .select()
    .from(eventChecklistItems)
    .where(eq(eventChecklistItems.eventId, eventId));

  const [poster] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.linkedEventId, eventId),
        eq(deliverables.type, "poster"),
      ),
    );

  for (const template of conditionalTemplates) {
    if (!itemApplies(template.condition as ChecklistCondition, event)) {
      continue;
    }

    if (existing.some((item) => item.title === template.title)) {
      continue;
    }

    await db.insert(eventChecklistItems).values({
      id: randomUUID(),
      eventId,
      offsetDays: template.offsetDays,
      title: template.title,
      sortOrder: template.sortOrder,
      isOptional: template.isOptional,
      isRecommended: template.isRecommended,
      condition: template.condition,
      status: "pending",
      dueDate: computeDueDate(event.startAt, template.offsetDays),
      linkedDeliverableId:
        template.linksToDeliverable && poster ? poster.id : null,
    });
  }
}

export async function getEventById(id: string) {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), isNull(events.deletedAt)));
  if (!event) return null;

  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, event.committeeId));

  const checklist = await db
    .select()
    .from(eventChecklistItems)
    .where(eq(eventChecklistItems.eventId, id))
    .orderBy(asc(eventChecklistItems.offsetDays), asc(eventChecklistItems.sortOrder));

  const [poster] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.linkedEventId, id),
        eq(deliverables.type, "poster"),
      ),
    );

  const [roomBooking] = await db
    .select()
    .from(deliverables)
    .where(
      and(
        eq(deliverables.linkedEventId, id),
        eq(deliverables.type, "room_booking"),
      ),
    );

  return { event, committee, checklist, poster, roomBooking };
}

export async function syncDeliverableToChecklist(
  deliverableId: string,
  status: string,
  userId: string,
) {
  const now = new Date().toISOString();
  const items = await db
    .select()
    .from(eventChecklistItems)
    .where(eq(eventChecklistItems.linkedDeliverableId, deliverableId));

  for (const item of items) {
    let newStatus: string | null = null;
    if (item.title.includes("All posters are up") && status === "done") {
      newStatus = "done";
    }
    if (newStatus) {
      await db
        .update(eventChecklistItems)
        .set({ status: newStatus, completedAt: now, completedBy: userId })
        .where(eq(eventChecklistItems.id, item.id));
    }
  }
}
