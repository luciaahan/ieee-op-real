export type MentorGrade =
  | "Freshman"
  | "Sophomore"
  | "Junior"
  | "Senior"
  | "IMB/Graduate";

export type MentorRole = "Mentor" | "Mentee";

export type MentorBucket = "single_area" | "multiple_areas" | "undecided";

export type ParsedMentorApplication = {
  andrewId: string;
  grade: MentorGrade;
  role: MentorRole;
  areas: string;
  bucket: MentorBucket;
  gradeOrder: number;
};

export type MentorAreaGroup = {
  areaKey: string;
  bucket: MentorBucket;
  applications: ParsedMentorApplication[];
  stats: {
    mentors: number;
    mentees: number;
    unmatchedMentees: number;
    unmatchedMentors: number;
  };
};

export type SuggestedMentorPair = {
  mentorAndrewId: string;
  menteeAndrewId: string;
  matchedArea: string;
};

export type MentorPairingResult = {
  applications: ParsedMentorApplication[];
  groups: MentorAreaGroup[];
  suggestions: SuggestedMentorPair[];
  unmatched: ParsedMentorApplication[];
};

const GRADE_ORDER: Record<MentorGrade, number> = {
  Freshman: 1,
  Sophomore: 2,
  Junior: 3,
  Senior: 4,
  "IMB/Graduate": 5,
};

export const LEGACY_COLUMN_MAP = {
  andrewId: 2,
  grade: 3,
  role: 4,
  areas: 5,
} as const;

function normalizeGrade(raw: string): MentorGrade | null {
  const value = raw.trim();
  if (!value) return null;
  if (value in GRADE_ORDER) return value as MentorGrade;

  const lower = value.toLowerCase();
  if (/fresh/i.test(lower)) return "Freshman";
  if (/soph/i.test(lower)) return "Sophomore";
  if (/junior/i.test(lower)) return "Junior";
  if (/senior/i.test(lower)) return "Senior";
  if (/imb|graduate|grad student|masters?|phd|ph\.d|doctoral/i.test(lower)) {
    return "IMB/Graduate";
  }

  return null;
}

function normalizeRole(raw: string): MentorRole | null {
  const value = raw.trim().toLowerCase();
  if (value.includes("mentor") && !value.includes("mentee")) return "Mentor";
  if (value.includes("mentee")) return "Mentee";
  return null;
}

function normalizeAreas(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Undecided";
  if (trimmed.toLowerCase().includes("undecided")) return "Undecided";
  const commaCount = (trimmed.match(/,/g) ?? []).length;
  if (commaCount >= 4) return "Undecided";
  return trimmed;
}

function assignBucket(areas: string): MentorBucket {
  if (areas === "Undecided") return "undecided";
  if (!areas.includes(",")) return "single_area";
  return "multiple_areas";
}

function applyGradeRoleRules(
  grade: MentorGrade,
  role: MentorRole | null,
): MentorRole {
  if (grade === "Freshman" || grade === "Sophomore") return "Mentee";
  if (grade === "IMB/Graduate") return "Mentor";
  return role ?? "Mentee";
}

function sortApplications(
  apps: ParsedMentorApplication[],
): ParsedMentorApplication[] {
  return [...apps].sort((a, b) => {
    if (a.areas !== b.areas) return a.areas.localeCompare(b.areas);
    if (a.role !== b.role) return a.role.localeCompare(b.role);
    return a.gradeOrder - b.gradeOrder;
  });
}

function findColumnIndex(headers: string[], patterns: RegExp[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]?.toLowerCase() ?? "";
    if (patterns.some((pattern) => pattern.test(header))) return i;
  }
  return -1;
}

function resolveColumnMap(headers: string[]) {
  const trimmedHeaders = headers.map((h) => h?.trim() ?? "");

  const andrewIdx = findColumnIndex(trimmedHeaders, [
    /andrew\s*id/i,
    /andrew/i,
    /cmu\s*id/i,
    /username/i,
  ]);

  const emailIdx = findColumnIndex(trimmedHeaders, [
    /email/i,
    /@/,
  ]);

  const gradeIdx = findColumnIndex(trimmedHeaders, [
    /what (?:is )?your (?:class )?year/i,
    /class year/i,
    /grade level/i,
    /\bgrade\b/i,
    /\byear\b/i,
  ]);

  const roleIdx = findColumnIndex(trimmedHeaders, [
    /mentor.*mentee|mentee.*mentor/i,
    /want to be/i,
    /prefer to be/i,
    /mentor\/mentee/i,
    /be a mentor/i,
  ]);

  const areaIdx = findColumnIndex(trimmedHeaders, [
    /area.*interest/i,
    /interest.*area/i,
    /ece area/i,
    /\bareas?\b/i,
    /interest/i,
    /focus/i,
  ]);

  const andrewIdCol =
    andrewIdx >= 0
      ? andrewIdx
      : emailIdx >= 0
        ? emailIdx
        : LEGACY_COLUMN_MAP.andrewId;

  return {
    map: {
      andrewId: andrewIdCol,
      grade: gradeIdx >= 0 ? gradeIdx : LEGACY_COLUMN_MAP.grade,
      role: roleIdx >= 0 ? roleIdx : LEGACY_COLUMN_MAP.role,
      areas: areaIdx >= 0 ? areaIdx : LEGACY_COLUMN_MAP.areas,
    },
    headers: trimmedHeaders,
  };
}

