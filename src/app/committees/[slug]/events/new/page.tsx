import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InternalLayout } from "@/components/InternalLayout";
import { AddEventClient } from "./AddEventClient";
import { db } from "@/lib/db";
import { committees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canEdit, canViewCommittee } from "@/lib/permissions";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.slug, slug));

  if (!committee) notFound();
  if (!canViewCommittee(session.user, slug)) redirect("/dashboard");

  if (committee.trackingType !== "events") {
    redirect(`/committees/${slug}`);
  }

  if (!canEdit(session.user, slug)) {
    redirect(`/committees/${slug}`);
  }

  return (
    <InternalLayout>
      <AddEventClient
        committeeId={committee.id}
        committeeSlug={committee.slug}
        committeeName={committee.name}
      />
    </InternalLayout>
  );
}
