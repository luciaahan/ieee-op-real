import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InternalLayout } from "@/components/InternalLayout";
import { CommitteePageClient } from "./CommitteePageClient";
import { db } from "@/lib/db";
import {
  committees,
  events,
  meetingNotes,
  actionItems,
  deliverables,
  goals,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { canEdit, canManageMentorMatching, canViewCommittee } from "@/lib/permissions";
import { filterActionItemsForUser } from "@/lib/action-items";
import { enrichPosterDeliverables } from "@/lib/poster-backlog";
import { getExecRoster } from "@/lib/exec-roster";
import {
  buildExecAttendanceMatrix,
  EXEC_COMMITTEE_ID,
  PREZ_COMMITTEE_ID,
} from "@/lib/exec-attendance";
import { getAllExpenses, sumExpenses } from "@/lib/expenses";
import { getSemesterSettings } from "@/lib/settings";
import { countCompletedEventsInSemester } from "@/lib/committee-status";
import { findSemesterEventGoal, parseEventTarget } from "@/lib/goals";

export default async function CommitteePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.slug, slug));

  if (!committee) notFound();
  if (!canViewCommittee(session.user, slug)) redirect("/dashboard");

  const committeeEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.committeeId, committee.id), isNull(events.deletedAt)));

  const notes = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.committeeId, committee.id));

  const items = filterActionItemsForUser(
    session.user,
    await db
      .select()
      .from(actionItems)
      .where(
        and(
          eq(actionItems.committeeId, committee.id),
          eq(actionItems.status, "open"),
        ),
      ),
  );

  const enrichedActionItems = await Promise.all(
    items.map(async (item) => {
      if (!item.ownerId) return { ...item, ownerName: null };
      const [owner] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, item.ownerId));
      return { ...item, ownerName: owner?.name ?? null };
    }),
  );

  const committeeGoals = await db
    .select()
    .from(goals)
    .where(eq(goals.committeeId, committee.id));

  let deliverableList: (typeof deliverables.$inferSelect)[] = [];
  let posterBacklog: ReturnType<typeof enrichPosterDeliverables> = [];
  if (committee.slug === "pr" || committee.slug === "internal-relations") {
    deliverableList = await db.select().from(deliverables);
  }
  if (committee.slug === "pr") {
    const linkedEvents = await db
      .select()
      .from(events)
      .where(isNull(events.deletedAt));
    const eventsById = Object.fromEntries(linkedEvents.map((e) => [e.id, e]));
    posterBacklog = enrichPosterDeliverables(deliverableList, eventsById);
  }

  let execAttendance = null;
  let expenseList: Awaited<ReturnType<typeof getAllExpenses>> = [];
  let expenseTotal = 0;
  if (committee.slug === "prez") {
    const roster = await getExecRoster();
    const execNotes = await db
      .select({
        id: meetingNotes.id,
        meetingDate: meetingNotes.meetingDate,
        attendeeIds: meetingNotes.attendeeIds,
      })
      .from(meetingNotes)
      .where(
        or(
          eq(meetingNotes.committeeId, EXEC_COMMITTEE_ID),
          eq(meetingNotes.committeeId, PREZ_COMMITTEE_ID),
        ),
      );
    execAttendance = buildExecAttendanceMatrix(roster, execNotes);
    expenseList = await getAllExpenses();
    expenseTotal = sumExpenses(expenseList);
  }

  const semester = await getSemesterSettings();
  const semesterGoal = findSemesterEventGoal(committeeGoals);
  const semesterEventTarget = parseEventTarget(semesterGoal?.targetMetric ?? null);
  const completedEventsThisSemester =
    committee.trackingType === "events"
      ? countCompletedEventsInSemester(committeeEvents, semester)
      : 0;

  let announcementEvents: {
    id: string;
    title: string;
    startAt: string;
    endAt: string | null;
    location: string | null;
    description: string | null;
    signupFormUrl: string | null;
    status: string;
  }[] | undefined;

  if (committee.slug === "internal-relations") {
    announcementEvents = await db
      .select({
        id: events.id,
        title: events.title,
        startAt: events.startAt,
        endAt: events.endAt,
        location: events.location,
        description: events.description,
        signupFormUrl: events.signupFormUrl,
        status: events.status,
      })
      .from(events)
      .where(isNull(events.deletedAt));
  }

  return (
    <InternalLayout>
      <CommitteePageClient
        data={{
          committee,
          events: committeeEvents,
          meetingNotes: notes,
          actionItems: enrichedActionItems,
          goals: committeeGoals,
          semester: {
            label: semester.semesterLabel,
            eventTarget: semesterEventTarget,
            completedEvents: completedEventsThisSemester,
          },
          deliverables: deliverableList,
          posterBacklog,
          canEdit: canEdit(session.user, slug),
          canManageMentorMatching: canManageMentorMatching(session.user),
          execAttendance,
          expenses: expenseList,
          expenseTotal,
          announcementEvents,
        }}
      />
    </InternalLayout>
  );
}
