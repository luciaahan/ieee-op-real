import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionItems, committees, meetingNotes } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: meetingNoteId } = await params;
  const [note] = await db
    .select()
    .from(meetingNotes)
    .where(eq(meetingNotes.id, meetingNoteId));

  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [meetingCommittee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, note.committeeId));

  if (
    !meetingCommittee ||
    !canEdit(session.user, meetingCommittee.slug)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const description = (body.description as string | undefined)?.trim();
  const committeeId = body.committeeId as string | undefined;
  const ownerId = (body.ownerId as string | undefined) || null;
  const dueDate = (body.dueDate as string | undefined) || null;

  if (!description || !committeeId) {
    return NextResponse.json(
      { error: "description and committeeId are required." },
      { status: 400 },
    );
  }

  const [itemCommittee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, committeeId));

  if (!itemCommittee || !canEdit(session.user, itemCommittee.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const itemId = randomUUID();
  await db.insert(actionItems).values({
    id: itemId,
    meetingNoteId,
    committeeId,
    ownerId,
    description,
    dueDate,
    status: "open",
  });

  const [created] = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.id, itemId));

  return NextResponse.json(created, { status: 201 });
}
