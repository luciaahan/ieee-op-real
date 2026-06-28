import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InternalLayout } from "@/components/InternalLayout";
import { CommitteeCard } from "@/components/CommitteeCard";
import { db } from "@/lib/db";
import {
  committees,
  events,
  deliverables,
  actionItems,
  eventChecklistItems,
  goals,
} from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { getUpcomingEvents } from "@/lib/kpi";
import { isOverdue } from "@/lib/checklist";
import {
  getCurrentMonthPeriod,
  formatMonthRange,
  getEventsInMonth,
} from "@/lib/month-period";
import { format } from "date-fns";
import { canViewAllCommittees } from "@/lib/permissions";
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

const COMPLETED_STATUSES = new Set(["completed", "confirmed"]);

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const month = getCurrentMonthPeriod();
  const semester = await getSemesterSettings();

  const allCommittees = await db.select().from(committees).orderBy(committees.sortOrder);
  const visibleCommittees = canViewAllCommittees(session.user)
    ? allCommittees
    : allCommittees.filter((c) =>
        session.user.committeeEditScopes.includes(c.slug),
      );
  const allEvents = await db.select().from(events).where(isNull(events.deletedAt));
  const openActions = filterActionItemsForUser(
    session.user,
    await db.select().from(actionItems).where(eq(actionItems.status, "open")),
  );
  const posters = await db.select().from(deliverables).where(eq(deliverables.type, "poster"));
  const roomBookings = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.type, "room_booking"));
  const checklistItems = await db.select().from(eventChecklistItems);
  const allGoals = await db.select().from(goals);

  const committeeMap = Object.fromEntries(allCommittees.map((c) => [c.id, c]));
  const eventsById = Object.fromEntries(allEvents.map((e) => [e.id, e]));
  const goalsByCommittee = new Map<string, typeof allGoals>();
  for (const goal of allGoals) {
    const list = goalsByCommittee.get(goal.committeeId) ?? [];
    list.push(goal);
    goalsByCommittee.set(goal.committeeId, list);
  }
  const visibleCommitteeIds = new Set(visibleCommittees.map((c) => c.id));

  const eventsThisMonth = getEventsInMonth(
    allEvents.filter((e) => visibleCommitteeIds.has(e.committeeId)),
    month,
  );

  const cards = visibleCommittees.map((committee) => {
    const committeeEvents = allEvents.filter((e) => e.committeeId === committee.id);
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

    return {
      ...committee,
      status,
      semesterProgress,
      nextEvent,
      openActionItems: openActions.filter((a) => a.committeeId === committee.id).length,
      backlogCount:
        committee.trackingType === "deliverables"
          ? posters.filter((p) => p.status !== "done").length
          : committee.trackingType === "rooms"
            ? roomBookings.filter((r) => r.status !== "done").length
            : undefined,
    };
  });

  const overduePlanning = allEvents
    .filter((e) => e.usePlanningChecklist && new Date(e.startAt) > new Date())
    .filter((e) =>
      checklistItems
        .filter((c) => c.eventId === e.id)
        .some((item) => isOverdue(item.dueDate, item.status)),
    );

  const completedCount = eventsThisMonth.filter((e) =>
    COMPLETED_STATUSES.has(e.status),
  ).length;

  return (
    <InternalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600">
          Weekly exec meeting — {format(new Date(), "MMM d, yyyy")} · {month.monthLabel}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        {openActions.length > 0 && (
          <span className="rounded bg-red-50 px-3 py-1 text-red-700">
            {openActions.length} overdue/open action item
            {openActions.length === 1 ? "" : "s"}
          </span>
        )}
        {canViewAllCommittees(session.user) && (
          <span className="rounded bg-amber-50 px-3 py-1 text-amber-700">
            {cards.filter((c) => committeeNeedsAttention(c.status)).length} committees need attention
          </span>
        )}
        {eventsThisMonth.length > 0 && (
          <span className="rounded bg-green-50 px-3 py-1 text-green-700">
            {completedCount}/{eventsThisMonth.length} events done this month
          </span>
        )}
      </div>

      {overduePlanning.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Event planning due</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {overduePlanning.map((e) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="text-[#00629B] hover:underline">
                  {e.title} — {format(new Date(e.startAt), "MMM d")}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-slate-900">
        <h2 className="font-semibold text-slate-900">Events this month</h2>
        <p className="mt-1 text-sm text-slate-600">{formatMonthRange(month)}</p>
        {eventsThisMonth.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No events scheduled this month.
          </p>
        ) : (
          <ul className="mt-3 grid gap-1 text-sm text-slate-800 sm:grid-cols-2 lg:grid-cols-3">
            {eventsThisMonth.map((e) => {
              const completed = COMPLETED_STATUSES.has(e.status);
              const committee = committeeMap[e.committeeId];
              return (
                <li key={e.id}>
                  <span className={completed ? "text-green-700" : "text-amber-600"}>
                    {completed ? "✓" : "○"}
                  </span>{" "}
                  <span className="font-medium text-slate-700">
                    {committee?.name ?? "Unknown"}:
                  </span>{" "}
                  <Link
                    href={`/events/${e.id}`}
                    className="text-[#00629B] hover:underline"
                  >
                    {e.title}
                  </Link>
                  <span className="text-slate-600">
                    {" "}
                    · {format(new Date(e.startAt), "MMM d")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <CommitteeCard
            key={c.id}
            slug={c.slug}
            name={c.name}
            trackingType={c.trackingType}
            status={c.status}
            semesterProgress={c.semesterProgress}
            nextEvent={c.nextEvent}
            openActionItems={c.openActionItems}
            backlogCount={c.backlogCount}
          />
        ))}
      </div>
    </InternalLayout>
  );
}
