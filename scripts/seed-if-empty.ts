import "./load-env";
import { count } from "drizzle-orm";
import { db } from "@/lib/db";
import { committees } from "@/lib/db/schema";
import { seedDefaultSettings } from "@/lib/settings";
import { syncCommittees, syncDemoUsers, syncExecMemberships, syncPlanningTemplates } from "@/lib/seed-sync";
import { runSeed } from "./seed";

async function main() {
  await seedDefaultSettings();
  await syncCommittees();
  await syncDemoUsers();
  await syncExecMemberships();
  await syncPlanningTemplates();

  const [{ value }] = await db.select({ value: count() }).from(committees);
  if (value === 0) {
    await runSeed();
  } else {
    console.log("Database already seeded, skipping.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
