"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { DeliverableStatusSelect, deliverableStatusBadgeClass } from "@/components/DeliverableStatusSelect";
import { FileUploadZone } from "@/components/FileUploadZone";
import { ExecAttendanceTracker } from "@/components/ExecAttendanceTracker";
import { ExpenseTracker } from "@/components/ExpenseTracker";
import { WeeklyAnnouncements } from "@/components/WeeklyAnnouncements";
import { MentorMatching } from "@/components/MentorMatching";
import type { ExecAttendanceMatrix } from "@/lib/exec-attendance";
import type { ExpenseRecord } from "@/lib/expense-types";
import type { PosterBacklogItem } from "@/lib/poster-backlog";
import type { AnnouncementEvent } from "@/lib/weekly-announcements";
import { SEMESTER_EVENT_GOAL_TITLE } from "@/lib/goals";

type Goal = {
  id: string;
  title: string;
  targetMetric: string | null;
  deadline: string | null;
  status: string;
  notes: string | null;
};

type CommitteeData = {
  committee: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    trackingType: string;
  };
  events: {
    id: string;
    title: string;
    startAt: string;
    endAt: string | null;
    status: string;
  }[];
  meetingNotes: { id: string; meetingDate: string; summary: string | null }[];
  actionItems: {
    id: string;
    description: string;
    dueDate: string | null;
    ownerName: string | null;
  }[];
  goals: Goal[];
  semester: {
    label: string;
    eventTarget: number | null;
    completedEvents: number;
  };
  deliverables: {
    id: string;
    type: string;
    status: string;
    linkedEventId: string | null;
    dueDate: string | null;
    captionSummary: string | null;
  }[];
  posterBacklog: PosterBacklogItem[];
  canEdit: boolean;
  canManageMentorMatching?: boolean;
  execAttendance?: ExecAttendanceMatrix | null;
  expenses?: ExpenseRecord[];
  expenseTotal?: number;
  announcementEvents?: AnnouncementEvent[];
};

