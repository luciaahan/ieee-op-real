const COMMITTEE_STATUS_LABELS: Record<string, string> = {
  no_goals: "No goals",
  on_track: "On track",
  keep_going: "Keep going",
  due_soon: "Due soon",
  lets_catch_up: "Let's catch up",
};

const styles: Record<string, string> = {
  on_track: "bg-emerald-100 text-emerald-800",
  no_goals: "bg-sky-100 text-sky-800",
  keep_going: "bg-violet-100 text-violet-800",
  due_soon: "bg-amber-100 text-amber-800",
  lets_catch_up: "bg-orange-100 text-orange-800",
  planned: "bg-slate-100 text-slate-700",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-500",
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-800",
  done: "bg-emerald-100 text-emerald-800",
};

function defaultLabel(status: string): string {
  return COMMITTEE_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {label ?? defaultLabel(status)}
    </span>
  );
}
