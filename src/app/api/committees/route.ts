import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { committees } from "@/lib/db/schema";
import { canViewAllCommittees } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = await db
    .select()
    .from(committees)
    .orderBy(committees.sortOrder);

  if (canViewAllCommittees(session.user)) {
    return NextResponse.json(all);
  }

  const allowed = new Set(session.user.committeeEditScopes);
  return NextResponse.json(all.filter((c) => allowed.has(c.slug)));
}
