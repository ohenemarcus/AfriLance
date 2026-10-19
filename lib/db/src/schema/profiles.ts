import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  role: text("role").notNull().default("freelancer"),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  nameChangedAt: timestamp("name_changed_at", { withTimezone: true }),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  location: text("location"),
  skills: text("skills").array().notNull().default([]),
  languages: text("languages").array().notNull().default([]),
  certifications: text("certifications").array().notNull().default([]),
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  industry: text("industry"),
  companySize: text("company_size"),
  hiringBudget: text("hiring_budget"),
  hiringNeeds: text("hiring_needs"),
  hourlyRate: real("hourly_rate"),
  fixedRate: real("fixed_rate"),
  category: text("category"),
  featured: boolean("featured").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  completedJobs: integer("completed_jobs").notNull().default(0),
  avgRating: real("avg_rating"),
  totalReviews: integer("total_reviews").notNull().default(0),
  portfolioItems: jsonb("portfolio_items").notNull().default([]),
  isVerified: boolean("is_verified").notNull().default(false),
  isTopRated: boolean("is_top_rated").notNull().default(false),
  resumeUrl: text("resume_url"),
  verificationDocUrl: text("verification_doc_url"),
  verificationStatus: text("verification_status").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;
