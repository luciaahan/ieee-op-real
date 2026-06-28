"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import type { ExecMember } from "@/lib/exec-types";
import { AttendeeChecklist } from "@/components/AttendeeChecklist";
import { EXEC_COMMITTEE_ID } from "@/lib/exec-attendance";

type Note = {
  id: string;
  meetingDate: string;
  summary: string | null;
  committeeId: string;
};

type Committee = { id: string; name: string; slug: string };

type MeetingAgenda = {
  meetingDate: string;
  recapRange: { start: string; end: string };
  nextWeekRange: { start: string; end: string };
  recapEvents: {
    id: string;
    title: string;
    startAt: string;
    committeeName: string;
  }[];
  checklistGroups: {
    event: {
      id: string;
      title: string;
      startAt: string;
      committeeName: string;
    };
    items: { title: string; dueDate: string }[];
  }[];
  text: string;
};

type DraftActionItem = {
  id: string;
  committeeId: string;
  ownerId: string | null;
  description: string;
  dueDate: string | null;
};

function RequiredMark() {
  return <span className="text-red-600">*</span>;
}

function defaultMeetingDate(): string {
  const today = new Date();
  const day = today.getDay();
  if (day === 6) return format(today, "yyyy-MM-dd");
  if (day === 0) return format(today, "yyyy-MM-dd");
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  return format(saturday, "yyyy-MM-dd");
}

