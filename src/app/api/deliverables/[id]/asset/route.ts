import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deliverables } from "@/lib/db/schema";
import { canEdit } from "@/lib/permissions";
import { syncDeliverableToChecklist } from "@/lib/events";
import {
  saveDeliverableAsset,
  readDeliverableAsset,
  deliverableAssetDownloadName,
  deliverableAssetContentType,
} from "@/lib/deliverable-assets";

async function getDeliverable(id: string) {
  const [item] = await db
    .select()
    .from(deliverables)
    .where(eq(deliverables.id, id));
  return item ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const item = await getDeliverable(id);
  if (!item?.assetUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inline =
    new URL(req.url).searchParams.get("disposition") === "inline";

  try {
    const buffer = await readDeliverableAsset(item.assetUrl);
    const fileName = deliverableAssetDownloadName(item.assetUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": deliverableAssetContentType(fileName),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const item = await getDeliverable(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (item.type !== "poster") {
    return NextResponse.json({ error: "Invalid deliverable type" }, { status: 400 });
  }

  if (!canEdit(session.user, "pr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "A poster file (PDF or image) is required." },
      { status: 400 },
    );
  }

  try {
    const { storagePath } = await saveDeliverableAsset(id, file);

    await db
      .update(deliverables)
      .set({
        status: "done",
        assetUrl: storagePath,
      })
      .where(eq(deliverables.id, id));

    await syncDeliverableToChecklist(id, "done", session.user.id);

    const [updated] = await db
      .select()
      .from(deliverables)
      .where(eq(deliverables.id, id));

    return NextResponse.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not upload poster.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
