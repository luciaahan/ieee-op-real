import { NextResponse } from "next/server";
import { eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, committees } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";
import { createEvent } from "@/lib/events";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const committeeSlug = searchParams.get("committee");

  let query = db.select().from(events).where(isNull(events.deletedAt));

  const allEvents = await query;
  let filtered = allEvents;

  if (committeeSlug) {
    const [committee] = await db
      .select()
      .from(committees)
      .where(eq(committees.slug, committeeSlug));
    if (committee) {
      filtered = allEvents.filter((e) => e.committeeId === committee.id);
    }
  }

  return NextResponse.json(filtered);
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

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required." }, { status: 400 });
  }

  if (!body.description?.trim()) {
    return NextResponse.json(
      { error: "Event description is required." },
      { status: 400 },
    );
  }

  if (!body.signupFormUrl?.trim()) {
    return NextResponse.json(
      { error: "RSVP link is required." },
      { status: 400 },
    );
  }

  const startAt = new Date(body.startAt).toISOString();
  const endAt = body.endAt ? new Date(body.endAt).toISOString() : undefined;

  const { eventId, posterRequested, roomBookingRequested } = await createEvent({
    committeeId: committee.id,
    committeeSlug: committee.slug,
    title: body.title,
    startAt,
    endAt,
    location: body.location,
    description: body.description.trim(),
    signupFormUrl: body.signupFormUrl.trim(),
    posterNotes: body.posterNotes,
    recurrence: body.recurrence,
    status: body.status,
    needsFood: body.needsFood,
    needsFoodSponsored: body.needsFoodSponsored,
    needsFoodInternal: body.needsFoodInternal,
    needsSupplies: body.needsSupplies,
    hasExternalGuests: body.hasExternalGuests,
    requestRoomBooking: body.requestRoomBooking,
    roomBookingNotes: body.roomBookingNotes,
  });

  return NextResponse.json(
    { id: eventId, posterRequested, roomBookingRequested },
    { status: 201 },
  );
}
