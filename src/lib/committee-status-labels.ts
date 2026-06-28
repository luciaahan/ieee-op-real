export type CommitteeStatus =
  | "no_goals"
  | "on_track"
  | "keep_going"
  | "due_soon"
  | "lets_catch_up";

export const COMMITTEE_STATUS_LABELS: Record<CommitteeStatus, string> = {
  no_goals: "No goals",
  on_track: "On track",
  keep_going: "Keep going",
  due_soon: "Due soon",
  lets_catch_up: "Let's catch up",
};

export function committeeNeedsAttention(status: CommitteeStatus): boolean {
  return status !== "on_track" && status !== "no_goals";
}
