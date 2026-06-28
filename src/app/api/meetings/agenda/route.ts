import { NextResponse } from "next/server";
import { isNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, eventChecklistItems, committees } from "@/lib/db/schema";
import { buildMeetingAgenda } from "@/lib/meeting-agenda";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canCreate =
    session.user.canEditAll || session.user.committeeEditScopes.length > 0;
  if (!canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const meetingDate = searchParams.get("meetingDate")?.trim();
  if (!meetingDate || !/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
    return NextResponse.json(
      { error: "meetingDate is required (yyyy-MM-dd)" },
      { status: 400 },
    );
  }

  const [allEvents, checklistItems, committeeList] = await Promise.all([
    db.select().from(events).where(isNull(events.deletedAt)),
    db.select().from(eventChecklistItems),
    db.select().from(committees),
  ]);

  const committeeNames = Object.fromEntries(
    committeeList.map((c) => [c.id, c.name]),
  );

  const agenda = buildMeetingAgenda({
    meetingDate,
    events: allEvents,
    checklistItems,
    committeeNames,
  });

  return NextResponse.json(agenda);
}
