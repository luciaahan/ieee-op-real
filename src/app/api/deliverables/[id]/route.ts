import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deliverables, committees, events } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";
import { syncDeliverableToChecklist } from "@/lib/events";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const all = await db.select().from(deliverables);
  const filtered = type ? all.filter((d) => d.type === type) : all;
  return NextResponse.json(filtered);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const [item] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, id));

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const editScope =
    item.type === "room_booking" ? "internal-relations" : "pr";
  if (!canEdit(session.user, editScope)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookedRoom =
    typeof body.bookedRoom === "string" ? body.bookedRoom.trim() : "";

  if (
    body.status === "done" &&
    item.type === "room_booking" &&
    item.status !== "done" &&
    !bookedRoom
  ) {
    return NextResponse.json(
      { error: "Room name is required when marking as booked" },
      { status: 400 },
    );
  }

  if (
    body.status === "done" &&
    item.type === "poster" &&
    item.status !== "done" &&
    !item.assetUrl
  ) {
    return NextResponse.json(
      { error: "Upload a poster file when marking as done" },
      { status: 400 },
    );
  }

  await db
    .update(deliverables)
    .set({
      status: body.status ?? item.status,
      assetUrl: body.assetUrl !== undefined ? body.assetUrl : item.assetUrl,
      designerId: body.designerId ?? item.designerId,
    })
    .where(eq(deliverables.id, id));

  if (
    body.status === "done" &&
    item.type === "room_booking" &&
    item.linkedEventId &&
    bookedRoom
  ) {
    await db
      .update(events)
      .set({ location: bookedRoom })
      .where(eq(events.id, item.linkedEventId));
  }

  if (body.status && item.type === "poster") {
    await syncDeliverableToChecklist(id, body.status, session.user.id);
  }

  const [updated] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, id));

  return NextResponse.json(updated);
}
