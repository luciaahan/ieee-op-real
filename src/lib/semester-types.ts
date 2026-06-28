export type SemesterSettings = {
  semesterStart: string;
  semesterEnd: string;
  semesterLabel: string;
};

export function isDateInSemester(
  dateStr: string,
  semester: SemesterSettings,
): boolean {
  return dateStr >= semester.semesterStart && dateStr <= semester.semesterEnd;
}
