"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPairsForExport, countMenteesPerMentor, MENTOR_MENTEE_WARN_THRESHOLD } from "@/lib/mentor-pairing";
import type { MentorMatchingState } from "@/lib/mentor-matching";

const BUCKET_LABELS: Record<string, string> = {
  single_area: "Single area",
  multiple_areas: "Multiple areas",
  undecided: "Undecided",
};

function formatPairingOptionLabel(
  app: { andrewId: string; grade: string; areas: string },
  menteeCount?: number,
): string {
  let label = `${app.andrewId} (${app.grade}) · ${app.areas}`;
  if (menteeCount && menteeCount > 0) {
    const warn = menteeCount >= MENTOR_MENTEE_WARN_THRESHOLD ? " ⚠" : "";
    label += ` — ${menteeCount} mentee${menteeCount === 1 ? "" : "s"}${warn}`;
  }
  return label;
}

function parseAreaList(areas: string): string[] {
  if (!areas || areas === "Undecided") return areas ? [areas] : [];
  if (!areas.includes(",")) return [areas];
  return areas
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}

function applicationHasField(
  app: { areas: string },
  field: string,
): boolean {
  if (!field) return true;
  return parseAreaList(app.areas).includes(field);
}

function mentorMatchesMenteeCountFilter(
  mentorId: string,
  filter: string,
  menteeCountByMentor: Map<string, number>,
): boolean {
  if (!filter) return true;
  const count = menteeCountByMentor.get(mentorId) ?? 0;
  if (filter === "3+") return count >= 3;
  return count === Number(filter);
}

type PairListSort = "grade" | "a-z";

function sortPairApplications<
  T extends { andrewId: string; gradeOrder: number },
>(apps: T[], sort: PairListSort): T[] {
  return [...apps].sort((a, b) => {
    if (sort === "grade") {
      if (a.gradeOrder !== b.gradeOrder) return a.gradeOrder - b.gradeOrder;
      return a.andrewId.localeCompare(b.andrewId);
    }
    return a.andrewId.localeCompare(b.andrewId);
  });
}

