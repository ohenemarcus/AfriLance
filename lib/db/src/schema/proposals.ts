import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proposalsTable = pgTable("proposals", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  freelancerId: integer("freelancer_id").notNull(),
  coverLetter: text("cover_letter").notNull(),
  bidAmount: real("bid_amount").notNull(),
  status: text("status").notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProposalSchema = createInsertSchema(proposalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposalsTable.$inferSelect;