export function MeetingsClient({
  notes,
  committees,
  execRoster,
  canCreate,
  canEditAll,
  committeeEditScopes,
  defaultCommitteeId,
}: {
  notes: Note[];
  committees: Committee[];
  execRoster: ExecMember[];
  canCreate: boolean;
  canEditAll: boolean;
  committeeEditScopes: string[];
  defaultCommitteeId: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showAgenda, setShowAgenda] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [agendaDate, setAgendaDate] = useState(defaultMeetingDate);
  const [agenda, setAgenda] = useState<MeetingAgenda | null>(null);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [agendaCopied, setAgendaCopied] = useState(false);
  const [draftActionItems, setDraftActionItems] = useState<DraftActionItem[]>([]);
  const [showActionItemModal, setShowActionItemModal] = useState(false);
  const [actionItemForm, setActionItemForm] = useState({
    committeeId: defaultCommitteeId,
    ownerId: "",
    description: "",
    dueDate: "",
  });
  const [form, setForm] = useState({
    committeeId: defaultCommitteeId,
    meetingDate: defaultMeetingDate(),
    summary: "",
    attendeeIds: [] as string[],
  });

  const isExecMeeting = form.committeeId === EXEC_COMMITTEE_ID;

  async function generateAgenda(e?: React.FormEvent) {
    e?.preventDefault();
    setAgendaLoading(true);
    const res = await fetch(
      `/api/meetings/agenda?meetingDate=${encodeURIComponent(agendaDate)}`,
    );
    const data = await res.json();
    setAgenda(res.ok ? data : null);
    setAgendaLoading(false);
  }

  function useAgendaAsNote() {
    if (!agenda) return;
    setForm((f) => ({
      ...f,
      meetingDate: agendaDate,
      summary: agenda.text,
    }));
    setShowAgenda(false);
    setShowForm(true);
  }

  async function copyAgenda() {
    if (!agenda) return;
    await navigator.clipboard.writeText(agenda.text);
    setAgendaCopied(true);
    window.setTimeout(() => setAgendaCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        attendeeIds: isExecMeeting ? form.attendeeIds : [],
        actionItems: draftActionItems.map((item) => ({
          committeeId: item.committeeId,
          ownerId: item.ownerId,
          description: item.description,
          dueDate: item.dueDate,
        })),
      }),
    });
    setShowForm(false);
    setDraftActionItems([]);
    router.refresh();
  }

  function openActionItemModal() {
    setActionItemForm({
      committeeId: form.committeeId,
      ownerId: "",
      description: "",
      dueDate: "",
    });
    setShowActionItemModal(true);
  }

  function addDraftActionItem(e: React.FormEvent) {
    e.preventDefault();
    const description = actionItemForm.description.trim();
    if (!description || !actionItemForm.committeeId) return;

    setDraftActionItems((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        committeeId: actionItemForm.committeeId,
        ownerId: actionItemForm.ownerId || null,
        description,
        dueDate: actionItemForm.dueDate || null,
      },
    ]);
    setShowActionItemModal(false);
  }

  function removeDraftActionItem(id: string) {
    setDraftActionItems((items) => items.filter((item) => item.id !== id));
  }

  function committeeName(committeeId: string) {
    return committees.find((c) => c.id === committeeId)?.name ?? "Unknown";
  }

  function ownerName(ownerId: string | null) {
    if (!ownerId) return null;
    return execRoster.find((m) => m.id === ownerId)?.name ?? null;
  }

  function rosterForCommittee(committeeId: string) {
    const committee = committees.find((c) => c.id === committeeId);
    if (!committee) return [];
    return execRoster.filter((member) =>
      member.committees.includes(committee.slug),
    );
  }

  const actionItemRoster = rosterForCommittee(actionItemForm.committeeId);

  function canEditNote(committeeSlug: string | undefined) {
    if (!committeeSlug) return false;
    return canEditAll || committeeEditScopes.includes(committeeSlug);
  }

  async function deleteNote(noteId: string) {
    if (
      !window.confirm(
        "Delete this meeting note? Linked action items will also be removed.",
      )
    ) {
      return;
    }

    setDeletingNoteId(noteId);
    const res = await fetch(`/api/meetings/${noteId}`, { method: "DELETE" });
    setDeletingNoteId(null);

    if (!res.ok) {
      const data = await res.json();
      window.alert(data.error ?? "Could not delete meeting note.");
      return;
    }

    setEditingNoteId(null);
    router.refresh();
  }

  const sorted = [...notes].sort(
    (a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime(),
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meeting Notes</h1>
          <p className="text-slate-600">Weekly exec and committee logs</p>
        </div>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAgenda(!showAgenda);
                if (!showAgenda && !agenda) {
                  void generateAgenda();
                }
              }}
              className="rounded border border-[#00629B] px-4 py-2 text-sm font-medium text-[#00629B] hover:bg-[#00629B]/5"
            >
              Create Agenda
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded bg-[#00629B] px-4 py-2 text-sm text-white"
            >
              + Add note
            </button>
          </div>
        )}
      </div>

      {showAgenda && (
        <section className="mb-6 rounded border bg-white p-4">
          <h2 className="font-semibold">Meeting agenda</h2>
          <p className="mt-1 text-sm text-slate-600">
            Recap covers Mon–Fri before the meeting; planning lists checklist items due the following week.
          </p>
          <form
            onSubmit={generateAgenda}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <label className="text-sm text-slate-700">
              Meeting date <RequiredMark />
              <input
                type="date"
                required
                className="ml-2 rounded border px-3 py-2"
                value={agendaDate}
                onChange={(e) => setAgendaDate(e.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={agendaLoading}
              className="rounded bg-[#00629B] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {agendaLoading ? "Generating…" : "Generate"}
            </button>
            {agenda && (
              <>
                <button
                  type="button"
                  onClick={() => void copyAgenda()}
                  className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {agendaCopied ? "Copied!" : "Copy to clipboard"}
                </button>
                <button
                  type="button"
                  onClick={useAgendaAsNote}
                  className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Use as new note
                </button>
              </>
            )}
          </form>
          {agenda && (
            <button
              type="button"
              onClick={() => void copyAgenda()}
              className="mt-4 w-full rounded border bg-slate-50 p-4 text-left text-sm text-slate-800 transition hover:border-[#00629B]/40 hover:bg-slate-100"
            >
              <p className="mb-2 text-xs text-slate-500">
                {agendaCopied ? "Copied to clipboard!" : "Click to copy"}
              </p>
              <pre className="whitespace-pre-wrap font-sans">{agenda.text}</pre>
            </button>
          )}
        </section>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded border bg-white p-4">
          <label className="block text-sm text-slate-700">
            Committee <RequiredMark />
            <select
              required
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.committeeId}
              onChange={(e) => setForm({ ...form, committeeId: e.target.value })}
            >
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Meeting date <RequiredMark />
            <input
              type="date"
              required
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.meetingDate}
              onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            Summary
            <textarea
              rows={4}
              placeholder="Meeting summary"
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          {isExecMeeting && execRoster.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Exec attendance</p>
              <AttendeeChecklist
                roster={execRoster}
                selectedIds={form.attendeeIds}
                onChange={(attendeeIds) => setForm({ ...form, attendeeIds })}
              />
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Action items</p>
              <button
                type="button"
                onClick={openActionItemModal}
                className="text-sm text-[#00629B] hover:underline"
              >
                Create Action Item
              </button>
            </div>
            {draftActionItems.length === 0 ? (
              <p className="text-sm text-slate-500">None added yet.</p>
            ) : (
              <ul className="space-y-2">
                {draftActionItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-2 rounded border bg-slate-50 p-3 text-sm"
                  >
                    <span>
                      {item.description}
                      <span className="text-slate-500">
                        {" "}
                        — {committeeName(item.committeeId)}
                      </span>
                      {ownerName(item.ownerId) && (
                        <span className="text-slate-500">
                          {" "}
                          · {ownerName(item.ownerId)}
                        </span>
                      )}
                      {item.dueDate && (
                        <span className="text-slate-400"> · due {item.dueDate}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDraftActionItem(item.id)}
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      aria-label="Remove action item"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" className="rounded bg-[#00629B] px-4 py-2 text-white">
            Save
          </button>
        </form>
      )}

      {showActionItemModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowActionItemModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={addDraftActionItem} className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Create Action Item
              </h2>

              <label className="block text-sm">
                Committee <RequiredMark />
                <select
                  required
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={actionItemForm.committeeId}
                  onChange={(e) => {
                    const committeeId = e.target.value;
                    const eligible = rosterForCommittee(committeeId);
                    setActionItemForm((f) => ({
                      ...f,
                      committeeId,
                      ownerId: eligible.some((m) => m.id === f.ownerId)
                        ? f.ownerId
                        : "",
                    }));
                  }}
                >
                  {committees.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                Person
                <select
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={actionItemForm.ownerId}
                  onChange={(e) =>
                    setActionItemForm({ ...actionItemForm, ownerId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {actionItemRoster.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                Action item <RequiredMark />
                <textarea
                  required
                  rows={3}
                  placeholder="What needs to be done?"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={actionItemForm.description}
                  onChange={(e) =>
                    setActionItemForm({ ...actionItemForm, description: e.target.value })
                  }
                />
              </label>

              <label className="block text-sm">
                Due date
                <input
                  type="date"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={actionItemForm.dueDate}
                  onChange={(e) =>
                    setActionItemForm({ ...actionItemForm, dueDate: e.target.value })
                  }
                />
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="rounded bg-[#00629B] px-4 py-2 text-sm text-white"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowActionItemModal(false)}
                  className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((note) => {
          const committee = committees.find((c) => c.id === note.committeeId);
          return (
            <article key={note.id} className="rounded border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm text-slate-500">
                  {committee?.name} · {format(new Date(note.meetingDate), "MMM d, yyyy")}
                </p>
                <div className="flex gap-3 text-sm">
                  <Link href={`/meetings/${note.id}`} className="text-[#00629B] hover:underline">
                    View
                  </Link>
                  {canEditNote(committee?.slug) &&
                    (editingNoteId === note.id ? (
                      <>
                        <button
                          type="button"
                          disabled={deletingNoteId === note.id}
                          onClick={() => void deleteNote(note.id)}
                          className="text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingNoteId === note.id ? "Deleting…" : "Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="text-slate-600 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(note.id)}
                        className="text-[#00629B] hover:underline"
                      >
                        Edit
                      </button>
                    ))}
                </div>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-slate-800">
                {note.summary}
              </p>
            </article>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-slate-500">No meeting notes yet.</p>
        )}
      </div>
    </>
  );
}
