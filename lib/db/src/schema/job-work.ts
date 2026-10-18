import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const jobWorkSubmissionsTable = pgTable("job_work_submissions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  freelancerId: integer("freelancer_id").notNull(),
  note: text("note").notNull(),
  status: text("status").notNull().default("awaiting_approval"),
  revisionNote: text("revision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("job_work_submissions_job_created_idx").on(table.jobId, table.createdAt),
]);

export const jobWorkAttachmentsTable = pgTable("job_work_attachments", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("job_work_attachments_submission_idx").on(table.submissionId),
]);