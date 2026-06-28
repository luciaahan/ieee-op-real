"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { checklistProgress, isOverdue, milestoneLabel, itemApplies, parseCoHostIds } from "@/lib/checklist";
import { formatExpenseAmount, type ExpenseRecord } from "@/lib/expense-types";
import type { Event, EventChecklistItem } from "@/lib/db/schema";
import type { ChecklistCondition } from "@/lib/seed-data";
import type { ExecMember } from "@/lib/exec-types";
import { memberCommitteeLabel } from "@/lib/exec-types";

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 17.5 6.75v8.5A2.75 2.75 0 0 1 14.75 18H5.25A2.75 2.75 0 0 1 2.5 15.25v-8.5A2.75 2.75 0 0 1 5.25 4.5H5.5V2.75A.75.75 0 0 1 6.25 2h-.5zm-1 5.5v7.75c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25V7.5h-12z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm.75-13a.75.75 0 0 0-1.5 0v5c0 .199.079.39.22.53l2.5 2.5a.75.75 0 1 0 1.06-1.06l-2.28-2.28V5z" clipRule="evenodd" />
    </svg>
  );
}

function IconLocation({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9.5A7 7 0 1 0 3 9.5c0 3.003 1.698 5.488 4.345 6.98.83.798 1.654 1.38 2.274 1.765.311.192.571.337.757.433a5.741 5.741 0 0 0 .28.14l.019.008.006.003ZM10 11.25a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z" clipRule="evenodd" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
      <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
    </svg>
  );
}

function IconNote({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
    </svg>
  );
}

function EventDetailItem({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span>{children}</span>
    </span>
  );
}

