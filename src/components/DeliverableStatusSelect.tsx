const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-red-50 text-red-800 border-red-200 hover:bg-red-100",
  in_progress: "bg-yellow-50 text-yellow-900 border-yellow-200 hover:bg-yellow-100",
  done: "bg-green-50 text-green-800 border-green-200 hover:bg-green-100",
};

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
] as const;

export function DeliverableStatusSelect({
  value,
  onChange,
  doneLabel = "Done",
}: {
  value: string;
  onChange: (value: string) => void;
  doneLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`shrink-0 cursor-pointer rounded-md border px-2.5 py-1.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#00629B]/25 ${STATUS_STYLES[value] ?? STATUS_STYLES.not_started}`}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.value === "done" ? doneLabel : option.label}
        </option>
      ))}
    </select>
  );
}

export function deliverableStatusBadgeClass(status: string): string {
  return STATUS_STYLES[status] ?? STATUS_STYLES.not_started;
}
