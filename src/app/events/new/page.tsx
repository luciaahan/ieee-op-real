import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InternalLayout } from "@/components/InternalLayout";
import { db } from "@/lib/db";
import { committees } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ committee?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { committee: committeeSlug } = await searchParams;
  const allCommittees = await db
    .select()
    .from(committees)
    .orderBy(committees.sortOrder);

  const editableEventCommittees = allCommittees.filter(
    (c) => c.trackingType === "events" && canEdit(session.user, c.slug),
  );

  if (editableEventCommittees.length === 0) {
    redirect("/calendar");
  }

  if (committeeSlug) {
    const match = editableEventCommittees.find((c) => c.slug === committeeSlug);
    if (match) {
      redirect(`/committees/${match.slug}/events/new`);
    }
  }

  if (editableEventCommittees.length === 1) {
    redirect(`/committees/${editableEventCommittees[0].slug}/events/new`);
  }

  return (
    <InternalLayout>
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-bold text-slate-900">Add event</h1>
        <p className="mt-1 text-slate-600">Which committee is hosting?</p>
        <ul className="mt-6 space-y-2">
          {editableEventCommittees.map((committee) => (
            <li key={committee.id}>
              <Link
                href={`/committees/${committee.slug}/events/new`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-[#00629B] hover:border-[#00629B]/40 hover:bg-blue-50/50"
              >
                {committee.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </InternalLayout>
  );
}
