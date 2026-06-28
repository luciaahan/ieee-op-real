import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { goals, committees } from "@/lib/db/schema";
import { canEdit, canViewCommittee, canViewAllCommittees } from "@/lib/permissions";
import {
  SEMESTER_EVENT_GOAL_TITLE,
  parseEventTarget,
} from "@/lib/goals";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const committeeId = searchParams.get("committeeId");

  if (committeeId) {
    const [committee] = await db
      .select()
      .from(committees)
      .where(eq(committees.id, committeeId));
    if (!committee || !canViewCommittee(session.user, committee.slug)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(goals)
      .where(eq(goals.committeeId, committeeId));
    return NextResponse.json(rows);
  }

  const rows = await db.select().from(goals);
  if (canViewAllCommittees(session.user)) {
    return NextResponse.json(rows);
  }

  const allowedIds = new Set(
    (
      await db
        .select({ id: committees.id, slug: committees.slug })
        .from(committees)
    )
      .filter((c) => session.user.committeeEditScopes.includes(c.slug))
      .map((c) => c.id),
  );
  return NextResponse.json(rows.filter((g) => allowedIds.has(g.committeeId)));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, body.committeeId));

  if (!committee || !canEdit(session.user, committee.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const title = body.title ?? SEMESTER_EVENT_GOAL_TITLE;
  const targetMetric = body.targetMetric ?? null;

  if (title === SEMESTER_EVENT_GOAL_TITLE) {
    const target = parseEventTarget(targetMetric);
    if (target == null) {
      return NextResponse.json(
        { error: "Event target must be a positive number" },
        { status: 400 },
      );
    }

    const existing = await db
      .select()
      .from(goals)
      .where(eq(goals.committeeId, body.committeeId));

    const semesterGoal = existing.find((g) => g.title === SEMESTER_EVENT_GOAL_TITLE);
    if (semesterGoal) {
      await db
        .update(goals)
        .set({
          targetMetric: String(target),
          status: "in_progress",
        })
        .where(eq(goals.id, semesterGoal.id));
      return NextResponse.json({ id: semesterGoal.id });
    }
  }

  const id = randomUUID();
  await db.insert(goals).values({
    id,
    committeeId: body.committeeId,
    title,
    targetMetric: targetMetric ?? null,
    deadline: body.deadline ?? null,
    status: body.status ?? "in_progress",
    notes: body.notes ?? null,
  });

  return NextResponse.json({ id }, { status: 201 });
}
