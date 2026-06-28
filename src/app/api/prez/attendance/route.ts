import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetingNotes, committees } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";
import {
  EXEC_COMMITTEE_ID,
  PREZ_COMMITTEE_ID,
  weekStartKey,
  buildExecAttendanceMatrix,
  type MeetingNoteAttendance,
} from "@/lib/exec-attendance";
import { getExecRoster } from "@/lib/exec-roster";

async function getExecMeetingNotes(): Promise<MeetingNoteAttendance[]> {
  return db
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
}

function findNoteForWeek(
  notes: MeetingNoteAttendance[],
  meetingDate: string,
): MeetingNoteAttendance | undefined {
  const targetWeek = weekStartKey(meetingDate);
  return notes.find((note) => weekStartKey(note.meetingDate) === targetWeek);
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roster = await getExecRoster();
  const notes = await getExecMeetingNotes();
  const matrix = buildExecAttendanceMatrix(roster, notes);

  return NextResponse.json(matrix);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canEdit(session.user, "prez")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const meetingDate = body.meetingDate as string | undefined;
  const attendeeIds = (body.attendeeIds as string[] | undefined) ?? [];
  const summary = (body.summary as string | undefined)?.trim() ?? "";

  if (!meetingDate) {
    return NextResponse.json(
      { error: "Meeting date is required." },
      { status: 400 },
    );
  }

  const [execCommittee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, EXEC_COMMITTEE_ID));

  if (!execCommittee) {
    return NextResponse.json({ error: "Exec committee not found." }, { status: 500 });
  }

  const notes = await getExecMeetingNotes();
  const existing = findNoteForWeek(notes, meetingDate);
  const attendeeIdsJson = JSON.stringify(attendeeIds);

  if (existing) {
    await db
      .update(meetingNotes)
      .set({
        meetingDate,
        attendeeIds: attendeeIdsJson,
        ...(summary ? { summary } : {}),
      })
      .where(eq(meetingNotes.id, existing.id));

    return NextResponse.json({ id: existing.id, updated: true });
  }

  const noteId = randomUUID();
  await db.insert(meetingNotes).values({
    id: noteId,
    committeeId: EXEC_COMMITTEE_ID,
    authorId: session.user.id,
    meetingDate,
    summary: summary || "Weekly exec meeting — attendance logged.",
    attendeeIds: attendeeIdsJson,
  });

  return NextResponse.json({ id: noteId, updated: false }, { status: 201 });
}
