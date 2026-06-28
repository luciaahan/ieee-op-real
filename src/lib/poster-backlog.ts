import type { Event, Deliverable } from "@/lib/db/schema";

export type PosterBacklogItem = {
  id: string;
  status: string;
  dueDate: string | null;
  linkedEventId: string | null;
  eventTitle: string;
  eventDescription: string | null;
  posterNotes: string | null;
};

/** PR-specific notes stored in captionSummary (legacy rows may embed title — text). */
export function posterNotesFromDeliverable(
  deliverable: Pick<Deliverable, "captionSummary">,
  event: Pick<Event, "title" | "description"> | null,
): string | null {
  const summary = deliverable.captionSummary?.trim();
  if (!summary) return null;

  if (event) {
    const prefix = `${event.title} — `;
    if (summary.startsWith(prefix)) {
      const rest = summary.slice(prefix.length).trim();
      if (!rest) return null;
      if (event.description && rest === event.description.trim()) return null;
      return rest;
    }
  }

  return summary;
}

export function enrichPosterDeliverables(
  posters: Deliverable[],
  eventsById: Record<string, Event>,
): PosterBacklogItem[] {
  return posters
    .filter((d) => d.type === "poster")
    .map((d) => {
      const event = d.linkedEventId ? eventsById[d.linkedEventId] : null;
      return {
        id: d.id,
        status: d.status,
        dueDate: d.dueDate,
        linkedEventId: d.linkedEventId,
        eventTitle: event?.title ?? "Event poster",
        eventDescription: event?.description ?? null,
        posterNotes: posterNotesFromDeliverable(d, event),
      };
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}
