import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  mentorApplications,
  mentorMatchingCycles,
  mentorPairs,
} from "@/lib/db/schema";
import { fetchSpreadsheetRows } from "@/lib/google/sheets";
import {
  groupMentorApplications,
  parseMentorFormRows,
  processMentorApplications,
  suggestMentorPairs,
  computeUnmatchedFromPairs,
  mentorsOverMenteeThreshold,
  type MentorAreaGroup,
  type ParsedMentorApplication,
} from "@/lib/mentor-pairing";
import { EXEC_COMMITTEE_ID } from "@/lib/exec-attendance";

export type MentorMatchingApplicationView = {
  id: string;
  andrewId: string;
  grade: string;
  role: string;
  areas: string;
  bucket: string;
  gradeOrder: number;
};

export type MentorMatchingPairView = {
  id: string;
  mentorApplicationId: string;
  menteeApplicationId: string;
  mentorAndrewId: string;
  menteeAndrewId: string;
  matchedArea: string;
  status: string;
  isAutoSuggested: boolean;
  confirmedAt: string | null;
};

export type MentorMatchingState = {
  cycle: {
    id: string;
    label: string;
    sheetUrl: string | null;
    status: string;
    syncedAt: string | null;
    finalizedAt: string | null;
  } | null;
  applications: MentorMatchingApplicationView[];
  groups: MentorAreaGroup[];
  pairs: MentorMatchingPairView[];
  unmatched: MentorMatchingApplicationView[];
  stats: {
    totalApplications: number;
    suggestedPairs: number;
    confirmedPairs: number;
    unmatchedCount: number;
  };
  overloadedMentors: {
    mentorApplicationId: string;
    andrewId: string;
    menteeCount: number;
  }[];
};

function toApplicationView(
  app: typeof mentorApplications.$inferSelect,
): MentorMatchingApplicationView {
  return {
    id: app.id,
    andrewId: app.andrewId,
    grade: app.grade,
    role: app.role,
    areas: app.areas,
    bucket: app.bucket,
    gradeOrder: app.gradeOrder,
  };
}

function computeUnmatched(
  applications: MentorMatchingApplicationView[],
  pairs: MentorMatchingPairView[],
): MentorMatchingApplicationView[] {
  return computeUnmatchedFromPairs(applications, pairs);
}

async function assertMenteeAvailable(
  cycleId: string,
  menteeApplicationId: string,
  excludePairId?: string,
) {
  const existing = await db
    .select({ id: mentorPairs.id, menteeApplicationId: mentorPairs.menteeApplicationId })
    .from(mentorPairs)
    .where(eq(mentorPairs.cycleId, cycleId));

  const conflict = existing.find(
    (p) =>
      p.menteeApplicationId === menteeApplicationId && p.id !== excludePairId,
  );
  if (conflict) {
    throw new Error("This mentee is already paired with a mentor.");
  }
}

