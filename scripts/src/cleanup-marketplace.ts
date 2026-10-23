import { like } from "drizzle-orm";
import { db, jobsTable, profilesTable } from "@workspace/db";

const isDryRun = process.argv.includes("--dry-run");

const demoProfiles = await db
  .select({
    id: profilesTable.id,
    userId: profilesTable.userId,
    name: profilesTable.name,
  })
  .from(profilesTable)
  .where(like(profilesTable.userId, "demo:%"));

const demoJobs = await db
  .select({ id: jobsTable.id, title: jobsTable.title })
  .from(jobsTable)
  .where(like(jobsTable.title, "[Demo]%"));

console.log(
  "Demo profiles:",
  demoProfiles.map((profile) => `${profile.id}: ${profile.name}`).join(", ") ||
    "none",
);
console.log(
  "Demo jobs:",
  demoJobs.map((job) => `${job.id}: ${job.title}`).join(", ") || "none",
);

if (isDryRun) {
  console.log("Dry run complete. No records were deleted.");
  await db.$client.end();
  process.exit(0);
}

if (demoProfiles.length === 0 && demoJobs.length === 0) {
  console.log("No demo marketplace records found.");
  await db.$client.end();
  process.exit(0);
}

if (demoJobs.length > 0) {
  await db.delete(jobsTable).where(like(jobsTable.title, "[Demo]%"));
}

if (demoProfiles.length > 0) {
  await db.delete(profilesTable).where(like(profilesTable.userId, "demo:%"));
}

console.log(
  `Deleted ${demoJobs.length} demo jobs and ${demoProfiles.length} demo profiles.`,
);
console.log(
  "Run the seed again only if you intentionally want to restore demo data.",
);

await db.$client.end();
