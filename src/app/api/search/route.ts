import { NextResponse } from "next/server";
import { and, ilike, isNull, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, meetingNotes, committees } from "@/lib/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ events: [], meetingNotes: [] });
  }

  const pattern = `%${q}%`;

  const matchedEvents = await db
    .select({
      id: events.id,
      title: events.title,
      startAt: events.startAt,
      committeeId: events.committeeId,
      description: events.description,
    })
    .from(events)
    .where(
      and(
        isNull(events.deletedAt),
        or(ilike(events.title, pattern), ilike(events.description, pattern)),
      ),
    )
    .limit(25);

  const matchedNotes = await db
    .select({
      id: meetingNotes.id,
      meetingDate: meetingNotes.meetingDate,
      summary: meetingNotes.summary,
      committeeId: meetingNotes.committeeId,
    })
    .from(meetingNotes)
    .where(ilike(meetingNotes.summary, pattern))
    .limit(25);

  const committeeList = await db.select().from(committees);
  const committeeMap = Object.fromEntries(
    committeeList.map((c) => [c.id, c.name]),
  );

  return NextResponse.json({
    events: matchedEvents.map((e) => ({
      ...e,
      committeeName: committeeMap[e.committeeId] ?? "Unknown",
    })),
    meetingNotes: matchedNotes.map((n) => ({
      ...n,
      committeeName: committeeMap[n.committeeId] ?? "Unknown",
    })),
  });
}
