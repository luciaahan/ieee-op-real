import {
  getSemesterSettings,
  setSemesterSettings,
} from "@/lib/settings";
import type { SemesterSettings } from "@/lib/semester-types";
import { addMonths, format, parseISO } from "date-fns";

export type { SemesterSettings } from "@/lib/semester-types";
export { isDateInSemester } from "@/lib/semester-types";

function inferNextSemester(current: SemesterSettings): SemesterSettings {
  const end = parseISO(current.semesterEnd);
  const start = addMonths(end, 1);
  const nextEnd = addMonths(start, 4);
  const year = start.getFullYear();
  const month = start.getMonth();
  const label =
    month >= 7 ? `Fall ${year}` : month >= 0 && month < 6 ? `Spring ${year}` : `Summer ${year}`;

  return {
    semesterStart: format(start, "yyyy-MM-dd"),
    semesterEnd: format(nextEnd, "yyyy-MM-dd"),
    semesterLabel: label,
  };
}

/** Advance semester dates when the current period has ended. */
export async function ensureCurrentSemester(): Promise<SemesterSettings> {
  let settings = await getSemesterSettings();
  const today = format(new Date(), "yyyy-MM-dd");

  while (today > settings.semesterEnd) {
    settings = inferNextSemester(settings);
    await setSemesterSettings(settings);
  }

  return settings;
}

