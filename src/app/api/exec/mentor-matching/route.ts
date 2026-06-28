import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  canManageMentorMatching,
  canViewCommittee,
} from "@/lib/permissions";
import { EXEC_COMMITTEE_SLUG } from "@/lib/exec-attendance";
import { getLatestMentorMatchingState } from "@/lib/mentor-matching";
import { isGoogleSheetsConfigured } from "@/lib/google/sheets";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canViewCommittee(session.user, EXEC_COMMITTEE_SLUG)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const state = await getLatestMentorMatchingState();
  return NextResponse.json({
    ...state,
    sheetsConfigured: isGoogleSheetsConfigured(),
  });
}
