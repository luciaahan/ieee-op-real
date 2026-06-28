import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  committees,
  users,
  userPermissions,
  committeeMemberships,
  eventPlanningTemplates,
  eventChecklistItems,
  events,
} from "@/lib/db/schema";
import { COMMITTEES, DEMO_USERS, EVENT_PLANNING_TEMPLATE } from "@/lib/seed-data";
import { parseCommitteeScopes } from "@/lib/permissions";
import { itemApplies, computeDueDate } from "@/lib/checklist";
import type { ChecklistCondition } from "@/lib/seed-data";

const LOG_EXPENSES_TITLE = "Log Expenses";

const REMOVED_CHECKLIST_TITLES = [
  "Make room reservation",
  "Request poster in #pr-requests",
  "Congratulate yourself on a job well done!",
] as const;

const ATTENDANCE_CHECKLIST_TITLE =
  "Write attendance form link on board / keep visible";

/** Insert or update committees from seed data. */
export async function syncCommittees() {
  for (const committee of COMMITTEES) {
    await db
      .insert(committees)
      .values(committee)
      .onConflictDoUpdate({
        target: committees.id,
        set: {
          name: committee.name,
          description: committee.description,
          trackingType: committee.trackingType,
          sortOrder: committee.sortOrder,
        },
      });
  }
}

/** Insert demo users added after initial deploy. */
export async function syncDemoUsers() {
  for (const demo of DEMO_USERS) {
    await db
      .insert(users)
      .values({
        id: demo.id,
        email: demo.email,
        name: demo.name,
        isExecMember: true,
        status: "active",
      })
      .onConflictDoNothing();

    const [existingPerm] = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, demo.id));

    if (!existingPerm) {
      await db.insert(userPermissions).values({
        id: randomUUID(),
        userId: demo.id,
        canViewAll: true,
        canEditAll: demo.canEditAll,
        canManageUsers: demo.canManageUsers,
        committeeEditScopes: JSON.stringify(demo.committees),
      });
    }

    for (const slug of demo.committees) {
      const committee = COMMITTEES.find((c) => c.slug === slug);
      if (!committee) continue;
      await db
        .insert(committeeMemberships)
        .values({
          userId: demo.id,
          committeeId: committee.id,
          roleLabel: demo.canManageUsers ? "President" : "Member",
        })
        .onConflictDoNothing();
    }
  }
}

const EXEC_COMMITTEE_ID = "committee-exec";
const EXEC_SLUG = "exec";

/** Ensure all active exec members can access the Exec committee hub. */
export async function syncExecMemberships() {
  const execCommittee = COMMITTEES.find((c) => c.slug === EXEC_SLUG);
  if (!execCommittee) return;

  const activeExec = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.isExecMember, true), eq(users.status, "active")));

  for (const user of activeExec) {
    await db
      .insert(committeeMemberships)
      .values({
        userId: user.id,
        committeeId: EXEC_COMMITTEE_ID,
        roleLabel: "Exec board",
      })
      .onConflictDoNothing();

    const [perm] = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, user.id));

    if (perm) {
      const scopes = parseCommitteeScopes(perm.committeeEditScopes);
      if (!scopes.includes(EXEC_SLUG)) {
        await db
          .update(userPermissions)
          .set({
            committeeEditScopes: JSON.stringify([...scopes, EXEC_SLUG]),
          })
          .where(eq(userPermissions.userId, user.id));
      }
    }
  }
}

/** Remove checklist items that are now handled automatically on event create. */
export async function syncPlanningTemplates() {
  for (const title of REMOVED_CHECKLIST_TITLES) {
    await db
      .delete(eventPlanningTemplates)
      .where(eq(eventPlanningTemplates.title, title));
    await db
      .delete(eventChecklistItems)
      .where(eq(eventChecklistItems.title, title));
  }

  await db
    .update(eventPlanningTemplates)
    .set({ isRecommended: false })
    .where(eq(eventPlanningTemplates.title, ATTENDANCE_CHECKLIST_TITLE));
  await db
    .update(eventChecklistItems)
    .set({ isRecommended: false })
    .where(eq(eventChecklistItems.title, ATTENDANCE_CHECKLIST_TITLE));

  for (const template of EVENT_PLANNING_TEMPLATE) {
    const [existing] = await db
      .select({ id: eventPlanningTemplates.id })
      .from(eventPlanningTemplates)
      .where(eq(eventPlanningTemplates.title, template.title));

    if (!existing) {
      await db.insert(eventPlanningTemplates).values({
        id: randomUUID(),
        offsetDays: template.offsetDays,
        title: template.title,
        sortOrder: template.sortOrder,
        isOptional: template.isOptional,
        isRecommended: template.isRecommended,
        condition: template.condition,
        linksToDeliverable: template.linksToDeliverable ?? false,
      });
    }
  }

  const [logExpensesTemplate] = await db
    .select()
    .from(eventPlanningTemplates)
    .where(eq(eventPlanningTemplates.title, LOG_EXPENSES_TITLE));

  if (logExpensesTemplate) {
    const activeEvents = await db
      .select()
      .from(events)
      .where(and(isNull(events.deletedAt), eq(events.usePlanningChecklist, true)));

    for (const event of activeEvents) {
      const [existingItem] = await db
        .select({ id: eventChecklistItems.id })
        .from(eventChecklistItems)
        .where(
          and(
            eq(eventChecklistItems.eventId, event.id),
            eq(eventChecklistItems.title, LOG_EXPENSES_TITLE),
          ),
        );

      if (
        !existingItem &&
        itemApplies(logExpensesTemplate.condition as ChecklistCondition, event)
      ) {
        await db.insert(eventChecklistItems).values({
          id: randomUUID(),
          eventId: event.id,
          offsetDays: logExpensesTemplate.offsetDays,
          title: logExpensesTemplate.title,
          sortOrder: logExpensesTemplate.sortOrder,
          isOptional: logExpensesTemplate.isOptional,
          isRecommended: logExpensesTemplate.isRecommended,
          condition: logExpensesTemplate.condition,
          status: "pending",
          dueDate: computeDueDate(event.startAt, logExpensesTemplate.offsetDays),
        });
      }
    }
  }
}
