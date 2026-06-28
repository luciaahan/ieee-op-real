import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { actionItems, committees } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [item] = await db.select().from(actionItems).where(eq(actionItems.id, id));

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [committee] = await db
    .select()
    .from(committees)
    .where(eq(committees.id, item.committeeId));

  if (!committee || !canEdit(session.user, committee.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const status = body.status as string | undefined;

  if (status !== "done" && status !== "open") {
    return NextResponse.json(
      { error: "status must be \"done\" or \"open\"." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  await db
    .update(actionItems)
    .set({
      status,
      completedAt: status === "done" ? now : null,
    })
    .where(eq(actionItems.id, id));

  const [updated] = await db
    .select()
    .from(actionItems)
    .where(eq(actionItems.id, id));

  return NextResponse.json(updated);
}
