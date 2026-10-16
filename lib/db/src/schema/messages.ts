import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  participantA: integer("participant_a").notNull(),
  participantB: integer("participant_b").notNull(),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  attachmentType: text("attachment_type"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messageReportsTable = pgTable("message_reports", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  reporterId: integer("reporter_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
