"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parse } from "date-fns";

type Props = {
  committeeId: string;
  committeeSlug: string;
  committeeName: string;
};

const timeOptions = (() => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 8; hour <= 22; hour++) {
    for (const minute of ["00", "30"] as const) {
      if (hour === 22 && minute === "30") break;
      const value = `${String(hour).padStart(2, "0")}:${minute}`;
      options.push({
        value,
        label: format(parse(value, "HH:mm", new Date()), "h:mm a"),
      });
    }
  }
  return options;
})();

const LATEST_END_TIME = "22:00";

function endTimeAfterStart(startTime: string, hoursLater = 1.5): string {
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + hoursLater * 60;
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;

  if (endH > 22 || (endH === 22 && endM > 0)) {
    return LATEST_END_TIME;
  }

  const value = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return timeOptions.some((t) => t.value === value) ? value : LATEST_END_TIME;
}

const defaultForm = {
  title: "",
  startDate: "",
  startTime: "18:00",
  endTime: endTimeAfterStart("18:00"),
  location: "",
  description: "",
  signupFormUrl: "",
  posterNotes: "",
  needsFoodSponsored: false,
  needsFoodInternal: false,
  needsSupplies: false,
  hasExternalGuests: false,
  requestRoomBooking: false,
  roomBookingNotes: "",
};

function combineDateTime(date: string, time: string): string {
  return `${date}T${time}`;
}

export function AddEventClient({
  committeeId,
  committeeSlug,
  committeeName,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const startAt = combineDateTime(form.startDate, form.startTime);
    const endAt = combineDateTime(form.startDate, form.endTime);

    if (endAt <= startAt) {
      setError("End time must be after start time.");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        committeeId,
        title: form.title,
        startAt,
        endAt,
        location: form.location || undefined,
        description: form.description,
        signupFormUrl: form.signupFormUrl.trim(),
        posterNotes: form.posterNotes || undefined,
        needsFoodSponsored: form.needsFoodSponsored,
        needsFoodInternal: form.needsFoodInternal,
        needsSupplies: form.needsSupplies,
        hasExternalGuests: form.hasExternalGuests,
        requestRoomBooking: form.requestRoomBooking,
        roomBookingNotes: form.roomBookingNotes || undefined,
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create event.");
      return;
    }

    const { id, roomBookingRequested } = await res.json();
    const params = new URLSearchParams({ posterRequested: "1" });
    if (roomBookingRequested) params.set("roomBookingRequested", "1");
    router.push(`/events/${id}?${params.toString()}`);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <Link
        href={`/committees/${committeeSlug}`}
        className="text-sm text-[#00629B] hover:underline"
      >
        ← Back to {committeeName}
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-slate-900">Add event</h1>
      <p className="mt-1 text-slate-600">
        Fill in the event details below. A poster request is sent to the PR team
        automatically. Optionally request a room booking from Internal Relations.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-lg border border-slate-200 bg-white p-6 text-slate-900"
      >
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Event details
          </legend>

          <label className="block text-sm">
            Event title <span className="text-red-600">*</span>
            <input
              required
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="e.g. Research talk with Prof. Lee"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              Date <span className="text-red-600">*</span>
              <input
                required
                type="date"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              Start time <span className="text-red-600">*</span>
              <select
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.startTime}
                onChange={(e) => {
                  const startTime = e.target.value;
                  setForm({
                    ...form,
                    startTime,
                    endTime: endTimeAfterStart(startTime),
                  });
                }}
              >
                {timeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              End time <span className="text-red-600">*</span>
              <select
                required
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={form.endTime}
                onChange={(e) =>
                  setForm({ ...form, endTime: e.target.value })
                }
              >
                {timeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            Location
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="e.g. HH B103"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>

          <label className="block text-sm">
            Event description / blurb <span className="text-red-600">*</span>
            <textarea
              required
              rows={3}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="What is this event about? Used for weekly announcements and PR."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>

          <label className="block text-sm">
            RSVP link <span className="text-red-600">*</span>
            <input
              required
              type="url"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="https://forms.gle/..."
              value={form.signupFormUrl}
              onChange={(e) =>
                setForm({ ...form, signupFormUrl: e.target.value })
              }
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4 border-t border-slate-100 pt-5">
          <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            PR poster request
          </legend>
          <p className="text-sm text-slate-600">
            PR receives the event details — add any extra poster notes below.
          </p>
          <textarea
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Design preferences, speaker name, tagline, etc."
            aria-label="Additional notes for PR poster request"
            value={form.posterNotes}
            onChange={(e) =>
              setForm({ ...form, posterNotes: e.target.value })
            }
          />
        </fieldset>

        <fieldset className="space-y-4 border-t border-slate-100 pt-5">
          <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Room Booking Request
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.requestRoomBooking}
              onChange={(e) =>
                setForm({ ...form, requestRoomBooking: e.target.checked })
              }
            />
            Request room booking from Internal Relations Chair
          </label>
          {form.requestRoomBooking && (
            <label className="block text-sm">
              Notes for Internal Relations
              <textarea
                rows={2}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                placeholder="Headcount, AV needs, backup room, etc."
                value={form.roomBookingNotes}
                onChange={(e) =>
                  setForm({ ...form, roomBookingNotes: e.target.value })
                }
              />
            </label>
          )}
        </fieldset>

        <fieldset className="space-y-3 border-t border-slate-100 pt-5">
          <legend className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Planning options
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.needsFoodSponsored}
              onChange={(e) =>
                setForm({ ...form, needsFoodSponsored: e.target.checked })
              }
            />
            Food - Sponsored
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.needsFoodInternal}
              onChange={(e) =>
                setForm({ ...form, needsFoodInternal: e.target.checked })
              }
            />
            Food - Internal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.needsSupplies}
              onChange={(e) =>
                setForm({ ...form, needsSupplies: e.target.checked })
              }
            />
            Needs supplies
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasExternalGuests}
              onChange={(e) =>
                setForm({ ...form, hasExternalGuests: e.target.checked })
              }
            />
            External guests (company / faculty)
          </label>
        </fieldset>

        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-[#00629B] px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create event & request poster"}
          </button>
          <Link
            href={`/committees/${committeeSlug}`}
            className="rounded border border-slate-300 px-5 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
