import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  clientId: integer("client_id").notNull(),
  freelancerId: integer("freelancer_id").notNull(),
  amount: real("amount").notNull(),
  status: text("status").notNull().default("pending"),
  paystackReference: text("paystack_reference"),
  paystackTransferCode: text("paystack_transfer_code"),
  freelancerRecipientCode: text("freelancer_recipient_code"),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentStatusHistoryTable = pgTable("payment_status_history", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  changedBy: integer("changed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disputesTable = pgTable("payment_disputes", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull(),
  openedBy: integer("opened_by").notNull(),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  requestedAmount: real("requested_amount").notNull(),
  status: text("status").notNull().default("open"),
  decisionNotes: text("decision_notes"),
  refundAmount: real("refund_amount"),
  decidedBy: integer("decided_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const disputeEvidenceTable = pgTable("dispute_evidence", {
  id: serial("id").primaryKey(),
  disputeId: integer("dispute_id").notNull(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  releasedAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
