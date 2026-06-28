import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, committees } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";
import { getEventById, syncConditionalChecklistItems } from "@/lib/events";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await getEventById(id);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...data,
    canEdit: data.committee
      ? canEdit(session.user, data.committee.slug)
      : false,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await getEventById(id);
  if (!data?.committee) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!canEdit(session.user, data.committee.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  if (
    body.signupFormUrl !== undefined &&
    !String(body.signupFormUrl).trim()
  ) {
    return NextResponse.json(
      { error: "RSVP link is required." },
      { status: 400 },
    );
  }

  const needsFoodSponsored =
    body.needsFoodSponsored !== undefined
      ? body.needsFoodSponsored
      : (data.event.needsFoodSponsored ?? false);
  const needsFoodInternal =
    body.needsFoodInternal !== undefined
      ? body.needsFoodInternal
      : (data.event.needsFoodInternal ?? false);

  await db
    .update(events)
    .set({
      title: body.title ?? data.event.title,
      startAt: body.startAt ?? data.event.startAt,
      endAt: body.endAt ?? data.event.endAt,
      location: body.location ?? data.event.location,
      description: body.description ?? data.event.description,
      status: body.status ?? data.event.status,
      signupFormUrl:
        body.signupFormUrl !== undefined
          ? String(body.signupFormUrl).trim()
          : data.event.signupFormUrl,
      rsvpCount: body.rsvpCount ?? data.event.rsvpCount,
      needsFoodSponsored,
      needsFoodInternal,
      needsFood: needsFoodSponsored || needsFoodInternal,
      needsSupplies: body.needsSupplies ?? data.event.needsSupplies,
      hasExternalGuests:
        body.hasExternalGuests ?? data.event.hasExternalGuests,
      coHostIds:
        body.coHostIds !== undefined
          ? JSON.stringify(body.coHostIds)
          : data.event.coHostIds,
    })
    .where(eq(events.id, id));

  await syncConditionalChecklistItems(id);

  const updated = await getEventById(id);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, event.committeeId));

  if (!committee || !canEdit(session.user, committee.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .update(events)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(events.id, id));

  return NextResponse.json({ ok: true });
}
