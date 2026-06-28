import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageUsers } from "@/lib/permissions";
import { buildReminderDigest, getExecRecipientEmails } from "@/lib/reminders";
import { sendReminderDigest } from "@/lib/email";

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader === `Bearer ${cronSecret}`) return true;
  }
  return false;
}

export async function POST(req: Request) {
  const session = await auth();
  const cronOk = isAuthorized(req);

  if (!cronOk && (!session?.user || !canManageUsers(session.user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = cronOk ? {} : await req.json().catch(() => ({}));
  const digest = await buildReminderDigest();

  let recipients: string[] = [];
  if (Array.isArray(body.to) && body.to.length > 0) {
    recipients = body.to;
  } else {
    recipients = await getExecRecipientEmails();
  }

  const result = await sendReminderDigest(recipients, digest);

  return NextResponse.json({
    ...result,
    digest: {
      overdueActionItems: digest.overdueActionItems.length,
      upcomingEvents: digest.upcomingEvents.length,
      overdueChecklistEvents: digest.overdueChecklistEvents.length,
    },
  });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const digest = await buildReminderDigest();
  return NextResponse.json(digest);
}
