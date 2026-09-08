import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  skills: text("skills").array().notNull().default([]),
  budgetMin: real("budget_min"),
  budgetMax: real("budget_max"),
  budgetType: text("budget_type").notNull().default("fixed"),
  location: text("location"),
  remote: boolean("remote").notNull().default(true),
  deadline: timestamp("deadline", { withTimezone: true }),
  status: text("status").notNull().default("open"),
  isFlagged: boolean("is_flagged").notNull().default(false),
  proposalCount: integer("proposal_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  proposalCount: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
