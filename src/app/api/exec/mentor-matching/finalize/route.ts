import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageMentorMatching } from "@/lib/permissions";
import {
  finalizeMentorMatching,
  getLatestMentorMatchingState,
} from "@/lib/mentor-matching";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMentorMatching(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const cycleId = body.cycleId as string | undefined;

  if (!cycleId) {
    return NextResponse.json({ error: "cycleId is required." }, { status: 400 });
  }

  try {
    await finalizeMentorMatching(cycleId, session.user.id);
    const state = await getLatestMentorMatchingState();
    return NextResponse.json(state);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not finalize matching.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