function ExecMemberTags({
  coHostIds,
  execRoster,
  currentUserId,
  canEdit,
  saving,
  onChange,
}: {
  coHostIds: string[];
  execRoster: ExecMember[];
  currentUserId: string;
  canEdit: boolean;
  saving: boolean;
  onChange: (ids: string[]) => void;
}) {
  const available = execRoster.filter((m) => m.id !== currentUserId);
  const slots: [string, string] = [coHostIds[0] ?? "", coHostIds[1] ?? ""];

  function updateSlot(index: 0 | 1, userId: string) {
    const next: [string, string] = [...slots] as [string, string];
    next[index] = userId;
    const ids = next.filter(Boolean);
    onChange([...new Set(ids)].slice(0, 2));
  }

  function memberLabel(id: string) {
    const member = execRoster.find((m) => m.id === id);
    if (!member) return "Unknown";
    const committees = memberCommitteeLabel(member);
    return committees ? `${member.name} (${committees})` : member.name;
  }

  if (!canEdit) {
    if (coHostIds.length === 0) {
      return (
        <p className="mt-3 text-sm text-slate-500">No exec members tagged yet.</p>
      );
    }
    return (
      <ul className="mt-3 space-y-1 text-sm text-slate-700">
        {coHostIds.map((id) => (
          <li key={id}>{memberLabel(id)}</li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {([0, 1] as const).map((index) => (
        <select
          key={index}
          disabled={saving}
          value={slots[index]}
          onChange={(e) => updateSlot(index, e.target.value)}
          className="min-w-[220px] rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">Select exec member…</option>
          {available
            .filter((m) => m.id === slots[index] || !coHostIds.includes(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m.id)}
              </option>
            ))}
        </select>
      ))}
    </div>
  );
}

export function EventDetailClient({
  event,
  committeeSlug,
  committeeName,
  checklist,
  poster,
  roomBooking,
  canEdit,
  posterJustRequested,
  roomBookingJustRequested,
  expenses,
  execRoster,
  currentUserId,
}: {
  event: Event;
  committeeSlug: string;
  committeeName: string;
  checklist: EventChecklistItem[];
  poster: { id: string; status: string; assetUrl: string | null } | null;
  roomBooking: { id: string; status: string } | null;
  canEdit: boolean;
  posterJustRequested?: boolean;
  roomBookingJustRequested?: boolean;
  expenses: ExpenseRecord[];
  execRoster: ExecMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [coHostIds, setCoHostIds] = useState(() => parseCoHostIds(event.coHostIds));
  const [coHostsSaving, setCoHostsSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: "", notes: "" });
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  function eventToDetails() {
    const start = new Date(event.startAt);
    return {
      startDate: format(start, "yyyy-MM-dd"),
      startTime: format(start, "HH:mm"),
      location: event.location ?? "",
      signupFormUrl: event.signupFormUrl ?? "",
      needsFoodSponsored: !!event.needsFoodSponsored,
      needsFoodInternal: !!event.needsFoodInternal,
      needsSupplies: !!event.needsSupplies,
      hasExternalGuests: !!event.hasExternalGuests,
    };
  }

  const [detailsView, setDetailsView] = useState(eventToDetails);
  const [detailsDraft, setDetailsDraft] = useState(detailsView);

  useEffect(() => {
    setCoHostIds(parseCoHostIds(event.coHostIds));
  }, [event.coHostIds]);

  useEffect(() => {
    if (!editingDetails) {
      const next = eventToDetails();
      setDetailsView(next);
      setDetailsDraft(next);
    }
  }, [
    event.startAt,
    event.location,
    event.signupFormUrl,
    event.needsFoodSponsored,
    event.needsFoodInternal,
    event.needsSupplies,
    event.hasExternalGuests,
    editingDetails,
  ]);

  async function updateCoHosts(ids: string[]) {
    setCoHostIds(ids);
    setCoHostsSaving(true);
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coHostIds: ids }),
    });
    setCoHostsSaving(false);
    router.refresh();
  }

  async function updateItem(itemId: string, status: string) {
    await fetch(`/api/events/${event.id}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function updateEvent(fields: Partial<Event>) {
    await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    router.refresh();
  }

  async function logExpense(e: React.FormEvent) {
    e.preventDefault();
    setExpenseError(null);
    setExpenseSubmitting(true);

    const res = await fetch(`/api/events/${event.id}/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(expenseForm.amount),
        notes: expenseForm.notes || undefined,
      }),
    });

    setExpenseSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setExpenseError(data.error ?? "Could not log expense.");
      return;
    }

    setExpenseForm({ amount: "", notes: "" });
    router.refresh();
  }

  function startEditingDetails() {
    setDetailsDraft(detailsView);
    setDetailsError(null);
    setEditingDetails(true);
  }

  async function saveDetails() {
    setDetailsSaving(true);
    setDetailsError(null);

    if (!detailsDraft.signupFormUrl.trim()) {
      setDetailsError("RSVP link is required.");
      setDetailsSaving(false);
      return;
    }

    const startAt = new Date(
      `${detailsDraft.startDate}T${detailsDraft.startTime}`,
    ).toISOString();

    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt,
        location: detailsDraft.location.trim() || null,
        signupFormUrl: detailsDraft.signupFormUrl.trim(),
        needsFoodSponsored: detailsDraft.needsFoodSponsored,
        needsFoodInternal: detailsDraft.needsFoodInternal,
        needsSupplies: detailsDraft.needsSupplies,
        hasExternalGuests: detailsDraft.hasExternalGuests,
      }),
    });

    setDetailsSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDetailsError(data.error ?? "Could not save event details.");
      return;
    }

    setDetailsView(detailsDraft);
    setEditingDetails(false);
    router.refresh();
  }

  function cancelDetailsEdit() {
    setDetailsDraft(detailsView);
    setDetailsError(null);
    setEditingDetails(false);
  }

  const planningOptions = [
    { key: "needsFoodSponsored" as const, label: "Food - Sponsored" },
    { key: "needsFoodInternal" as const, label: "Food - Internal" },
    { key: "needsSupplies" as const, label: "Needs supplies" },
    { key: "hasExternalGuests" as const, label: "External guests" },
  ];

  const activePlanningOptions = planningOptions.filter(
    (option) => detailsView[option.key],
  );

  const planningEvent = {
    ...event,
    needsFoodSponsored: detailsView.needsFoodSponsored,
    needsFoodInternal: detailsView.needsFoodInternal,
    needsSupplies: detailsView.needsSupplies,
    hasExternalGuests: detailsView.hasExternalGuests,
    needsFood:
      detailsView.needsFoodSponsored || detailsView.needsFoodInternal,
  };

  const progress = checklistProgress(checklist, planningEvent);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  const grouped = [14, 7, 3, 0].map((offset) => ({
    offset,
    label: milestoneLabel(offset),
    items: checklist
      .filter(
        (i) =>
          i.offsetDays === offset &&
          itemApplies(i.condition as ChecklistCondition, planningEvent),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  return (
    <div>
      <Link
        href={`/committees/${committeeSlug}`}
        className="text-sm text-[#00629B] hover:underline"
      >
        ← {committeeName}
      </Link>

      {posterJustRequested && poster && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Poster request sent to PR — due{" "}
          {format(
            new Date(new Date(event.startAt).getTime() - 14 * 86400000),
            "MMM d, yyyy",
          )}
          .
        </div>
      )}

      {roomBookingJustRequested && roomBooking && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Room booking request sent to Internal Relations — due{" "}
          {format(
            new Date(new Date(event.startAt).getTime() - 14 * 86400000),
            "MMM d, yyyy",
          )}
          .
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <StatusBadge status={event.status} />
      </div>

      <section className="mt-6 rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-semibold text-slate-900">Event details</h2>
          {canEdit && !editingDetails && (
            <button
              type="button"
              onClick={startEditingDetails}
              className="text-sm text-[#00629B] hover:underline"
            >
              Edit
            </button>
          )}
          {canEdit && editingDetails && (
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveDetails}
                  disabled={detailsSaving}
                  className="rounded bg-[#00629B] px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {detailsSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelDetailsEdit}
                  disabled={detailsSaving}
                  className="rounded border px-3 py-1 text-sm text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {detailsError && (
                <p className="text-xs text-red-600">{detailsError}</p>
              )}
            </div>
          )}
        </div>

        {editingDetails ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Date</span>
              <input
                required
                type="date"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={detailsDraft.startDate}
                onChange={(e) =>
                  setDetailsDraft({ ...detailsDraft, startDate: e.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Time</span>
              <input
                required
                type="time"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={detailsDraft.startTime}
                onChange={(e) =>
                  setDetailsDraft({ ...detailsDraft, startTime: e.target.value })
                }
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Location</span>
              <input
                type="text"
                placeholder="Room or venue"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={detailsDraft.location}
                onChange={(e) =>
                  setDetailsDraft({ ...detailsDraft, location: e.target.value })
                }
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">
                RSVP link <span className="text-red-600">*</span>
              </span>
              <input
                required
                type="url"
                placeholder="https://forms.gle/..."
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={detailsDraft.signupFormUrl}
                onChange={(e) =>
                  setDetailsDraft({
                    ...detailsDraft,
                    signupFormUrl: e.target.value,
                  })
                }
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-slate-700">
                Planning options
              </legend>
              <div className="mt-2 flex flex-wrap gap-4">
                {planningOptions.map((option) => (
                  <label key={option.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={detailsDraft[option.key]}
                      onChange={(e) =>
                        setDetailsDraft({
                          ...detailsDraft,
                          [option.key]: e.target.checked,
                        })
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : (
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700">
            <EventDetailItem icon={<IconCalendar className="h-4 w-4" />}>
              {format(new Date(event.startAt), "MMM d, yyyy")}
            </EventDetailItem>
            <EventDetailItem icon={<IconClock className="h-4 w-4" />}>
              {format(new Date(event.startAt), "h:mm a")}
            </EventDetailItem>
            <EventDetailItem icon={<IconLocation className="h-4 w-4" />}>
              {detailsView.location || "Not set"}
            </EventDetailItem>
            <EventDetailItem icon={<IconLink className="h-4 w-4" />}>
              {detailsView.signupFormUrl ? (
                <a
                  href={detailsView.signupFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00629B] hover:underline"
                >
                  RSVP form
                </a>
              ) : (
                "Not set"
              )}
            </EventDetailItem>
            <EventDetailItem icon={<IconNote className="h-4 w-4" />}>
              {activePlanningOptions.length > 0
                ? activePlanningOptions.map((o) => o.label).join(", ")
                : "None selected"}
            </EventDetailItem>
          </p>
        )}
      </section>

      {event.usePlanningChecklist && (
        <>
          <div className="mt-6">
            <div className="mb-1 flex justify-between text-sm">
              <span>Planning progress</span>
              <span>
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-[#00629B]"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <section className="mt-6 rounded border border-slate-200 bg-white p-4">
            {poster && (
              <div className="pb-4">
                <h3 className="text-sm font-semibold text-slate-900">PR poster</h3>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <StatusBadge
                    status={poster.status.replace("_", " ")}
                    label={poster.status.replace("_", " ")}
                  />
                  {poster.assetUrl && (
                    <a
                      href={`/api/deliverables/${poster.id}/asset`}
                      className="text-sm font-medium text-[#00629B] hover:underline"
                      download
                    >
                      Download poster
                    </a>
                  )}
                </div>
                {poster.assetUrl &&
                  /\.(jpe?g|png|gif|webp)$/i.test(poster.assetUrl) && (
                    <img
                      src={`/api/deliverables/${poster.id}/asset?disposition=inline`}
                      alt="Event poster"
                      className="mt-3 max-h-64 rounded border border-slate-200 object-contain"
                    />
                  )}
              </div>
            )}

            <div className={poster ? "border-t border-slate-100 pt-4" : ""}>
              <h3 className="text-sm font-semibold text-slate-900">Exec presence</h3>
              <p className="mt-1 text-sm text-slate-600">
                Tag 2 other exec board members who can be present at this event.
              </p>
              <ExecMemberTags
                coHostIds={coHostIds}
                execRoster={execRoster}
                currentUserId={currentUserId}
                canEdit={canEdit}
                saving={coHostsSaving}
                onChange={updateCoHosts}
              />
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold text-slate-900">RSVP count</h3>
              {canEdit ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  Attendees
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-24 rounded border border-slate-300 px-2 py-2"
                    defaultValue={event.rsvpCount ?? ""}
                    onBlur={(e) =>
                      updateEvent({
                        rsvpCount: parseInt(e.target.value, 10) || 0,
                      })
                    }
                  />
                </label>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  {event.rsvpCount != null && event.rsvpCount > 0
                    ? `${event.rsvpCount} RSVPs`
                    : "No RSVP count yet"}
                </p>
              )}
            </div>

            <div id="expenses" className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Expenses</h3>
                {expenses.length > 0 && (
                  <p className="text-sm font-medium text-slate-700">
                    Event total: {formatExpenseAmount(expenseTotal)}
                  </p>
                )}
              </div>

              {canEdit && (
                <form onSubmit={logExpense} className="mt-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[9rem_1fr]">
                    <div>
                      <label
                        htmlFor="expense-amount"
                        className="mb-1 block text-sm text-slate-700"
                      >
                        Amount ($)
                      </label>
                      <input
                        id="expense-amount"
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="0.00"
                        value={expenseForm.amount}
                        onChange={(e) =>
                          setExpenseForm({ ...expenseForm, amount: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="expense-notes"
                        className="mb-1 block text-sm text-slate-700"
                      >
                        Notes
                      </label>
                      <input
                        id="expense-notes"
                        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        placeholder="e.g. food, supplies"
                        value={expenseForm.notes}
                        onChange={(e) =>
                          setExpenseForm({ ...expenseForm, notes: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  {expenseError && (
                    <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                      {expenseError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={expenseSubmitting}
                    className="rounded bg-[#00629B] px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {expenseSubmitting ? "Saving…" : "Log expense"}
                  </button>
                </form>
              )}

              {expenses.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No expenses logged yet.</p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm">
                  {expenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 py-2 last:border-0"
                    >
                      <span>
                        {formatExpenseAmount(expense.amount)}
                        {expense.notes && (
                          <span className="text-slate-500"> — {expense.notes}</span>
                        )}
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {expense.loggedByName}
                          {expense.createdAt &&
                            ` · ${format(new Date(expense.createdAt), "MMM d, yyyy")}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <div className="mt-6 space-y-4">
            {grouped.map((group) => (
              <details
                key={group.offset}
                open={group.offset >= 7}
                className="rounded border bg-white"
              >
                <summary className="cursor-pointer px-4 py-3 font-medium">
                  {group.label}
                  {group.items.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({group.items.filter((i) => i.status === "done").length}/
                      {group.items.length})
                    </span>
                  )}
                </summary>
                <ul className="border-t px-4 py-2">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center justify-between gap-2 border-b py-2 last:border-0 ${isOverdue(item.dueDate, item.status) ? "text-red-700" : ""}`}
                    >
                      <span className="text-sm">
                        {item.status === "done" ? "✓ " : ""}
                        {item.title}
                        {item.title === "Log Expenses" && item.status !== "done" && (
                          <a
                            href="#expenses"
                            className="ml-2 text-xs text-[#00629B] hover:underline"
                          >
                            Log →
                          </a>
                        )}
                        {item.isRecommended && (
                          <span className="ml-1 text-xs text-slate-400">
                            (recommended)
                          </span>
                        )}
                        {isOverdue(item.dueDate, item.status) && (
                          <span className="ml-2 text-xs font-medium">OVERDUE</span>
                        )}
                      </span>
                      {canEdit && item.status !== "done" && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => updateItem(item.id, "done")}
                            className="rounded border px-2 py-0.5 text-xs hover:bg-emerald-50"
                          >
                            Done
                          </button>
                          {item.isOptional && (
                            <button
                              onClick={() => updateItem(item.id, "not_applicable")}
                              className="rounded border px-2 py-0.5 text-xs hover:bg-slate-50"
                            >
                              N/A
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </>
      )}

      {!event.usePlanningChecklist && (
        <p className="mt-6 text-slate-500">
          Planning checklist not used for recurring operational meetings.
        </p>
      )}
    </div>
  );
}