export function CommitteePageClient({ data }: { data: CommitteeData }) {
  const router = useRouter();
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({
    title: "",
    targetMetric: "",
    deadline: "",
  });
  const [semesterTargetInput, setSemesterTargetInput] = useState(
    String(data.semester.eventTarget ?? ""),
  );
  const [semesterGoalSaving, setSemesterGoalSaving] = useState(false);
  const [editingSemesterGoal, setEditingSemesterGoal] = useState(false);
  const [editingEvents, setEditingEvents] = useState(false);
  const [eventsSaving, setEventsSaving] = useState(false);
  const [eventDrafts, setEventDrafts] = useState<
    Record<string, { title: string; startDate: string }>
  >({});
  const [roomBookingModal, setRoomBookingModal] = useState<{
    deliverableId: string;
  } | null>(null);
  const [bookedRoom, setBookedRoom] = useState("");
  const [roomBookingError, setRoomBookingError] = useState<string | null>(null);
  const [roomBookingSaving, setRoomBookingSaving] = useState(false);
  const [posterUploadModal, setPosterUploadModal] = useState<{
    deliverableId: string;
  } | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterUploadError, setPosterUploadError] = useState<string | null>(null);
  const [posterUploadSaving, setPosterUploadSaving] = useState(false);
  const [prezTab, setPrezTab] = useState<"main" | "attendance" | "expenses">("main");
  const [execTab, setExecTab] = useState<"main" | "mentor-matching">("main");

  const isPrez = data.committee.slug === "prez";
  const isExec = data.committee.slug === "exec";
  const showCommitteeMain =
    (!isPrez && !isExec) ||
    (isPrez && prezTab === "main") ||
    (isExec && execTab === "main");

  async function saveSemesterEventGoal(e: React.FormEvent) {
    e.preventDefault();
    const target = parseInt(semesterTargetInput, 10);
    if (!Number.isFinite(target) || target <= 0) return;

    setSemesterGoalSaving(true);
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        committeeId: data.committee.id,
        title: SEMESTER_EVENT_GOAL_TITLE,
        targetMetric: String(target),
      }),
    });
    setSemesterGoalSaving(false);
    setEditingSemesterGoal(false);
    router.refresh();
  }

  function cancelSemesterGoalEdit() {
    setSemesterTargetInput(String(data.semester.eventTarget ?? ""));
    setEditingSemesterGoal(false);
  }

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        committeeId: data.committee.id,
        title: goalForm.title,
        targetMetric: goalForm.targetMetric || null,
        deadline: goalForm.deadline || null,
        status: "in_progress",
      }),
    });
    setShowGoalForm(false);
    setGoalForm({ title: "", targetMetric: "", deadline: "" });
    router.refresh();
  }

  async function updateGoalStatus(id: string, status: string) {
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function updateDeliverable(id: string, status: string) {
    await fetch(`/api/deliverables/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  function handleRoomBookingStatusChange(
    deliverableId: string,
    newStatus: string,
  ) {
    if (newStatus === "done") {
      setRoomBookingError(null);
      setBookedRoom("");
      setRoomBookingModal({ deliverableId });
      return;
    }
    updateDeliverable(deliverableId, newStatus);
  }

  async function confirmRoomBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!roomBookingModal) return;

    const room = bookedRoom.trim();
    if (!room) {
      setRoomBookingError("Enter the booked room name.");
      return;
    }

    setRoomBookingSaving(true);
    setRoomBookingError(null);

    const res = await fetch(
      `/api/deliverables/${roomBookingModal.deliverableId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done", bookedRoom: room }),
      },
    );

    setRoomBookingSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRoomBookingError(data.error ?? "Could not save room booking.");
      return;
    }

    setRoomBookingModal(null);
    setBookedRoom("");
    router.refresh();
  }

  function cancelRoomBookingModal() {
    setRoomBookingModal(null);
    setBookedRoom("");
    setRoomBookingError(null);
  }

  function handlePosterStatusChange(deliverableId: string, newStatus: string) {
    if (newStatus === "done") {
      setPosterUploadError(null);
      setPosterFile(null);
      setPosterUploadModal({ deliverableId });
      return;
    }
    updateDeliverable(deliverableId, newStatus);
  }

  async function confirmPosterUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!posterUploadModal) return;

    if (!posterFile) {
      setPosterUploadError("Select a PDF or image file.");
      return;
    }

    setPosterUploadSaving(true);
    setPosterUploadError(null);

    const formData = new FormData();
    formData.append("file", posterFile);

    const res = await fetch(
      `/api/deliverables/${posterUploadModal.deliverableId}/asset`,
      { method: "POST", body: formData },
    );

    setPosterUploadSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setPosterUploadError(data.error ?? "Could not upload poster.");
      return;
    }

    setPosterUploadModal(null);
    setPosterFile(null);
    router.refresh();
  }

  function cancelPosterUploadModal() {
    setPosterUploadModal(null);
    setPosterFile(null);
    setPosterUploadError(null);
  }

  function startEditingEvents() {
    setEventDrafts(
      Object.fromEntries(
        data.events.map((ev) => [
          ev.id,
          { title: ev.title, startDate: ev.startAt.slice(0, 10) },
        ]),
      ),
    );
    setEditingEvents(true);
  }

  function shiftEventToDate(isoDateTime: string, startDate: string): string {
    const dt = new Date(isoDateTime);
    const [year, month, day] = startDate.split("-").map(Number);
    dt.setFullYear(year, month - 1, day);
    return dt.toISOString();
  }

  async function saveEvents() {
    setEventsSaving(true);

    for (const ev of data.events) {
      const draft = eventDrafts[ev.id];
      if (!draft) continue;

      const dateChanged = draft.startDate !== ev.startAt.slice(0, 10);
      const titleChanged = draft.title !== ev.title;
      if (!dateChanged && !titleChanged) continue;

      const payload: { title: string; startAt?: string; endAt?: string } = {
        title: draft.title.trim() || ev.title,
      };

      if (dateChanged) {
        payload.startAt = shiftEventToDate(ev.startAt, draft.startDate);
        if (ev.endAt) {
          payload.endAt = shiftEventToDate(ev.endAt, draft.startDate);
        }
      }

      await fetch(`/api/events/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setEventsSaving(false);
    setEditingEvents(false);
    router.refresh();
  }

  function cancelEventsEdit() {
    setEditingEvents(false);
  }

  async function deleteEvent(eventId: string, title: string) {
    if (
      !window.confirm(
        `Delete "${title}"? This removes the event and its planning checklist.`,
      )
    ) {
      return;
    }

    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? "Could not delete event.");
      return;
    }

    router.refresh();
  }

  const { committee } = data;
  const [closingActionItemId, setClosingActionItemId] = useState<string | null>(
    null,
  );

  async function closeActionItem(itemId: string) {
    setClosingActionItemId(itemId);
    const res = await fetch(`/api/action-items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    setClosingActionItemId(null);

    if (!res.ok) {
      const body = await res.json();
      window.alert(body.error ?? "Could not close action item.");
      return;
    }

    router.refresh();
  }

  const actionItemsSection = (
    <section className="mt-6">
      <h2 className="mb-3 font-semibold">Open action items</h2>
      {data.actionItems.length === 0 ? (
        <p className="text-sm text-slate-500">None</p>
      ) : (
        <ul className="space-y-2">
          {data.actionItems.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded border bg-white p-3 text-sm"
            >
              <span>
                {a.description}
                {a.ownerName && (
                  <span className="text-slate-500"> · {a.ownerName}</span>
                )}
                {a.dueDate && (
                  <span className="text-slate-400"> · due {a.dueDate}</span>
                )}
              </span>
              {data.canEdit && (
                <button
                  type="button"
                  disabled={closingActionItemId === a.id}
                  onClick={() => void closeActionItem(a.id)}
                  className="shrink-0 text-[#00629B] hover:underline disabled:opacity-50"
                >
                  {closingActionItemId === a.id ? "Closing…" : "Close"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const meetingNotesSection = (
    <section className="mt-6">
      <h2 className="mb-3 font-semibold">Meeting notes</h2>
      {data.meetingNotes.length === 0 ? (
        <p className="text-sm text-slate-500">None</p>
      ) : (
        <ul className="space-y-2">
          {data.meetingNotes.map((n) => (
            <li key={n.id}>
              <Link
                href={`/meetings/${n.id}`}
                className="block rounded border bg-white p-3 text-sm hover:border-[#00629B]/40"
              >
                {format(new Date(n.meetingDate), "MMM d, yyyy")}
                {n.summary && (
                  <span className="mt-1 block line-clamp-2 text-slate-600">
                    {n.summary}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {committee.trackingType}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">{committee.name}</h1>
        </div>
        {data.canEdit && committee.trackingType === "events" && (
          <Link
            href={`/committees/${committee.slug}/events/new`}
            className="rounded bg-[#00629B] px-4 py-2 text-sm font-medium text-white hover:bg-[#004d7a]"
          >
            + Add event
          </Link>
        )}
      </div>

      {isExec && (
        <nav className="mt-6 flex gap-1 border-b border-slate-200">
          {(
            [
              { id: "main" as const, label: "Main" },
              { id: "mentor-matching" as const, label: "Mentor matching" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setExecTab(tab.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                execTab === tab.id
                  ? "border-[#00629B] text-[#00629B]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {isPrez && (
        <nav className="mt-6 flex gap-1 border-b border-slate-200">
          {(
            [
              { id: "main" as const, label: "Main" },
              { id: "attendance" as const, label: "Attendance" },
              { id: "expenses" as const, label: "Expense tracker" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPrezTab(tab.id)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                prezTab === tab.id
                  ? "border-[#00629B] text-[#00629B]"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      )}

      {showCommitteeMain && (
      <section className="mt-6 rounded border bg-white p-4">
        {committee.trackingType === "events" ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Semester goal</h2>
                <p className="mt-1 text-sm text-slate-600">{data.semester.label}</p>
              </div>
              {data.canEdit && !editingSemesterGoal && (
                <button
                  type="button"
                  onClick={() => setEditingSemesterGoal(true)}
                  className="shrink-0 rounded border border-[#00629B] px-3 py-1.5 text-sm font-medium text-[#00629B] hover:bg-[#00629B]/5"
                >
                  {data.semester.eventTarget != null ? "Update Goals" : "Set goal"}
                </button>
              )}
            </div>
            {editingSemesterGoal && data.canEdit ? (
              <form
                onSubmit={saveSemesterEventGoal}
                className="mt-4 flex flex-wrap items-end gap-2"
              >
                <label className="text-sm text-slate-700">
                  How many events this semester? <span className="text-red-600">*</span>
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="e.g. 4"
                    className="ml-2 w-24 rounded border px-2 py-1"
                    value={semesterTargetInput}
                    onChange={(e) => setSemesterTargetInput(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  disabled={semesterGoalSaving}
                  className="rounded bg-[#00629B] px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {semesterGoalSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelSemesterGoalEdit}
                  disabled={semesterGoalSaving}
                  className="rounded border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </form>
            ) : data.semester.eventTarget != null ? (
              <div className="mt-3">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{data.semester.completedEvents}</span>
                  {" of "}
                  <span className="font-medium">{data.semester.eventTarget}</span>
                  {" events completed this semester"}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#00629B]"
                    style={{
                      width: `${Math.min(100, (data.semester.completedEvents / data.semester.eventTarget) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No semester event goal set yet.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Goals</h2>
              {data.canEdit && (
                <button
                  onClick={() => setShowGoalForm(!showGoalForm)}
                  className="text-sm text-[#00629B]"
                >
                  + Add goal
                </button>
              )}
            </div>
            {showGoalForm && (
              <form onSubmit={createGoal} className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  required
                  placeholder="Goal title"
                  className="rounded border px-2 py-1 sm:col-span-2"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                />
                <input
                  placeholder="Target metric"
                  className="rounded border px-2 py-1"
                  value={goalForm.targetMetric}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, targetMetric: e.target.value })
                  }
                />
                <input
                  type="date"
                  className="rounded border px-2 py-1"
                  value={goalForm.deadline}
                  onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                />
                <button type="submit" className="rounded bg-[#00629B] text-white">
                  Save
                </button>
              </form>
            )}
            {data.goals.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No custom goals yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.goals.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2">
                    <span>
                      {g.title}
                      {g.targetMetric && (
                        <span className="text-slate-400"> — {g.targetMetric}</span>
                      )}
                      {g.deadline && (
                        <span className="text-slate-400"> · due {g.deadline}</span>
                      )}
                    </span>
                    {data.canEdit ? (
                      <select
                        value={g.status}
                        onChange={(e) => updateGoalStatus(g.id, e.target.value)}
                        className="rounded border text-xs"
                      >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    ) : (
                      <StatusBadge status={g.status} label={g.status.replace("_", " ")} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      )}

      {!isPrez && !isExec && actionItemsSection}

      {isExec && execTab === "main" && (
        <>
          {actionItemsSection}
          {meetingNotesSection}
        </>
      )}

      {isExec && execTab === "mentor-matching" && (
        <div className="mt-6">
          <MentorMatching
            canManage={data.canManageMentorMatching ?? false}
            semesterLabel={data.semester.label}
          />
        </div>
      )}

      {isPrez && prezTab === "main" && actionItemsSection}

      {isPrez && prezTab === "attendance" && data.execAttendance && (
        <div className="mt-6">
          <ExecAttendanceTracker
            matrix={data.execAttendance}
            canEdit={data.canEdit}
          />
        </div>
      )}

      {isPrez && prezTab === "expenses" && data.expenses && (
        <div className="mt-6">
          <ExpenseTracker
            expenses={data.expenses}
            total={data.expenseTotal ?? 0}
          />
        </div>
      )}

      {committee.trackingType === "events" && showCommitteeMain && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900">Events</h2>
            {data.canEdit && data.events.length > 0 && !editingEvents && (
              <button
                type="button"
                onClick={startEditingEvents}
                className="rounded border border-[#00629B] px-3 py-1.5 text-sm font-medium text-[#00629B] hover:bg-blue-50"
              >
                Edit Events
              </button>
            )}
            {data.canEdit && editingEvents && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveEvents}
                  disabled={eventsSaving}
                  className="rounded bg-[#00629B] px-3 py-1 text-sm text-white disabled:opacity-50"
                >
                  {eventsSaving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEventsEdit}
                  disabled={eventsSaving}
                  className="rounded border px-3 py-1 text-sm text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          {data.events.length === 0 ? (
            <p className="text-sm text-slate-600">No events yet.</p>
          ) : editingEvents ? (
            <div className="space-y-2">
              {data.events.map((ev) => {
                const draft = eventDrafts[ev.id];
                if (!draft) return null;
                return (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-center gap-3 rounded border bg-white p-3"
                  >
                    <input
                      className="min-w-[160px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      value={draft.title}
                      onChange={(e) =>
                        setEventDrafts({
                          ...eventDrafts,
                          [ev.id]: { ...draft, title: e.target.value },
                        })
                      }
                    />
                    <input
                      type="date"
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                      value={draft.startDate}
                      onChange={(e) =>
                        setEventDrafts({
                          ...eventDrafts,
                          [ev.id]: { ...draft, startDate: e.target.value },
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => deleteEvent(ev.id, draft.title)}
                      className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {data.events.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/events/${ev.id}`}
                  className="flex items-center justify-between rounded border bg-white p-3 hover:border-[#00629B]/40"
                >
                  <span className="text-slate-900">{ev.title}</span>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {format(new Date(ev.startAt), "MMM d")}
                    <StatusBadge status={ev.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {committee.slug === "pr" && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold text-slate-900">Poster backlog</h2>
          {data.posterBacklog.length === 0 ? (
            <p className="text-sm text-slate-600">No poster requests yet.</p>
          ) : (
            <div className="space-y-2">
              {data.posterBacklog.map((item) => (
                <details
                  key={item.id}
                  className="group rounded border border-slate-200 bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className="shrink-0 text-slate-400 transition-transform group-open:rotate-90"
                        aria-hidden
                      >
                        ▶
                      </span>
                      <span className="truncate text-sm font-medium text-slate-900">
                        {item.eventTitle}
                      </span>
                      {item.dueDate && (
                        <span className="shrink-0 text-sm text-slate-500">
                          · due {item.dueDate}
                        </span>
                      )}
                    </div>
                    <div
                      onClick={(e) => e.preventDefault()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {data.canEdit ? (
                        <DeliverableStatusSelect
                          value={item.status}
                          onChange={(status) =>
                            handlePosterStatusChange(item.id, status)
                          }
                        />
                      ) : (
                        <span
                          className={`inline-block rounded-md border px-2.5 py-1 text-xs font-medium capitalize ${deliverableStatusBadgeClass(item.status)}`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 px-4 py-3 text-sm">
                    {item.eventDescription ? (
                      <div>
                        <p className="font-medium text-slate-700">Event blurb</p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-600">
                          {item.eventDescription}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500">No event blurb provided.</p>
                    )}
                    {item.posterNotes ? (
                      <div>
                        <p className="font-medium text-slate-700">Notes for PR</p>
                        <p className="mt-1 whitespace-pre-wrap text-slate-600">
                          {item.posterNotes}
                        </p>
                      </div>
                    ) : (
                      <p className="text-slate-500">No additional notes for PR.</p>
                    )}
                    {item.linkedEventId && (
                      <Link
                        href={`/events/${item.linkedEventId}`}
                        className="inline-block text-[#00629B] hover:underline"
                      >
                        View event
                      </Link>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      )}

      {committee.slug === "internal-relations" && data.announcementEvents && (
        <WeeklyAnnouncements events={data.announcementEvents} />
      )}

      {committee.slug === "internal-relations" && (
        <section className="mt-6">
          <h2 className="mb-3 font-semibold text-slate-900">Room booking queue</h2>
          {data.deliverables.filter((d) => d.type === "room_booking").length ===
          0 ? (
            <p className="text-sm text-slate-600">No room requests yet.</p>
          ) : (
            <div className="space-y-2">
              {data.deliverables
                .filter((d) => d.type === "room_booking")
                .map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded border bg-white p-3"
                  >
                    <div className="min-w-0 text-sm text-slate-900">
                      {d.captionSummary ?? "Room booking"}
                      {d.dueDate && (
                        <span className="text-slate-500"> · due {d.dueDate}</span>
                      )}
                      {d.linkedEventId && (
                        <Link
                          href={`/events/${d.linkedEventId}`}
                          className="mt-1 block text-[#00629B] hover:underline"
                        >
                          View event
                        </Link>
                      )}
                    </div>
                    {data.canEdit ? (
                      <DeliverableStatusSelect
                        value={d.status}
                        doneLabel="Booked"
                        onChange={(status) =>
                          handleRoomBookingStatusChange(d.id, status)
                        }
                      />
                    ) : (
                      <span
                        className={`inline-block rounded-md border px-2.5 py-1 text-xs font-medium capitalize ${deliverableStatusBadgeClass(d.status)}`}
                      >
                        {d.status === "done" ? "booked" : d.status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {posterUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={cancelPosterUploadModal}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={confirmPosterUpload} className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Upload poster
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Attach the final poster to mark this request done. It will appear
                  on the event page for download.
                </p>
              </div>

              <FileUploadZone
                file={posterFile}
                onFileChange={(file) => {
                  setPosterFile(file);
                  if (file) setPosterUploadError(null);
                }}
              />

              {posterUploadError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {posterUploadError}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={posterUploadSaving || !posterFile}
                  className="rounded-md bg-[#00629B] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {posterUploadSaving ? "Uploading…" : "Mark done & upload"}
                </button>
                <button
                  type="button"
                  onClick={cancelPosterUploadModal}
                  disabled={posterUploadSaving}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roomBookingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={cancelRoomBookingModal}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={confirmRoomBooking} className="space-y-4">
              <h2 className="text-lg font-medium text-slate-900">Room booked</h2>
              <p className="text-sm text-slate-600">
                Which room was booked? This will update the event location
                automatically.
              </p>
              <label className="block text-sm">
                Room name
                <input
                  required
                  autoFocus
                  type="text"
                  placeholder="e.g. HH B103, PH 225B"
                  className="mt-1 w-full rounded border px-3 py-2"
                  value={bookedRoom}
                  onChange={(e) => setBookedRoom(e.target.value)}
                />
              </label>
              {roomBookingError && (
                <p className="text-sm text-red-600">{roomBookingError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={roomBookingSaving}
                  className="rounded bg-[#00629B] px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {roomBookingSaving ? "Saving…" : "Confirm booking"}
                </button>
                <button
                  type="button"
                  onClick={cancelRoomBookingModal}
                  disabled={roomBookingSaving}
                  className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isPrez && !isExec && meetingNotesSection}
    </div>
  );
}
