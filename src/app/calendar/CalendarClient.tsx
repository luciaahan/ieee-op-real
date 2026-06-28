"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";

type EventRow = {
  id: string;
  title: string;
  startAt: string;
  status: string;
  committeeId: string;
};

type Committee = { id: string; slug: string; name: string };

export function CalendarClient({
  events,
  committees,
  canCreate,
}: {
  events: EventRow[];
  committees: Committee[];
  canCreate: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  const now = Date.now();
  const sorted = [...events]
    .filter((e) => showAll || new Date(e.startAt).getTime() >= now)
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Event Calendar</h1>
          <p className="text-slate-600">
            {showAll ? "All org events" : "Upcoming events"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {showAll ? "Show Upcoming" : "Show All"}
          </button>
          {canCreate && (
            <Link
              href="/events/new"
              className="rounded bg-[#00629B] px-4 py-2 text-sm text-white hover:bg-[#004d7a]"
            >
              + Add Event
            </Link>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((event) => {
          const committee = committees.find((c) => c.id === event.committeeId);
          return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex items-center justify-between rounded border bg-white p-4 hover:border-[#00629B]/40"
            >
              <div>
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-slate-600">
                  {committee?.name} · {format(new Date(event.startAt), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={event.status} />
              </div>
            </Link>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-slate-500">
            {showAll ? "No events scheduled yet." : "No upcoming events."}
          </p>
        )}
      </div>
    </>
  );
}