export function MentorMatching({
  canManage,
  semesterLabel,
}: {
  canManage: boolean;
  semesterLabel: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<MentorMatchingState | null>(null);
  const [sheetsConfigured, setSheetsConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [pairDraft, setPairDraft] = useState({
    mentorApplicationId: "",
    menteeApplicationId: "",
  });
  const [pairFilters, setPairFilters] = useState({
    field: "",
    menteeCount: "",
  });
  const [pairSort, setPairSort] = useState<{
    mentor: PairListSort;
    mentee: PairListSort;
  }>({
    mentor: "a-z",
    mentee: "a-z",
  });
  const [groupPairDraft, setGroupPairDraft] = useState<
    Record<string, { mentorApplicationId: string; menteeApplicationId: string }>
  >({});

  const groupKey = (bucket: string, areaKey: string) => `${bucket}::${areaKey}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/exec/mentor-matching");
    if (!res.ok) {
      setError("Could not load mentor matching.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setState(data);
    setSheetsConfigured(data.sheetsConfigured ?? true);
    if (data.cycle?.sheetUrl) setSheetUrl(data.cycle.sheetUrl);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncFromSheet(e: React.FormEvent) {
    e.preventDefault();
    if (!sheetUrl.trim()) return;
    setSyncing(true);
    setError(null);

    const res = await fetch("/api/exec/mentor-matching/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrl: sheetUrl.trim(), label: semesterLabel }),
    });

    setSyncing(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sync failed.");
      return;
    }
    setState(data);
    router.refresh();
  }

  async function syncFromTsv(file: File) {
    setSyncing(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("label", semesterLabel);

    const res = await fetch("/api/exec/mentor-matching/sync", {
      method: "POST",
      body: formData,
    });

    setSyncing(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Upload failed.");
      return;
    }
    setState(data);
    router.refresh();
  }

  async function confirmPair(
    pairId: string,
    mentorApplicationId?: string,
    menteeApplicationId?: string,
  ) {
    setError(null);
    const res = await fetch(`/api/exec/mentor-matching/pairs/${pairId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mentorApplicationId, menteeApplicationId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not confirm pair.");
      return;
    }
    setState(data);
    router.refresh();
  }

  async function removePair(pairId: string) {
    if (!window.confirm("Remove this pair?")) return;
    setError(null);
    const res = await fetch(`/api/exec/mentor-matching/pairs/${pairId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not remove pair.");
      return;
    }
    setState(data);
    router.refresh();
  }

  async function createPair(
    mentorApplicationId: string,
    menteeApplicationId: string,
    matchedArea: string,
    draftKey?: string,
  ) {
    if (!state?.cycle) return;
    setError(null);
    const res = await fetch("/api/exec/mentor-matching/pairs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cycleId: state.cycle.id,
        mentorApplicationId,
        menteeApplicationId,
        matchedArea,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not create pair.");
      return;
    }
    if (draftKey) {
      setGroupPairDraft((prev) => ({
        ...prev,
        [draftKey]: {
          mentorApplicationId,
          menteeApplicationId: "",
        },
      }));
    } else {
      setPairDraft({
        mentorApplicationId,
        menteeApplicationId: "",
      });
    }
    setState(data);
    router.refresh();
  }

  async function finalizeMatching() {
    if (!state?.cycle) return;
    if (
      !window.confirm(
        "Finalize matching? This locks all confirmed pairs for the semester.",
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch("/api/exec/mentor-matching/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleId: state.cycle.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not finalize.");
      return;
    }
    setState(data);
    router.refresh();
  }

  async function copyExport() {
    if (!state?.pairs.length) return;
    const text = formatPairsForExport(
      state.pairs.map((p) => ({
        mentorAndrewId: p.mentorAndrewId,
        menteeAndrewId: p.menteeAndrewId,
        matchedArea: p.matchedArea,
        status: p.status,
      })),
    );
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const mentors =
    state?.applications.filter((a) => a.role === "Mentor") ?? [];
  const mentees =
    state?.applications.filter((a) => a.role === "Mentee") ?? [];
  const isFinalized = state?.cycle?.status === "finalized";

  const pairedMenteeIds = new Set(
    state?.pairs.map((p) => p.menteeApplicationId) ?? [],
  );
  const menteeCountByMentor = countMenteesPerMentor(state?.pairs ?? []);
  const appByAndrew = new Map(
    state?.applications.map((a) => [a.andrewId, a]) ?? [],
  );
  const overloadedMentors = state?.overloadedMentors ?? [];

  function mentorsInGroup(andrewIds: string[]) {
    return andrewIds
      .map((id) => appByAndrew.get(id))
      .filter(
        (app): app is NonNullable<typeof app> => !!app && app.role === "Mentor",
      );
  }

  function unmatchedMenteesInGroup(andrewIds: string[]) {
    return andrewIds
      .map((id) => appByAndrew.get(id))
      .filter(
        (app): app is NonNullable<typeof app> =>
          !!app &&
          app.role === "Mentee" &&
          !pairedMenteeIds.has(app.id),
      );
  }

  function unmatchedMenteesGlobal() {
    return (
      state?.applications.filter(
        (app) => app.role === "Mentee" && !pairedMenteeIds.has(app.id),
      ) ?? []
    );
  }

  const fieldOptions = [
    ...new Set(
      (state?.applications ?? []).flatMap((app) => parseAreaList(app.areas)),
    ),
  ].sort((a, b) => {
    if (a === "Undecided") return 1;
    if (b === "Undecided") return -1;
    return a.localeCompare(b);
  });

  const filteredPairMentors = mentors.filter(
    (m) =>
      applicationHasField(m, pairFilters.field) &&
      mentorMatchesMenteeCountFilter(
        m.id,
        pairFilters.menteeCount,
        menteeCountByMentor,
      ),
  );

  const filteredPairMentees = unmatchedMenteesGlobal().filter((m) =>
    applicationHasField(m, pairFilters.field),
  );

  const sortedPairMentors = sortPairApplications(
    filteredPairMentors,
    pairSort.mentor,
  );
  const sortedPairMentees = sortPairApplications(
    filteredPairMentees,
    pairSort.mentee,
  );

  function resolveMatchedArea(
    mentorApplicationId: string,
    menteeApplicationId: string,
  ): string | null {
    const mentor = state?.applications.find((a) => a.id === mentorApplicationId);
    const mentee = state?.applications.find((a) => a.id === menteeApplicationId);
    if (!mentor || !mentee) return null;

    const mentorAreas = parseAreaList(mentor.areas);
    const menteeAreas = parseAreaList(mentee.areas);
    const shared = mentorAreas.filter((area) => menteeAreas.includes(area));

    if (shared.length > 0) return shared[0];
    if (menteeAreas.length === 1) return menteeAreas[0];
    if (mentorAreas.length === 1) return mentorAreas[0];
    return mentee.areas || mentor.areas || null;
  }

  function updatePairFilters(
    updates: Partial<{ field: string; menteeCount: string }>,
  ) {
    const next = { ...pairFilters, ...updates };
    setPairFilters(next);

    const nextMentors = mentors.filter(
      (m) =>
        applicationHasField(m, next.field) &&
        mentorMatchesMenteeCountFilter(
          m.id,
          next.menteeCount,
          menteeCountByMentor,
        ),
    );
    const nextMentees = unmatchedMenteesGlobal().filter((m) =>
      applicationHasField(m, next.field),
    );

    setPairDraft((prev) => ({
      mentorApplicationId: nextMentors.some((m) => m.id === prev.mentorApplicationId)
        ? prev.mentorApplicationId
        : "",
      menteeApplicationId: nextMentees.some(
        (m) => m.id === prev.menteeApplicationId,
      )
        ? prev.menteeApplicationId
        : "",
    }));
  }

  function addPairFromDraft() {
    const matchedArea =
      pairFilters.field ||
      resolveMatchedArea(
        pairDraft.mentorApplicationId,
        pairDraft.menteeApplicationId,
      );
    if (!matchedArea) {
      setError("Could not determine a matched area for this pair.");
      return;
    }
    void createPair(
      pairDraft.mentorApplicationId,
      pairDraft.menteeApplicationId,
      matchedArea,
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading mentor matching…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-slate-900">Mentor matching</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sync mentor/mentee form responses from Google Sheets. One mentor can have
          multiple mentees. Pair within groups or in the Pairs section — manual pairs
          are confirmed immediately. Only auto-suggested pairs need confirmation.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {canManage && !isFinalized && (
        <div className="rounded border bg-white p-4 space-y-4">
          <form onSubmit={syncFromSheet} className="space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Google Sheets URL <span className="text-red-600">*</span>
              </span>
              <input
                required
                type="url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                disabled={syncing}
              />
            </label>
            {!sheetsConfigured && (
              <p className="text-xs text-amber-700">
                Google service account is not configured. Use TSV upload below, or set
                GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
              </p>
            )}
            <button
              type="submit"
              disabled={syncing || !sheetsConfigured}
              className="rounded bg-[#00629B] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {syncing ? "Syncing…" : "Sync from Google Sheets"}
            </button>
          </form>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600 mb-2">
              Or upload a TSV export from the form responses sheet:
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".tsv,.txt,text/tab-separated-values"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void syncFromTsv(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={syncing}
              className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Upload TSV
            </button>
          </div>
        </div>
      )}

      {state?.cycle && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span>
              Cycle: <strong>{state.cycle.label}</strong>
            </span>
            <span>{state.stats.totalApplications} responses</span>
            <span>{state.stats.confirmedPairs} confirmed pairs</span>
            <span>{state.stats.unmatchedCount} unmatched</span>
            {state.cycle.syncedAt && (
              <span>
                Last synced {new Date(state.cycle.syncedAt).toLocaleString()}
              </span>
            )}
            {isFinalized && (
              <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">
                Finalized
              </span>
            )}
          </div>

          {overloadedMentors.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">
                {overloadedMentors.length} mentor
                {overloadedMentors.length === 1 ? "" : "s"} with more than{" "}
                {MENTOR_MENTEE_WARN_THRESHOLD} mentees
              </p>
              <ul className="mt-1 list-inside list-disc text-amber-800">
                {overloadedMentors.map((m) => (
                  <li key={m.mentorApplicationId}>
                    {m.andrewId} — {m.menteeCount} mentees
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.groups.length > 0 && (
            <section>
              <h3 className="mb-3 font-semibold text-slate-900">Groups</h3>
              <p className="mb-3 text-sm text-slate-600">
                Expand a group to pair mentees with a mentor. Mentors can receive
                multiple mentees; each mentee can only have one mentor.
              </p>
              <div className="space-y-3">
                {state.groups.map((group) => {
                  const key = groupKey(group.bucket, group.areaKey);
                  const groupAndrewIds = group.applications.map((a) => a.andrewId);
                  const groupMentors = mentorsInGroup(groupAndrewIds);
                  const unmatchedMentees = unmatchedMenteesInGroup(groupAndrewIds);
                  const draft = groupPairDraft[key] ?? {
                    mentorApplicationId: "",
                    menteeApplicationId: "",
                  };

                  return (
                  <details
                    key={key}
                    className="rounded border bg-white"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                      <span className="mr-2 text-slate-400">▶</span>
                      {BUCKET_LABELS[group.bucket] ?? group.bucket}: {group.areaKey}
                      <span className="ml-2 font-normal text-slate-500">
                        · {group.stats.mentors} mentors, {group.stats.mentees} mentees
                        {unmatchedMentees.length > 0 && (
                          <span className="text-amber-700">
                            {" "}
                            · {unmatchedMentees.length} unmatched mentees
                          </span>
                        )}
                      </span>
                    </summary>
                    {canManage && !isFinalized && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Pair within group
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="text-sm text-slate-700">
                            Mentor
                            <select
                              className="mt-1 block min-w-[200px] rounded border px-2 py-1"
                              value={draft.mentorApplicationId}
                              disabled={groupMentors.length === 0}
                              onChange={(e) =>
                                setGroupPairDraft((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draft,
                                    mentorApplicationId: e.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">Select…</option>
                              {groupMentors.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {formatPairingOptionLabel(
                                    m,
                                    menteeCountByMentor.get(m.id),
                                  )}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-700">
                            Mentee
                            <select
                              className="mt-1 block min-w-[200px] rounded border px-2 py-1"
                              value={draft.menteeApplicationId}
                              disabled={unmatchedMentees.length === 0}
                              onChange={(e) =>
                                setGroupPairDraft((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draft,
                                    menteeApplicationId: e.target.value,
                                  },
                                }))
                              }
                            >
                              <option value="">Select…</option>
                              {unmatchedMentees.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {formatPairingOptionLabel(m)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            disabled={
                              !draft.mentorApplicationId ||
                              !draft.menteeApplicationId
                            }
                            onClick={() =>
                              void createPair(
                                draft.mentorApplicationId,
                                draft.menteeApplicationId,
                                group.areaKey,
                                key,
                              )
                            }
                            className="rounded border border-[#00629B] px-3 py-1.5 text-sm text-[#00629B] disabled:opacity-50"
                          >
                            Add pair
                          </button>
                        </div>
                      </div>
                    )}
                    <ul className="border-t border-slate-100 px-4 py-2 text-sm">
                      {group.applications.map((app) => {
                        const dbApp = appByAndrew.get(app.andrewId);
                        const menteeCount = dbApp
                          ? menteeCountByMentor.get(dbApp.id) ?? 0
                          : 0;
                        const isMenteePaired =
                          dbApp?.role === "Mentee" &&
                          pairedMenteeIds.has(dbApp.id);
                        return (
                        <li
                          key={app.andrewId}
                          className={`py-1 ${isMenteePaired ? "text-slate-400" : "text-slate-700"}`}
                        >
                          {app.andrewId} · {app.grade} · {app.role}
                          {isMenteePaired && (
                            <span className="ml-2 text-xs text-slate-400">paired</span>
                          )}
                          {app.role === "Mentor" && menteeCount > 0 && (
                            <span
                              className={`ml-2 text-xs ${
                                menteeCount > MENTOR_MENTEE_WARN_THRESHOLD
                                  ? "font-medium text-amber-700"
                                  : "text-slate-500"
                              }`}
                            >
                              {menteeCount} mentee{menteeCount === 1 ? "" : "s"}
                              {menteeCount > MENTOR_MENTEE_WARN_THRESHOLD &&
                                " — high load"}
                            </span>
                          )}
                        </li>
                        );
                      })}
                    </ul>
                  </details>
                  );
                })}
              </div>
            </section>
          )}

          {state.cycle && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Pairs</h3>
                {state.pairs.length > 0 && (
                <button
                  type="button"
                  onClick={() => void copyExport()}
                  className="rounded border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {copied ? "Copied!" : "Copy pairs as TSV"}
                </button>
                )}
              </div>

              {canManage && !isFinalized && (
                <div className="mb-4 rounded border bg-white p-4">
                  <p className="mb-3 text-sm font-medium text-slate-900">
                    Add pair
                  </p>
                  <div className="mb-3 flex flex-wrap items-end gap-3">
                    <label className="text-sm text-slate-700">
                      Field
                      <select
                        className="mt-1 block min-w-[200px] rounded border px-2 py-1"
                        value={pairFilters.field}
                        onChange={(e) =>
                          updatePairFilters({ field: e.target.value })
                        }
                      >
                        <option value="">All fields</option>
                        {fieldOptions.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      Mentor mentee count
                      <select
                        className="mt-1 block min-w-[160px] rounded border px-2 py-1"
                        value={pairFilters.menteeCount}
                        onChange={(e) =>
                          updatePairFilters({ menteeCount: e.target.value })
                        }
                      >
                        <option value="">Any</option>
                        <option value="0">0 mentees</option>
                        <option value="1">1 mentee</option>
                        <option value="2">2 mentees</option>
                        <option value="3+">3+ mentees</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      Mentor sort
                      <select
                        className="mt-1 block min-w-[140px] rounded border px-2 py-1"
                        value={pairSort.mentor}
                        onChange={(e) =>
                          setPairSort((prev) => ({
                            ...prev,
                            mentor: e.target.value as PairListSort,
                          }))
                        }
                      >
                        <option value="grade">Grade</option>
                        <option value="a-z">A to Z</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      Mentee sort
                      <select
                        className="mt-1 block min-w-[140px] rounded border px-2 py-1"
                        value={pairSort.mentee}
                        onChange={(e) =>
                          setPairSort((prev) => ({
                            ...prev,
                            mentee: e.target.value as PairListSort,
                          }))
                        }
                      >
                        <option value="grade">Grade</option>
                        <option value="a-z">A to Z</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="text-sm text-slate-700">
                      Mentor
                      <select
                        className="mt-1 block min-w-[280px] rounded border px-2 py-1"
                        value={pairDraft.mentorApplicationId}
                        onChange={(e) =>
                          setPairDraft({
                            ...pairDraft,
                            mentorApplicationId: e.target.value,
                          })
                        }
                      >
                        <option value="">Select…</option>
                        {sortedPairMentors.map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatPairingOptionLabel(
                              m,
                              menteeCountByMentor.get(m.id),
                            )}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-700">
                      Mentee
                      <select
                        className="mt-1 block min-w-[280px] rounded border px-2 py-1"
                        value={pairDraft.menteeApplicationId}
                        onChange={(e) =>
                          setPairDraft({
                            ...pairDraft,
                            menteeApplicationId: e.target.value,
                          })
                        }
                      >
                        <option value="">Select…</option>
                        {sortedPairMentees.map((m) => (
                          <option key={m.id} value={m.id}>
                            {formatPairingOptionLabel(m)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={
                        !pairDraft.mentorApplicationId ||
                        !pairDraft.menteeApplicationId
                      }
                      onClick={() => addPairFromDraft()}
                      className="rounded bg-[#00629B] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Add pair
                    </button>
                  </div>
                </div>
              )}

              {state.pairs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No pairs yet. Pair within a group above, add manually below, or
                  confirm auto-suggested pairs after sync.
                </p>
              ) : (
              <div className="space-y-2">
                {state.pairs.map((pair) => {
                  const mentorLoad =
                    menteeCountByMentor.get(pair.mentorApplicationId) ?? 0;
                  const mentorOverloaded =
                    mentorLoad > MENTOR_MENTEE_WARN_THRESHOLD;

                  return (
                  <div
                    key={pair.id}
                    className={`flex flex-wrap items-center gap-3 rounded border bg-white p-3 text-sm ${
                      mentorOverloaded ? "border-amber-300" : ""
                    }`}
                  >
                    {canManage && !isFinalized && pair.isAutoSuggested && pair.status === "suggested" ? (
                      <>
                        <select
                          className="rounded border px-2 py-1"
                          value={pair.mentorApplicationId}
                          onChange={(e) =>
                            setState((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    pairs: prev.pairs.map((p) =>
                                      p.id === pair.id
                                        ? {
                                            ...p,
                                            mentorApplicationId: e.target.value,
                                            mentorAndrewId:
                                              prev.applications.find(
                                                (a) => a.id === e.target.value,
                                              )?.andrewId ?? p.mentorAndrewId,
                                          }
                                        : p,
                                    ),
                                  }
                                : prev,
                            )
                          }
                        >
                          {mentors.map((m) => (
                            <option key={m.id} value={m.id}>
                              {formatPairingOptionLabel(
                                m,
                                menteeCountByMentor.get(m.id),
                              )}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400">↔</span>
                        <select
                          className="rounded border px-2 py-1"
                          value={pair.menteeApplicationId}
                          onChange={(e) =>
                            setState((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    pairs: prev.pairs.map((p) =>
                                      p.id === pair.id
                                        ? {
                                            ...p,
                                            menteeApplicationId: e.target.value,
                                            menteeAndrewId:
                                              prev.applications.find(
                                                (a) => a.id === e.target.value,
                                              )?.andrewId ?? p.menteeAndrewId,
                                          }
                                        : p,
                                    ),
                                  }
                                : prev,
                            )
                          }
                        >
                          {mentees
                            .filter(
                              (m) =>
                                !pairedMenteeIds.has(m.id) ||
                                m.id === pair.menteeApplicationId,
                            )
                            .map((m) => (
                            <option key={m.id} value={m.id}>
                              {formatPairingOptionLabel(m)}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <span className="font-medium text-slate-900">
                        {pair.mentorAndrewId} → {pair.menteeAndrewId}
                      </span>
                    )}
                    <span className="text-slate-500">· {pair.matchedArea}</span>
                    {mentorOverloaded && (
                      <span className="text-xs font-medium text-amber-700">
                        Mentor has {mentorLoad} mentees (over recommended load)
                      </span>
                    )}
                    {pair.isAutoSuggested && pair.status === "suggested" && (
                      <span className="text-xs text-slate-400">auto-suggested</span>
                    )}
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        pair.status === "confirmed"
                          ? "bg-green-100 text-green-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {pair.status}
                    </span>
                    {canManage && !isFinalized && (
                      <div className="ml-auto flex gap-2">
                        {pair.isAutoSuggested && pair.status === "suggested" && (
                          <button
                            type="button"
                            onClick={() =>
                              void confirmPair(
                                pair.id,
                                pair.mentorApplicationId,
                                pair.menteeApplicationId,
                              )
                            }
                            className="rounded bg-[#00629B] px-3 py-1 text-xs font-medium text-white"
                          >
                            Confirm
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void removePair(pair.id)}
                          className="rounded border border-red-200 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
              )}
            </section>
          )}

          {state.unmatched.length > 0 && (
            <details className="rounded border bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                <span className="mr-2 text-slate-400">▶</span>
                Unmatched ({state.unmatched.length})
              </summary>
              <ul className="border-t border-slate-100 divide-y text-sm">
                {state.unmatched.map((app) => (
                  <li key={app.id} className="px-4 py-2 text-slate-700">
                    {app.andrewId} · {app.grade} · {app.role} · {app.areas}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {canManage && !isFinalized && state.pairs.length > 0 && (
            <button
              type="button"
              onClick={() => void finalizeMatching()}
              className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
            >
              Finalize matching
            </button>
          )}
        </>
      )}

      {!state?.cycle && (
        <p className="text-sm text-slate-500">
          No mentor matching cycle yet. Sync from Google Sheets or upload a TSV to
          start.
        </p>
      )}
    </div>
  );
}
