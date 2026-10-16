import { pgTable, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedJobsTable = pgTable("saved_jobs", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  jobId: integer("job_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.profileId, t.jobId)]);

export const insertSavedJobSchema = createInsertSchema(savedJobsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSavedJob = z.infer<typeof insertSavedJobSchema>;
export type SavedJob = typeof savedJobsTable.$inferSelect;
