import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InternalLayout } from "@/components/InternalLayout";
import { MeetingsClient } from "./MeetingsClient";
import { db } from "@/lib/db";
import { meetingNotes, committees } from "@/lib/db/schema";
import { getExecRoster } from "@/lib/exec-roster";
import { EXEC_COMMITTEE_ID } from "@/lib/exec-attendance";

export default async function MeetingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notes = await db.select().from(meetingNotes);
  const allCommittees = await db.select().from(committees).orderBy(committees.sortOrder);
  const execRoster = await getExecRoster();
  const canCreate =
    session.user.canEditAll || session.user.committeeEditScopes.length > 0;

  return (
    <InternalLayout>
      <MeetingsClient
        notes={notes}
        committees={allCommittees}
        execRoster={execRoster}
        canCreate={canCreate}
        canEditAll={session.user.canEditAll}
        committeeEditScopes={session.user.committeeEditScopes}
        defaultCommitteeId={EXEC_COMMITTEE_ID}
      />
    </InternalLayout>
  );
}
