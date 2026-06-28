import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import type { SemesterSettings } from "@/lib/semester-types";

export type { SemesterSettings } from "@/lib/semester-types";

const DEFAULTS: SemesterSettings = {
  semesterStart: "2026-01-10",
  semesterEnd: "2026-05-15",
  semesterLabel: "Spring 2026",
};

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key));

  if (existing) {
    await db
      .update(systemSettings)
      .set({ value, updatedAt: new Date().toISOString() })
      .where(eq(systemSettings.key, key));
  } else {
    await db.insert(systemSettings).values({ key, value });
  }
}

export async function getSemesterSettings(): Promise<SemesterSettings> {
  const [start, end, label] = await Promise.all([
    getSetting("semesterStart"),
    getSetting("semesterEnd"),
    getSetting("semesterLabel"),
  ]);

  return {
    semesterStart: start ?? DEFAULTS.semesterStart,
    semesterEnd: end ?? DEFAULTS.semesterEnd,
    semesterLabel: label ?? DEFAULTS.semesterLabel,
  };
}

export async function setSemesterSettings(settings: SemesterSettings) {
  await setSetting("semesterStart", settings.semesterStart);
  await setSetting("semesterEnd", settings.semesterEnd);
  await setSetting("semesterLabel", settings.semesterLabel);
}

export async function seedDefaultSettings() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    const existing = await getSetting(key);
    if (!existing) await setSetting(key, value);
  }
}