export async function getLatestMentorMatchingState(): Promise<MentorMatchingState> {
  const [cycle] = await db
    .select()
    .from(mentorMatchingCycles)
    .where(eq(mentorMatchingCycles.committeeId, EXEC_COMMITTEE_ID))
    .orderBy(desc(mentorMatchingCycles.createdAt))
    .limit(1);

  if (!cycle) {
    return {
      cycle: null,
      applications: [],
      groups: [],
      pairs: [],
      unmatched: [],
      stats: {
        totalApplications: 0,
        suggestedPairs: 0,
        confirmedPairs: 0,
        unmatchedCount: 0,
      },
      overloadedMentors: [],
    };
  }

  const apps = await db
    .select()
    .from(mentorApplications)
    .where(eq(mentorApplications.cycleId, cycle.id));

  const pairRows = await db
    .select()
    .from(mentorPairs)
    .where(eq(mentorPairs.cycleId, cycle.id));

  const appById = new Map(apps.map((a) => [a.id, a]));
  const applicationViews = apps.map(toApplicationView);

  const pairs: MentorMatchingPairView[] = pairRows.map((pair) => {
    const mentor = appById.get(pair.mentorApplicationId);
    const mentee = appById.get(pair.menteeApplicationId);
    return {
      id: pair.id,
      mentorApplicationId: pair.mentorApplicationId,
      menteeApplicationId: pair.menteeApplicationId,
      mentorAndrewId: mentor?.andrewId ?? "",
      menteeAndrewId: mentee?.andrewId ?? "",
      matchedArea: pair.matchedArea,
      status: pair.status,
      isAutoSuggested: pair.isAutoSuggested ?? true,
      confirmedAt: pair.confirmedAt,
    };
  });

  const parsedApps: ParsedMentorApplication[] = apps.map((a) => ({
    andrewId: a.andrewId,
    grade: a.grade as ParsedMentorApplication["grade"],
    role: a.role as ParsedMentorApplication["role"],
    areas: a.areas,
    bucket: a.bucket as ParsedMentorApplication["bucket"],
    gradeOrder: a.gradeOrder,
  }));

  const unmatched = computeUnmatched(applicationViews, pairs);
  const overloadedMentors = mentorsOverMenteeThreshold(
    pairs,
    applicationViews,
  );

  return {
    cycle: {
      id: cycle.id,
      label: cycle.label,
      sheetUrl: cycle.sheetUrl,
      status: cycle.status,
      syncedAt: cycle.syncedAt,
      finalizedAt: cycle.finalizedAt,
    },
    applications: applicationViews,
    groups: groupMentorApplications(parsedApps),
    pairs,
    unmatched,
    stats: {
      totalApplications: apps.length,
      suggestedPairs: pairs.filter((p) => p.status === "suggested").length,
      confirmedPairs: pairs.filter((p) => p.status === "confirmed").length,
      unmatchedCount: unmatched.length,
    },
    overloadedMentors,
  };
}

async function persistCycleFromRows(
  label: string,
  sheetUrl: string | null,
  rows: string[][],
): Promise<MentorMatchingState> {
  const applications = parseMentorFormRows(rows);
  const { suggestions } = suggestMentorPairs(applications);

  const inProgress = await db
    .select()
    .from(mentorMatchingCycles)
    .where(eq(mentorMatchingCycles.committeeId, EXEC_COMMITTEE_ID));

  for (const old of inProgress) {
    if (old.status === "in_progress") {
      await db
        .delete(mentorMatchingCycles)
        .where(eq(mentorMatchingCycles.id, old.id));
    }
  }

  const cycleId = randomUUID();
  const now = new Date().toISOString();

  await db.insert(mentorMatchingCycles).values({
    id: cycleId,
    committeeId: EXEC_COMMITTEE_ID,
    label,
    sheetUrl,
    status: "in_progress",
    syncedAt: now,
  });

  const appIdByAndrew = new Map<string, string>();
  for (const app of applications) {
    const id = randomUUID();
    appIdByAndrew.set(app.andrewId, id);
    await db.insert(mentorApplications).values({
      id,
      cycleId,
      andrewId: app.andrewId,
      grade: app.grade,
      role: app.role,
      areas: app.areas,
      bucket: app.bucket,
      gradeOrder: app.gradeOrder,
    });
  }

  for (const suggestion of suggestions) {
    const mentorId = appIdByAndrew.get(suggestion.mentorAndrewId);
    const menteeId = appIdByAndrew.get(suggestion.menteeAndrewId);
    if (!mentorId || !menteeId) continue;

    await db.insert(mentorPairs).values({
      id: randomUUID(),
      cycleId,
      mentorApplicationId: mentorId,
      menteeApplicationId: menteeId,
      matchedArea: suggestion.matchedArea,
      status: "suggested",
      isAutoSuggested: true,
    });
  }

  return getLatestMentorMatchingState();
}

