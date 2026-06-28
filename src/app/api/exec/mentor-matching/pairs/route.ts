import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageMentorMatching } from "@/lib/permissions";
import {
  createManualMentorPair,
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
  const mentorApplicationId = body.mentorApplicationId as string | undefined;
  const menteeApplicationId = body.menteeApplicationId as string | undefined;
  const matchedArea = (body.matchedArea as string | undefined)?.trim();

  if (!cycleId || !mentorApplicationId || !menteeApplicationId || !matchedArea) {
    return NextResponse.json(
      { error: "cycleId, mentorApplicationId, menteeApplicationId, and matchedArea are required." },
      { status: 400 },
    );
  }

  try {
    await createManualMentorPair(
      cycleId,
      mentorApplicationId,
      menteeApplicationId,
      matchedArea,
      session.user.id,
    );
    const state = await getLatestMentorMatchingState();
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create pair.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
