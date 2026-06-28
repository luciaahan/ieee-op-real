"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RosterUser = {
  user: { id: string; name: string; email: string; status: string };
  permissions: {
    canEditAll: boolean | null;
    canManageUsers: boolean | null;
  } | null;
  memberships: { slug: string; name: string }[];
};

type Template = {
  id: string;
  offsetDays: number;
  title: string;
  sortOrder: number;
  isOptional: boolean | null;
  isRecommended: boolean | null;
  condition: string;
};

type SemesterSettings = {
  semesterStart: string;
  semesterEnd: string;
  semesterLabel: string;
};

type CommitteeOption = {
  slug: string;
  name: string;
};

type RosterFormValues = {
  name: string;
  email: string;
  committees: string[];
};

const emptyRosterForm: RosterFormValues = {
  name: "",
  email: "",
  committees: [],
};

function RosterModal({
  open,
  title,
  description,
  values,
  committees,
  error,
  saving,
  submitLabel,
  onChange,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  values: RosterFormValues;
  committees: CommitteeOption[];
  error: string | null;
  saving: boolean;
  submitLabel: string;
  onChange: (values: RosterFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  function toggleCommittee(slug: string) {
    onChange({
      ...values,
      committees: values.committees.includes(slug)
        ? values.committees.filter((s) => s !== slug)
        : [...values.committees, slug],
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-lg font-medium">{title}</h2>
          {description && (
            <p className="text-sm text-slate-600">{description}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Name
              <input
                required
                type="text"
                placeholder="Jane Doe"
                className="mt-1 w-full rounded border px-3 py-2"
                value={values.name}
                onChange={(e) => onChange({ ...values, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              Email
              <input
                required
                type="email"
                placeholder="name@andrew.cmu.edu"
                className="mt-1 w-full rounded border px-3 py-2"
                value={values.email}
                onChange={(e) =>
                  onChange({ ...values, email: e.target.value })
                }
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Committees</legend>
            <p className="mt-1 text-xs text-slate-500">
              Prez members automatically receive admin access.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {committees.map((committee) => (
                <label
                  key={committee.slug}
                  className="flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={values.committees.includes(committee.slug)}
                    onChange={() => toggleCommittee(committee.slug)}
                  />
                  {committee.name}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-[#00629B] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function rosterPermissionLabel(
  permissions: RosterUser["permissions"],
  memberships: RosterUser["memberships"],
) {
  if (permissions?.canManageUsers || memberships.some((m) => m.slug === "prez")) {
    return "Admin";
  }
  if (permissions?.canEditAll) return "Edit all";
  return "Committee-scoped";
}

export function AdminClient({
  roster,
  committees,
  initialSettings,
  initialTemplates,
}: {
  roster: RosterUser[];
  committees: CommitteeOption[];
  initialSettings: SemesterSettings;
  initialTemplates: Template[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"roster" | "settings" | "templates" | "email">(
    "roster",
  );
  const [settings, setSettings] = useState(initialSettings);
  const [templates, setTemplates] = useState(initialTemplates);
  const [newTemplate, setNewTemplate] = useState({
    offsetDays: 14,
    title: "",
    sortOrder: 0,
    condition: "always",
  });
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [newUser, setNewUser] = useState(emptyRosterForm);
  const [editUser, setEditUser] = useState(emptyRosterForm);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    router.refresh();
  }

  async function addTemplate(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTemplate),
    });
    setNewTemplate({ offsetDays: 14, title: "", sortOrder: 0, condition: "always" });
    router.refresh();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this checklist template item?")) return;
    await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
    setTemplates((t) => t.filter((x) => x.id !== id));
  }

  async function sendDigest() {
    setEmailStatus("Sending…");
    const res = await fetch("/api/cron/reminders", { method: "POST" });
    const data = await res.json();
    setEmailStatus(data.message ?? (data.sent ? "Sent" : "Failed"));
  }

  function openAddModal() {
    setRosterError(null);
    setNewUser(emptyRosterForm);
    setAddModalOpen(true);
  }

  function openEditModal() {
    if (!selectedUserId) return;
    const entry = roster.find(({ user }) => user.id === selectedUserId);
    if (!entry) return;

    setEditError(null);
    setEditUser({
      name: entry.user.name,
      email: entry.user.email,
      committees: entry.memberships.map((m) => m.slug),
    });
    setEditModalOpen(true);
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setRosterError(null);
    setAddingUser(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });

    setAddingUser(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRosterError(data.error ?? "Could not add user");
      return;
    }

    setAddModalOpen(false);
    setNewUser(emptyRosterForm);
    router.refresh();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;

    setEditError(null);
    setSavingEdit(true);

    const res = await fetch(`/api/admin/users/${selectedUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editUser),
    });

    setSavingEdit(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setEditError(data.error ?? "Could not save changes");
      return;
    }

    setEditModalOpen(false);
    router.refresh();
  }

  const tabs = [
    { id: "roster" as const, label: "Roster" },
    { id: "settings" as const, label: "Semester" },
    { id: "templates" as const, label: "Planning template" },
    { id: "email" as const, label: "Email digest" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-sm ${
                tab === t.id
                  ? "bg-[#00629B] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "roster" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openAddModal}
              className="rounded border border-[#00629B] px-4 py-1.5 text-sm font-medium text-[#00629B] hover:bg-[#00629B]/5"
            >
              Add
            </button>
            <button
              type="button"
              onClick={openEditModal}
              disabled={!selectedUserId}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      <RosterModal
        open={addModalOpen}
        title="Add to roster"
        description="Use the same email they will sign in with via Google. Their domain must also be listed in ALLOWED_EMAIL_DOMAINS on Vercel."
        values={newUser}
        committees={committees}
        error={rosterError}
        saving={addingUser}
        submitLabel="Add to roster"
        onChange={setNewUser}
        onSubmit={addUser}
        onClose={() => setAddModalOpen(false)}
      />

      <RosterModal
        open={editModalOpen}
        title="Edit roster member"
        values={editUser}
        committees={committees}
        error={editError}
        saving={savingEdit}
        submitLabel="Save changes"
        onChange={setEditUser}
        onSubmit={saveEdit}
        onClose={() => setEditModalOpen(false)}
      />

      {tab === "roster" && (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Committees</th>
                <th className="px-4 py-3">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roster.map(({ user, permissions, memberships }) => (
                <tr
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`cursor-pointer border-b ${
                    selectedUserId === user.id
                      ? "bg-[#00629B]/10"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 capitalize">{user.status}</td>
                  <td className="px-4 py-3">
                    {memberships.map((m) => m.slug).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {rosterPermissionLabel(permissions, memberships)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && (
        <form onSubmit={saveSettings} className="max-w-md space-y-4 rounded border bg-white p-4">
          <p className="text-sm text-slate-600">
            Org-wide semester dates for reporting.
          </p>
          <label className="block text-sm">
            Label
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={settings.semesterLabel}
              onChange={(e) =>
                setSettings({ ...settings, semesterLabel: e.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            Start date
            <input
              type="date"
              className="mt-1 w-full rounded border px-3 py-2"
              value={settings.semesterStart}
              onChange={(e) =>
                setSettings({ ...settings, semesterStart: e.target.value })
              }
            />
          </label>
          <label className="block text-sm">
            End date
            <input
              type="date"
              className="mt-1 w-full rounded border px-3 py-2"
              value={settings.semesterEnd}
              onChange={(e) =>
                setSettings({ ...settings, semesterEnd: e.target.value })
              }
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[#00629B] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save semester settings"}
          </button>
        </form>
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Milestone</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="px-4 py-3">T-{t.offsetDays}</td>
                    <td className="px-4 py-3">{t.title}</td>
                    <td className="px-4 py-3">{t.condition}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => deleteTemplate(t.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form onSubmit={addTemplate} className="grid gap-2 rounded border bg-white p-4 sm:grid-cols-4">
            <select
              className="rounded border px-2 py-1"
              value={newTemplate.offsetDays}
              onChange={(e) =>
                setNewTemplate({
                  ...newTemplate,
                  offsetDays: Number(e.target.value),
                })
              }
            >
              <option value={14}>T-14</option>
              <option value={7}>T-7</option>
              <option value={3}>T-3</option>
              <option value={0}>Day-of</option>
            </select>
            <input
              required
              placeholder="Checklist item title"
              className="rounded border px-2 py-1 sm:col-span-2"
              value={newTemplate.title}
              onChange={(e) =>
                setNewTemplate({ ...newTemplate, title: e.target.value })
              }
            />
            <button type="submit" className="rounded bg-[#00629B] text-white">
              Add item
            </button>
          </form>
        </div>
      )}

      {tab === "email" && (
        <div className="max-w-lg rounded border bg-white p-4">
          <p className="text-sm text-slate-600">
            Sends a digest of overdue action items, upcoming events (14 days), and events with overdue planning checklist items to all active exec roster emails.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Configure <code className="text-xs">RESEND_API_KEY</code> and{" "}
            <code className="text-xs">RESEND_FROM</code> for production. Without a key, output is logged to the server console.
          </p>
          <button
            type="button"
            onClick={sendDigest}
            className="mt-4 rounded bg-[#00629B] px-4 py-2 text-sm text-white"
          >
            Send digest now
          </button>
          {emailStatus && (
            <p className="mt-2 text-sm text-slate-700">{emailStatus}</p>
          )}
        </div>
      )}
    </div>
  );
}