export async function syncMentorMatchingFromSheet(
  sheetUrl: string,
  label: string,
): Promise<MentorMatchingState> {
  const rows = await fetchSpreadsheetRows(sheetUrl);
  return persistCycleFromRows(label, sheetUrl, rows);
}

export async function syncMentorMatchingFromTsv(
  tsvContent: string,
  label: string,
): Promise<MentorMatchingState> {
  const rows = tsvContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split("\t"));

  return persistCycleFromRows(label, null, rows);
}

export async function confirmMentorPair(
  pairId: string,
  userId: string,
  updates?: {
    mentorApplicationId?: string;
    menteeApplicationId?: string;
  },
): Promise<void> {
  const [pair] = await db
    .select()
    .from(mentorPairs)
    .where(eq(mentorPairs.id, pairId));

  if (!pair) throw new Error("Pair not found.");

  const menteeId =
    updates?.menteeApplicationId ?? pair.menteeApplicationId;
  await assertMenteeAvailable(pair.cycleId, menteeId, pairId);

  const [cycle] = await db
    .select()
    .from(mentorMatchingCycles)
    .where(eq(mentorMatchingCycles.id, pair.cycleId));

  if (!cycle || cycle.status === "finalized") {
    throw new Error("This matching cycle is finalized.");
  }

  await db
    .update(mentorPairs)
    .set({
      ...(updates?.mentorApplicationId
        ? { mentorApplicationId: updates.mentorApplicationId }
        : {}),
      ...(updates?.menteeApplicationId
        ? { menteeApplicationId: updates.menteeApplicationId }
        : {}),
      status: "confirmed",
      confirmedAt: new Date().toISOString(),
      confirmedBy: userId,
      isAutoSuggested: false,
    })
    .where(eq(mentorPairs.id, pairId));
}

export async function createManualMentorPair(
  cycleId: string,
  mentorApplicationId: string,
  menteeApplicationId: string,
  matchedArea: string,
  userId: string,
): Promise<void> {
  const [cycle] = await db
    .select()
    .from(mentorMatchingCycles)
    .where(eq(mentorMatchingCycles.id, cycleId));

  if (!cycle || cycle.status === "finalized") {
    throw new Error("This matching cycle is finalized.");
  }

  await assertMenteeAvailable(cycleId, menteeApplicationId);

  const now = new Date().toISOString();
  await db.insert(mentorPairs).values({
    id: randomUUID(),
    cycleId,
    mentorApplicationId,
    menteeApplicationId,
    matchedArea,
    status: "confirmed",
    isAutoSuggested: false,
    confirmedAt: now,
    confirmedBy: userId,
  });
}

export async function deleteMentorPair(pairId: string): Promise<void> {
  const [pair] = await db
    .select()
    .from(mentorPairs)
    .where(eq(mentorPairs.id, pairId));

  if (!pair) return;

  const [cycle] = await db
    .select()
    .from(mentorMatchingCycles)
    .where(eq(mentorMatchingCycles.id, pair.cycleId));

  if (cycle?.status === "finalized") {
    throw new Error("Cannot delete pairs from a finalized cycle.");
  }

  await db.delete(mentorPairs).where(eq(mentorPairs.id, pairId));
}

export async function finalizeMentorMatching(
  cycleId: string,
  userId: string,
): Promise<void> {
  const pairs = await db
    .select()
    .from(mentorPairs)
    .where(eq(mentorPairs.cycleId, cycleId));

  if (pairs.length === 0) {
    throw new Error("No pairs to finalize.");
  }

  const unconfirmed = pairs.filter((p) => p.status !== "confirmed");
  if (unconfirmed.length > 0) {
    throw new Error(
      `${unconfirmed.length} pair(s) still need exec confirmation.`,
    );
  }

  await db
    .update(mentorMatchingCycles)
    .set({
      status: "finalized",
      finalizedAt: new Date().toISOString(),
      finalizedBy: userId,
    })
    .where(eq(mentorMatchingCycles.id, cycleId));
}

export { processMentorApplications };
