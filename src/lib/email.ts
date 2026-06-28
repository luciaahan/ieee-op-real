import { Resend } from "resend";

export type ReminderDigest = {
  overdueActionItems: { description: string; committee: string; dueDate: string | null }[];
  upcomingEvents: { title: string; committee: string; startAt: string }[];
  overdueChecklistEvents: { title: string; committee: string; startAt: string }[];
};

function buildDigestHtml(digest: ReminderDigest): string {
  const sections: string[] = [
    "<h1>IEEE CMU — Weekly Ops Digest</h1>",
  ];

  if (digest.overdueActionItems.length > 0) {
    sections.push("<h2>Overdue action items</h2><ul>");
    for (const item of digest.overdueActionItems) {
      sections.push(
        `<li><strong>${item.committee}</strong>: ${item.description}${item.dueDate ? ` (due ${item.dueDate})` : ""}</li>`,
      );
    }
    sections.push("</ul>");
  }

  if (digest.upcomingEvents.length > 0) {
    sections.push("<h2>Upcoming events (next 14 days)</h2><ul>");
    for (const ev of digest.upcomingEvents) {
      sections.push(
        `<li><strong>${ev.committee}</strong>: ${ev.title} — ${ev.startAt.slice(0, 10)}</li>`,
      );
    }
    sections.push("</ul>");
  }

  if (digest.overdueChecklistEvents.length > 0) {
    sections.push("<h2>Events with overdue planning checklist items</h2><ul>");
    for (const ev of digest.overdueChecklistEvents) {
      sections.push(
        `<li><strong>${ev.committee}</strong>: ${ev.title} — ${ev.startAt.slice(0, 10)}</li>`,
      );
    }
    sections.push("</ul>");
  }

  if (
    digest.overdueActionItems.length === 0 &&
    digest.upcomingEvents.length === 0 &&
    digest.overdueChecklistEvents.length === 0
  ) {
    sections.push("<p>All clear — nothing needs attention this week.</p>");
  }

  return sections.join("\n");
}

export async function sendReminderDigest(
  to: string[],
  digest: ReminderDigest,
): Promise<{ sent: boolean; message: string }> {
  const html = buildDigestHtml(digest);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "IEEE CMU <onboarding@resend.dev>";

  if (!apiKey) {
    console.log("[email] RESEND_API_KEY not set — digest preview:\n", html);
    return { sent: false, message: "Logged to console (RESEND_API_KEY not configured)" };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "IEEE CMU — Weekly ops digest",
    html,
  });

  if (error) {
    console.error("[email] send failed:", error);
    return { sent: false, message: error.message };
  }

  return { sent: true, message: `Sent to ${to.length} recipient(s)` };
}
