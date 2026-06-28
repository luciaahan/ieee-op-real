"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import type { ExecMember } from "@/lib/exec-types";
import { AttendeeChecklist } from "@/components/AttendeeChecklist";

type ActionItem = {
  id: string;
  description: string;
  dueDate: string | null;
  status: string;
  ownerName: string | null;
  committeeName: string;
  canClose: boolean;
};

type CommitteeOption = { id: string; name: string; slug: string };

type Props = {
  note: {
    id: string;
    meetingDate: string;
    summary: string | null;
    committeeId: string;
  };
  committeeName: string;
  authorName: string;
  actionItems: ActionItem[];
  attendees: ExecMember[];
  execRoster: ExecMember[];
  attendeeIds: string[];
  committees: CommitteeOption[];
  isExecMeeting: boolean;
  canEdit: boolean;
};

function RequiredMark() {
  return <span className="text-red-600">*</span>;
}

export function MeetingDetailClient({
  note,
  committeeName,
  authorName,
  actionItems,
  attendees,
  execRoster,
  attendeeIds: initialAttendeeIds,
  committees,
  isExecMeeting,
  canEdit,
}: Props) {
  const router = useRouter();
  const defaultCommitteeId =
    committees.find((c) => c.id === note.committeeId)?.id ??
    committees[0]?.id ??
    "";
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closingActionItemId, setClosingActionItemId] = useState<string | null>(
    null,
  );
  const [showActionItemForm, setShowActionItemForm] = useState(false);
  const [savingActionItem, setSavingActionItem] = useState(false);
  const [actionItemForm, setActionItemForm] = useState({
    committeeId: defaultCommitteeId,
    ownerId: "",
    description: "",
    dueDate: "",
  });
  const [editingAttendance, setEditingAttendance] = useState(false);
  const [attendeeIds, setAttendeeIds] = useState(initialAttendeeIds);
  const [saving, setSaving] = useState(false);

  async function closeActionItem(itemId: string) {
    setClosingActionItemId(itemId);
    const res = await fetch(`/api/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    setClosingActionItemId(null);

    if (!res.ok) {
      const data = await res.json();
      window.alert(data.error ?? "Could not close action item.");
      return;
    }

    router.refresh();
  }

  async function deleteNote() {
    if (
      !window.confirm(
        "Delete this meeting note? Linked action items will also be removed.",
      )
    ) {
      return;
    }

    setDeleting(true);
    const res = await fetch(`/api/meetings/${note.id}`, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json();
      window.alert(data.error ?? "Could not delete meeting note.");
      return;
    }

    router.push("/meetings");
    router.refresh();
  }

  async function saveAttendance() {
    setSaving(true);
    await fetch(`/api/meetings/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendeeIds }),
    });
    setSaving(false);
    setEditingAttendance(false);
    router.refresh();
  }

  function rosterForCommittee(committeeId: string) {
    const committee = committees.find((c) => c.id === committeeId);
    if (!committee) return [];
    return execRoster.filter((member) =>
      member.committees.includes(committee.slug),
    );
  }

  function resetActionItemForm() {
    setActionItemForm({
      committeeId: defaultCommitteeId,
      ownerId: "",
      description: "",
      dueDate: "",
    });
  }

  async function addActionItem(e: React.FormEvent) {
    e.preventDefault();
    const description = actionItemForm.description.trim();
    if (!description || !actionItemForm.committeeId) return;

    setSavingActionItem(true);
    const res = await fetch(`/api/meetings/${note.id}/action-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        committeeId: actionItemForm.committeeId,
        ownerId: actionItemForm.ownerId || null,
        description,
        dueDate: actionItemForm.dueDate || null,
      }),
    });
    setSavingActionItem(false);

    if (!res.ok) {
      const data = await res.json();
      window.alert(data.error ?? "Could not add action item.");
      return;
    }

    resetActionItemForm();
    setShowActionItemForm(false);
    router.refresh();
  }

  const actionItemRoster = rosterForCommittee(actionItemForm.committeeId);
  const canAddActionItems = canEdit && committees.length > 0;

  const presentAttendees = editingAttendance
    ? execRoster.filter((m) => attendeeIds.includes(m.id))
    : attendees;

  return (
    <>
      <Link href="/meetings" className="text-sm text-[#00629B] hover:underline">
        ← Back to meetings
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {committeeName} · {format(new Date(note.meetingDate), "MMM d, yyyy")}
          </p>
          <h1 className="text-2xl font-bold">Meeting note</h1>
          <p className="mt-1 text-sm text-slate-500">Author: {authorName}</p>
        </div>
        {canEdit &&
          (editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteNote()}
                className="rounded border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete note"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded border border-[#00629B] px-4 py-2 text-sm text-[#00629B] hover:bg-blue-50"
            >
              Edit
            </button>
          ))}
      </div>

      <article className="mt-6 rounded border bg-white p-4">
        <h2 className="font-semibold">Summary</h2>
        <p className="mt-2 whitespace-pre-wrap text-slate-800">
          {note.summary || "(No summary)"}
        </p>
      </article>

      {isExecMeeting && (
        <section className="mt-6 rounded border bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Exec attendance</h2>
            {canEdit && !editingAttendance && (
              <button
                type="button"
                onClick={() => setEditingAttendance(true)}
                className="text-sm text-[#00629B] hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {editingAttendance ? (
            <div className="mt-3 space-y-3">
              <AttendeeChecklist
                roster={execRoster}
                selectedIds={attendeeIds}
                onChange={setAttendeeIds}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveAttendance}
                  className="rounded bg-[#00629B] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttendeeIds(initialAttendeeIds);
                    setEditingAttendance(false);
                  }}
                  className="rounded border px-3 py-1.5 text-sm text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : presentAttendees.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No attendance logged.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {presentAttendees.map((member) => (
                <li key={member.id}>
                  <span className="text-green-700">✓</span> {member.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Action items</h2>
          {canAddActionItems && !showActionItemForm && (
            <button
              type="button"
              onClick={() => setShowActionItemForm(true)}
              className="text-sm text-[#00629B] hover:underline"
            >
              Add action item
            </button>
          )}
        </div>

        {showActionItemForm && (
          <form
            onSubmit={(e) => void addActionItem(e)}
            className="mt-3 space-y-3 rounded border bg-white p-4"
          >
            <label className="block text-sm text-slate-700">
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

            <label className="block text-sm text-slate-700">
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

            <label className="block text-sm text-slate-700">
              Action item <RequiredMark />
              <textarea
                required
                rows={3}
                placeholder="What needs to be done?"
                className="mt-1 w-full rounded border px-3 py-2"
                value={actionItemForm.description}
                onChange={(e) =>
                  setActionItemForm({
                    ...actionItemForm,
                    description: e.target.value,
                  })
                }
              />
            </label>

            <label className="block text-sm text-slate-700">
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

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingActionItem}
                className="rounded bg-[#00629B] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {savingActionItem ? "Saving…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetActionItemForm();
                  setShowActionItemForm(false);
                }}
                className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {actionItems.length === 0 ? (
          !showActionItemForm && (
            <p className="mt-2 text-sm text-slate-500">None</p>
          )
        ) : (
          <ul className="mt-2 space-y-2">
            {actionItems.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded border bg-white p-3 text-sm"
              >
                <span>
                  {item.description}
                  <span className="text-slate-500"> — {item.committeeName}</span>
                  {item.ownerName && (
                    <span className="text-slate-500"> · {item.ownerName}</span>
                  )}
                  {item.dueDate && (
                    <span className="text-slate-400"> · due {item.dueDate}</span>
                  )}
                  <span
                    className={
                      item.status === "done"
                        ? " ml-2 text-green-600"
                        : " ml-2 text-amber-600"
                    }
                  >
                    {item.status}
                  </span>
                </span>
                {item.canClose && item.status === "open" && (
                  <button
                    type="button"
                    disabled={closingActionItemId === item.id}
                    onClick={() => void closeActionItem(item.id)}
                    className="shrink-0 text-[#00629B] hover:underline disabled:opacity-50"
                  >
                    {closingActionItemId === item.id ? "Closing…" : "Close"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
