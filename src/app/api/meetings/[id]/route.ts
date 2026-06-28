import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  meetingNotes,
  actionItems,
  committees,
  users,
} from "@/lib/db/schema";

import { canEdit } from "@/lib/permissions";
import { parseAttendeeIds } from "@/lib/exec-attendance";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [note] = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id));

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, note.committeeId));

  const [author] = await db
    .select()
    .from(users)
    .where(eq(users.id, note.authorId));

  const items = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.meetingNoteId, id));

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      let ownerName: string | null = null;
      if (item.ownerId) {
        const [owner] = await db
          .select()
          .from(users)
          .where(eq(users.id, item.ownerId));
        ownerName = owner?.name ?? null;
      }
      return { ...item, ownerName };
    }),
  );

  return NextResponse.json({
    note,
    committee,
    author,
    actionItems: enrichedItems,
    attendeeIds: parseAttendeeIds(note.attendeeIds),
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
  const [note] = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id));

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, note.committeeId));

  if (!committee || !canEdit(session.user, committee.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  await db
    .update(meetingNotes)
    .set({
      meetingDate: body.meetingDate ?? note.meetingDate,
      summary: body.summary ?? note.summary,
      attendeeIds: body.attendeeIds
        ? JSON.stringify(body.attendeeIds)
        : note.attendeeIds,
    })
    .where(eq(meetingNotes.id, id));

  const [updated] = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id));

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
  const [note] = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.id, id));

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, note.committeeId));

  if (!committee || !canEdit(session.user, committee.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(actionItems).where(eq(actionItems.meetingNoteId, id));
  await db.delete(meetingNotes).where(eq(meetingNotes.id, id));

  return NextResponse.json({ ok: true });
}
