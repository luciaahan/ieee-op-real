"use client";

import { useMemo, useState } from "react";
import {
  buildWeeklyAnnouncement,
  defaultAnnouncementRange,
  formatAnnouncementDateLine,
  type AnnouncementEvent,
} from "@/lib/weekly-announcements";

function RequiredMark() {
  return <span className="text-red-600">*</span>;
}

export function WeeklyAnnouncements({ events }: { events: AnnouncementEvent[] }) {
  const defaultRange = defaultAnnouncementRange();
  const [showPanel, setShowPanel] = useState(false);
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [copied, setCopied] = useState(false);

  const announcement = useMemo(
    () => buildWeeklyAnnouncement(events, startDate, endDate),
    [events, startDate, endDate],
  );

  async function copyAnnouncement() {
    await navigator.clipboard.writeText(announcement.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-900">Weekly announcements</h2>
        <button
          type="button"
          onClick={() => setShowPanel((v) => !v)}
          className="rounded border border-[#00629B] px-4 py-2 text-sm font-medium text-[#00629B] hover:bg-[#00629B]/5"
        >
          Create Weekly Announcements
        </button>
      </div>

      {showPanel && (
        <div className="mt-4 rounded border bg-white p-4">
          <p className="text-sm text-slate-600">
            Pulls all org events in the selected date range (excluding cancelled
            and completed).
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-700">
              From <RequiredMark />
              <input
                type="date"
                required
                className="ml-2 rounded border px-3 py-2"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-700">
              To <RequiredMark />
              <input
                type="date"
                required
                className="ml-2 rounded border px-3 py-2"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => void copyAnnouncement()}
              className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
          </div>

          {announcement.events.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{announcement.text}</p>
          ) : (
            <button
              type="button"
              onClick={() => void copyAnnouncement()}
              className="mt-4 w-full rounded border bg-slate-50 p-4 text-left transition hover:border-[#00629B]/40 hover:bg-slate-100"
            >
              <p className="mb-3 text-xs text-slate-500">
                {copied ? "Copied to clipboard!" : "Click to copy"}
              </p>
              <div className="space-y-6 text-sm text-slate-800">
                {announcement.events.map((event) => (
                  <div key={event.id}>
                    <p className="font-bold">{event.title}</p>
                    <p className="mt-1">
                      Date:{" "}
                      {formatAnnouncementDateLine(event.startAt, event.endAt)}
                    </p>
                    {event.location?.trim() && (
                      <p>Location: {event.location.trim()}</p>
                    )}
                    {event.description?.trim() && (
                      <p className="mt-1 whitespace-pre-wrap">
                        {event.description.trim()}
                      </p>
                    )}
                    {event.signupFormUrl?.trim() ? (
                      <p className="mt-1">RSVP Link: {event.signupFormUrl.trim()}</p>
                    ) : (
                      <p className="mt-1 text-amber-700">
                        RSVP Link: (not set)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </button>
          )}
        </div>
      )}
    </section>
  );
}
