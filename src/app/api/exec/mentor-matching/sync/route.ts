import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageMentorMatching } from "@/lib/permissions";
import {
  syncMentorMatchingFromSheet,
  syncMentorMatchingFromTsv,
} from "@/lib/mentor-matching";
import { getSemesterSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canManageMentorMatching(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");
    const label =
      (formData.get("label") as string | null)?.trim() ||
      (await getSemesterSettings()).semesterLabel;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "TSV file is required." }, { status: 400 });
    }

    const tsvContent = await file.text();
    try {
      const state = await syncMentorMatchingFromTsv(tsvContent, label);
      return NextResponse.json(state);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not process TSV.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const body = await req.json();
  const sheetUrl = (body.sheetUrl as string | undefined)?.trim();
  const label =
    (body.label as string | undefined)?.trim() ||
    (await getSemesterSettings()).semesterLabel;

  if (!sheetUrl) {
    return NextResponse.json(
      { error: "Google Sheets URL is required." },
      { status: 400 },
    );
  }

  try {
    const state = await syncMentorMatchingFromSheet(sheetUrl, label);
    return NextResponse.json(state);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not sync from Google Sheets.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
