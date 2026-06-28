import type { Goal } from "@/lib/db/schema";

export const SEMESTER_EVENT_GOAL_TITLE = "Events this semester";

export function findSemesterEventGoal(goals: Goal[]): Goal | undefined {
  return goals.find(
    (g) =>
      g.title === SEMESTER_EVENT_GOAL_TITLE &&
      parseEventTarget(g.targetMetric) != null,
  );
}

export function parseEventTarget(targetMetric: string | null): number | null {
  if (!targetMetric) return null;
  const n = parseInt(targetMetric, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hasSemesterEventGoal(goals: Goal[]): boolean {
  return findSemesterEventGoal(goals) != null;
}
