import "./load-env";
import { randomUUID } from "crypto";
import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  userPermissions,
  committees,
  committeeMemberships,
  eventPlanningTemplates,
} from "@/lib/db/schema";
import {
  COMMITTEES,
  EVENT_PLANNING_TEMPLATE,
  DEMO_USERS,
} from "@/lib/seed-data";

export async function runSeed() {
  const [{ value }] = await db.select({ value: count() }).from(committees);
  if (value > 0) {
    console.log("Already seeded.");
    return;
  }

  console.log("Seeding database...");

  for (const committee of COMMITTEES) {
    await db.insert(committees).values(committee).onConflictDoNothing();
  }

  for (const template of EVENT_PLANNING_TEMPLATE) {
    await db
      .insert(eventPlanningTemplates)
      .values({
        id: randomUUID(),
        offsetDays: template.offsetDays,
        title: template.title,
        sortOrder: template.sortOrder,
        isOptional: template.isOptional,
        isRecommended: template.isRecommended,
        condition: template.condition,
        linksToDeliverable: template.linksToDeliverable ?? false,
      })
      .onConflictDoNothing();
  }

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

    await db
      .insert(userPermissions)
      .values({
        id: randomUUID(),
        userId: demo.id,
        canViewAll: true,
        canEditAll: demo.canEditAll,
        canManageUsers: demo.canManageUsers,
        committeeEditScopes: JSON.stringify(demo.committees),
      })
      .onConflictDoNothing();

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

  console.log("Seed complete.");
}

if (require.main === module) {
  runSeed().catch(console.error);
}
