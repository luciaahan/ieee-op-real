import { NextResponse } from "next/server";
import { eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  committees,
  events,
  deliverables,
  actionItems,
  eventChecklistItems,
  goals,
} from "@/lib/db/schema";
import { isOverdue } from "@/lib/checklist";
import { getUpcomingEvents } from "@/lib/kpi";
import { getSemesterSettings } from "@/lib/settings";
import {
  committeeNeedsAttention,
  countCompletedEventsInSemester,
  eventCommitteeStatus,
  posterCommitteeStatus,
  roomCommitteeStatus,
  type CommitteeStatus,
} from "@/lib/committee-status";
import { findSemesterEventGoal, parseEventTarget } from "@/lib/goals";
import { filterActionItemsForUser } from "@/lib/action-items";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const semester = await getSemesterSettings();

  const allCommittees = await db
    .select()
    .from(committees)
    .orderBy(committees.sortOrder);

  const allEvents = await db
    .select()
    .from(events)
    .where(isNull(events.deletedAt));

  const openActions = filterActionItemsForUser(
    session.user,
    await db
      .select()
      .from(actionItems)
      .where(eq(actionItems.status, "open")),
  );

  const posters = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.type, "poster"));

  const roomBookings = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.type, "room_booking"));

  const checklistItems = await db.select().from(eventChecklistItems);
  const allGoals = await db.select().from(goals);

  const eventsById = Object.fromEntries(allEvents.map((e) => [e.id, e]));
  const goalsByCommittee = new Map<string, typeof allGoals>();
  for (const goal of allGoals) {
    const list = goalsByCommittee.get(goal.committeeId) ?? [];
    list.push(goal);
    goalsByCommittee.set(goal.committeeId, list);
  }

  const committeeCards = allCommittees.map((committee) => {
    const committeeEvents = allEvents.filter(
      (e) => e.committeeId === committee.id,
    );
    const committeeGoals = goalsByCommittee.get(committee.id) ?? [];
    const upcoming = getUpcomingEvents(committeeEvents);
    const nextEvent = upcoming[0] ?? null;

    let status: CommitteeStatus = "on_track";
    let semesterProgress: { completed: number; target: number } | undefined;

    if (committee.trackingType === "events") {
      status = eventCommitteeStatus(committeeEvents, committeeGoals, semester);
      const semesterGoal = findSemesterEventGoal(committeeGoals);
      const target = parseEventTarget(semesterGoal?.targetMetric ?? null);
      if (target != null) {
        semesterProgress = {
          completed: countCompletedEventsInSemester(committeeEvents, semester),
          target,
        };
      }
    } else if (committee.trackingType === "deliverables") {
      status = posterCommitteeStatus(posters, eventsById);
    } else if (committee.trackingType === "rooms") {
      status = roomCommitteeStatus(roomBookings, eventsById);
    }

    const openCount = openActions.filter(
      (a) => a.committeeId === committee.id,
    ).length;

    return {
      ...committee,
      status,
      semesterProgress,
      nextEvent: nextEvent
        ? { id: nextEvent.id, title: nextEvent.title, startAt: nextEvent.startAt }
        : null,
      openActionItems: openCount,
    };
  });

  const eventsWithOverdueChecklist = allEvents
    .filter((e) => e.usePlanningChecklist && new Date(e.startAt) > new Date())
    .filter((e) => {
      const items = checklistItems.filter((c) => c.eventId === e.id);
      return items.some((item) => isOverdue(item.dueDate, item.status));
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt,
      committeeId: e.committeeId,
    }));

  const posterBacklog = posters.filter((p) => p.status !== "done");

  return NextResponse.json({
    committeeCards,
    widgets: {
      overdueActionItems: openActions.length,
      committeesNeedAttention: committeeCards.filter((c) =>
        committeeNeedsAttention(c.status),
      ).length,
      posterBacklog: posterBacklog.length,
      eventsWithOverdueChecklist,
    },
  });
}