function stripTimestampColumn(headers: string[], dataRows: string[][]) {
  const first = headers[0]?.trim() ?? "";
  if (!/timestamp|time submitted|date submitted|submission time/i.test(first)) {
    return { headers, dataRows };
  }

  return {
    headers: headers.slice(1),
    dataRows: dataRows.map((row) => row.slice(1)),
  };
}

function normalizeAndrewId(raw: string): string {
  const value = raw.trim();
  const emailMatch = value.match(/^([^@]+)@(?:andrew\.)?cmu\.edu$/i);
  if (emailMatch) return emailMatch[1];
  return value;
}

function parseTabularRows(rows: string[][]): ParsedMentorApplication[] {
  if (rows.length < 2) {
    throw new Error("Sheet must include a header row and at least one response.");
  }

  let headers = rows[0].map((h) => h?.trim() ?? "");
  let dataRows = rows.slice(1);

  ({ headers, dataRows } = stripTimestampColumn(headers, dataRows));

  const { map } = resolveColumnMap(headers);

  const applications: ParsedMentorApplication[] = [];
  let skippedMissingAndrew = 0;
  let skippedInvalidGrade = 0;
  let sampleGradeValues: string[] = [];

  for (const row of dataRows) {
    const andrewId = normalizeAndrewId(row[map.andrewId]?.trim() ?? "");
    const gradeRaw = row[map.grade]?.trim() ?? "";
    const roleRaw = row[map.role]?.trim() ?? "";
    const areasRaw = row[map.areas]?.trim() ?? "";

    if (!andrewId) {
      skippedMissingAndrew += 1;
      continue;
    }

    const grade = normalizeGrade(gradeRaw);
    if (!grade) {
      skippedInvalidGrade += 1;
      if (sampleGradeValues.length < 3 && gradeRaw) {
        sampleGradeValues.push(gradeRaw);
      }
      continue;
    }

    const areas = normalizeAreas(areasRaw);
    const role = applyGradeRoleRules(grade, normalizeRole(roleRaw));

    applications.push({
      andrewId,
      grade,
      role,
      areas,
      bucket: assignBucket(areas),
      gradeOrder: GRADE_ORDER[grade],
    });
  }

  if (applications.length === 0) {
    const headerPreview = headers.slice(0, 8).join(" | ");
    throw new Error(
      [
        "No valid mentor/mentee responses found.",
        `Detected columns — Andrew: col ${map.andrewId + 1}, Grade: col ${map.grade + 1}, Role: col ${map.role + 1}, Area: col ${map.areas + 1}.`,
        `Headers: ${headerPreview}`,
        skippedInvalidGrade > 0
          ? `Skipped ${skippedInvalidGrade} row(s) with unrecognized grade values${sampleGradeValues.length ? ` (e.g. "${sampleGradeValues.join('", "')}")` : ""}. Expected Freshman, Sophomore, Junior, Senior, or IMB/Graduate.`
          : null,
        skippedMissingAndrew > 0
          ? `Skipped ${skippedMissingAndrew} row(s) with no Andrew ID.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  return sortApplications(applications);
}

export function parseMentorFormTsv(content: string): ParsedMentorApplication[] {
  const rows = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split("\t"));

  return parseTabularRows(rows);
}

export function parseMentorFormRows(rows: string[][]): ParsedMentorApplication[] {
  return parseTabularRows(rows);
}

export const MENTOR_MENTEE_WARN_THRESHOLD = 3;

export function countMenteesPerMentor(
  pairs: { mentorApplicationId: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pair of pairs) {
    counts.set(
      pair.mentorApplicationId,
      (counts.get(pair.mentorApplicationId) ?? 0) + 1,
    );
  }
  return counts;
}

export function computeUnmatchedFromPairs<
  T extends { id: string; role: string },
>(applications: T[], pairs: { mentorApplicationId: string; menteeApplicationId: string }[]): T[] {
  const pairedMenteeIds = new Set(pairs.map((p) => p.menteeApplicationId));
  const menteeCountByMentor = countMenteesPerMentor(pairs);

  return applications.filter((app) => {
    if (app.role === "Mentee") return !pairedMenteeIds.has(app.id);
    if (app.role === "Mentor") {
      return (menteeCountByMentor.get(app.id) ?? 0) === 0;
    }
    return false;
  });
}

export function mentorsOverMenteeThreshold(
  pairs: { mentorApplicationId: string; mentorAndrewId?: string }[],
  applications: { id: string; andrewId: string }[],
  threshold = MENTOR_MENTEE_WARN_THRESHOLD,
): { mentorApplicationId: string; andrewId: string; menteeCount: number }[] {
  const appById = new Map(applications.map((a) => [a.id, a]));
  const counts = countMenteesPerMentor(pairs);

  return [...counts.entries()]
    .filter(([, count]) => count > threshold)
    .map(([mentorApplicationId, menteeCount]) => ({
      mentorApplicationId,
      andrewId: appById.get(mentorApplicationId)?.andrewId ?? "",
      menteeCount,
    }))
    .sort((a, b) => b.menteeCount - a.menteeCount);
}

export function groupMentorApplications(
  applications: ParsedMentorApplication[],
): MentorAreaGroup[] {
  const byKey = new Map<string, ParsedMentorApplication[]>();

  for (const app of applications) {
    const key = `${app.bucket}::${app.areas}`;
    const list = byKey.get(key) ?? [];
    list.push(app);
    byKey.set(key, list);
  }

  const groups: MentorAreaGroup[] = [];

  for (const [, apps] of byKey) {
    const bucket = apps[0]?.bucket ?? "undecided";
    const areaKey = apps[0]?.areas ?? "";
    const sorted = sortApplications(apps);
    const mentors = sorted.filter((a) => a.role === "Mentor");
    const mentees = sorted.filter((a) => a.role === "Mentee");

    groups.push({
      areaKey,
      bucket,
      applications: sorted,
      stats: {
        mentors: mentors.length,
        mentees: mentees.length,
        unmatchedMentees: Math.max(0, mentees.length - mentors.length),
        unmatchedMentors: Math.max(0, mentors.length - mentees.length),
      },
    });
  }

  return groups.sort((a, b) => {
    const bucketOrder = { single_area: 0, multiple_areas: 1, undecided: 2 };
    if (bucketOrder[a.bucket] !== bucketOrder[b.bucket]) {
      return bucketOrder[a.bucket] - bucketOrder[b.bucket];
    }
    return a.areaKey.localeCompare(b.areaKey);
  });
}

export function suggestMentorPairs(
  applications: ParsedMentorApplication[],
): { suggestions: SuggestedMentorPair[]; unmatched: ParsedMentorApplication[] } {
  const suggestions: SuggestedMentorPair[] = [];
  const pairedMenteeIds = new Set<string>();
  const mentorsWithMentees = new Set<string>();

  const singleAreaGroups = groupMentorApplications(
    applications.filter((a) => a.bucket === "single_area"),
  );

  for (const group of singleAreaGroups) {
    const mentors = group.applications
      .filter((a) => a.role === "Mentor")
      .sort((a, b) => b.gradeOrder - a.gradeOrder);
    const mentees = group.applications
      .filter((a) => a.role === "Mentee")
      .sort((a, b) => a.gradeOrder - b.gradeOrder);

    if (mentors.length === 0 || mentees.length === 0) continue;

    let mentorIndex = 0;
    for (const mentee of mentees) {
      const mentor = mentors[mentorIndex % mentors.length];
      mentorIndex += 1;
      suggestions.push({
        mentorAndrewId: mentor.andrewId,
        menteeAndrewId: mentee.andrewId,
        matchedArea: group.areaKey,
      });
      pairedMenteeIds.add(mentee.andrewId);
      mentorsWithMentees.add(mentor.andrewId);
    }
  }

  const unmatched = applications.filter((app) => {
    if (app.role === "Mentee") return !pairedMenteeIds.has(app.andrewId);
    if (app.role === "Mentor") return !mentorsWithMentees.has(app.andrewId);
    return false;
  });

  return { suggestions, unmatched };
}

export function processMentorApplications(
  applications: ParsedMentorApplication[],
): MentorPairingResult {
  const groups = groupMentorApplications(applications);
  const { suggestions, unmatched } = suggestMentorPairs(applications);

  return { applications, groups, suggestions, unmatched };
}

export function processMentorFormRows(rows: string[][]): MentorPairingResult {
  const applications = parseMentorFormRows(rows);
  return processMentorApplications(applications);
}

export function formatPairsForExport(
  pairs: {
    mentorAndrewId: string;
    menteeAndrewId: string;
    matchedArea: string;
    status: string;
  }[],
): string {
  const header = ["Mentor", "Mentee", "Area", "Status"];
  const lines = pairs.map((pair) =>
    [pair.mentorAndrewId, pair.menteeAndrewId, pair.matchedArea, pair.status].join(
      "\t",
    ),
  );
  return [header.join("\t"), ...lines].join("\n");
}
