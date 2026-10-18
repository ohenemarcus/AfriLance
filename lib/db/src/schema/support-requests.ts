import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const supportRequestsTable = pgTable("support_requests", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  category: text("category").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});