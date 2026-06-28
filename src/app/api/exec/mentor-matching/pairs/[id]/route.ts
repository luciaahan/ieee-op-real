import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageMentorMatching } from "@/lib/permissions";
import {
  confirmMentorPair,
  deleteMentorPair,
  getLatestMentorMatchingState,
} from "@/lib/mentor-matching";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMentorMatching(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    await confirmMentorPair(id, session.user.id, {
      mentorApplicationId: body.mentorApplicationId as string | undefined,
      menteeApplicationId: body.menteeApplicationId as string | undefined,
    });
    const state = await getLatestMentorMatchingState();
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update pair.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMentorMatching(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteMentorPair(id);
    const state = await getLatestMentorMatchingState();
    return NextResponse.json(state);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not delete pair.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
