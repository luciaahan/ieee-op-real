import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

type CommitteeCardProps = {
  slug: string;
  name: string;
  trackingType: string;
  status: string;
  semesterProgress?: { completed: number; target: number };
  nextEvent: { id: string; title: string; startAt: string } | null;
  openActionItems: number;
  backlogCount?: number;
};

export function CommitteeCard({
  slug,
  name,
  trackingType,
  status,
  semesterProgress,
  nextEvent,
  openActionItems,
  backlogCount,
}: CommitteeCardProps) {
  return (
    <Link
      href={`/committees/${slug}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#00629B]/40 hover:shadow"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{name}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
        {trackingType}
      </p>
      {trackingType === "events" && semesterProgress && (
        <p className="text-sm text-slate-600">
          {semesterProgress.completed}/{semesterProgress.target} events this semester
        </p>
      )}
      {trackingType === "events" && !semesterProgress && status === "no_goals" && (
        <p className="text-sm text-slate-600">Set a semester event goal to start tracking</p>
      )}
      {(trackingType === "deliverables" || trackingType === "rooms") &&
        backlogCount != null &&
        backlogCount > 0 && (
          <p className="text-sm text-slate-600">
            {backlogCount} pending request{backlogCount !== 1 ? "s" : ""}
          </p>
        )}
      {nextEvent && (
        <p className="mt-1 text-sm text-slate-700">
          Next: {nextEvent.title}
        </p>
      )}
      {openActionItems > 0 && (
        <p className="mt-2 text-xs text-[#C41230]">
          {openActionItems} open action item(s)
        </p>
      )}
    </Link>
  );
}
