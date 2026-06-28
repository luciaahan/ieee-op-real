import { subDays, format } from "date-fns";
import type { ChecklistCondition } from "@/lib/seed-data";
import type { Event } from "@/lib/db/schema";

export type EventFoodFlags = Pick<
  Event,
  "needsFood" | "needsFoodSponsored" | "needsFoodInternal"
>;

export function eventNeedsFood(event: EventFoodFlags): boolean {
  return !!(
    event.needsFoodSponsored ||
    event.needsFoodInternal ||
    event.needsFood
  );
}

export function itemApplies(
  condition: ChecklistCondition,
  event: Pick<Event, "needsFood" | "needsFoodSponsored" | "needsFoodInternal" | "needsSupplies" | "hasExternalGuests">,
): boolean {
  switch (condition) {
    case "always":
      return true;
    case "needs_food":
      return eventNeedsFood(event);
    case "needs_supplies":
      return !!event.needsSupplies;
    case "has_external_guests":
      return !!event.hasExternalGuests;
    case "needs_food_or_supplies":
      return eventNeedsFood(event) || !!event.needsSupplies;
    default:
      return true;
  }
}

export function computeDueDate(startAt: string, offsetDays: number): string {
  return format(subDays(new Date(startAt), offsetDays), "yyyy-MM-dd");
}

export function shouldUsePlanningChecklist(
  committeeSlug: string,
  recurrence: string,
): boolean {
  if (committeeSlug === "prez" && (recurrence === "weekly" || recurrence === "biweekly")) {
    return false;
  }
  return true;
}

export function milestoneLabel(offsetDays: number): string {
  switch (offsetDays) {
    case 14:
      return "2 weeks before";
    case 7:
      return "1 week before";
    case 3:
      return "3 days before";
    case 0:
      return "Day of event";
    default:
      return `${offsetDays} days before`;
  }
}

export function isOverdue(dueDate: string, status: string): boolean {
  if (status !== "pending") return false;
  const today = format(new Date(), "yyyy-MM-dd");
  return dueDate < today;
}

export function checklistProgress(
  items: { status: string; condition: string }[],
  event: Pick<Event, "needsFood" | "needsFoodSponsored" | "needsFoodInternal" | "needsSupplies" | "hasExternalGuests">,
): { done: number; total: number } {
  const applicable = items.filter((item) =>
    itemApplies(item.condition as ChecklistCondition, event),
  );
  const done = applicable.filter(
    (item) => item.status === "done" || item.status === "not_applicable",
  ).length;
  return { done, total: applicable.length };
}

export function parseCoHostIds(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
