import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  disputeEvidenceTable,
  disputesTable,
  jobsTable,
  notificationsTable,
  paymentStatusHistoryTable,
  paymentsTable,
  profilesTable,
} from "@workspace/db";
import { z } from "zod";
import { refundTransaction } from "../lib/paystack";

const router = Router();

async function profileFor(req: any) {
  const userId = getAuth(req)?.userId;
  return userId ? db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).then((rows) => rows[0]) : null;
}

async function enrichDispute(dispute: typeof disputesTable.$inferSelect) {
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, dispute.paymentId));
  const [job] = payment ? await db.select().from(jobsTable).where(eq(jobsTable.id, payment.jobId)) : [];
  const evidence = await db.select().from(disputeEvidenceTable).where(eq(disputeEvidenceTable.disputeId, dispute.id));
  return {
    ...dispute,
    createdAt: dispute.createdAt.toISOString(),
    updatedAt: dispute.updatedAt.toISOString(),
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    payment,
    jobTitle: job?.title ?? null,
    evidence,
  };
}

async function notifyDisputeParticipants(payment: typeof paymentsTable.$inferSelect, title: string, body: string) {
  await db.insert(notificationsTable).values([
    { userId: payment.clientId, type: "payment_dispute", title, body, relatedId: payment.id, relatedType: "payment" },
    { userId: payment.freelancerId, type: "payment_dispute", title, body, relatedId: payment.id, relatedType: "payment" },
  ]);
}

router.post("/payments/:id/disputes", async (req, res): Promise<void> => {
  const profile = await profileFor(req);
  if (!profile) { res.status(401).json({ error: "Unauthorized" }); return; }
  const paymentId = Number(req.params.id);
  const parsed = z.object({
    reason: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(5000),
    requestedAmount: z.number().positive(),
  }).safeParse(req.body);
  if (!Number.isInteger(paymentId) || !parsed.success) { res.status(400).json({ error: "Invalid dispute details" }); return; }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment || (payment.clientId !== profile.id && payment.freelancerId !== profile.id)) {
    res.status(404).json({ error: "Payment not found" }); return;
  }
  if (payment.status !== "escrowed") { res.status(400).json({ error: "Only escrowed payments can be disputed" }); return; }
  if (parsed.data.requestedAmount > payment.amount) { res.status(400).json({ error: "Requested refund exceeds payment amount" }); return; }

  const [active] = await db.select().from(disputesTable).where(and(
    eq(disputesTable.paymentId, paymentId),
    inArray(disputesTable.status, ["open", "under_review"]),
  ));
  if (active) { res.status(409).json({ error: "This payment already has an active dispute" }); return; }

  const [dispute] = await db.insert(disputesTable).values({
    paymentId,
    openedBy: profile.id,
    reason: parsed.data.reason,
    description: parsed.data.description,
    requestedAmount: parsed.data.requestedAmount,
    status: "open",
  }).returning();
  await db.update(paymentsTable).set({ status: "disputed", updatedAt: new Date() }).where(eq(paymentsTable.id, paymentId));
  await db.insert(paymentStatusHistoryTable).values({ paymentId, status: "disputed", note: "Dispute opened", changedBy: profile.id });
  await notifyDisputeParticipants(payment, "Payment dispute opened", `A dispute was opened for payment #${payment.id}.`);
  res.status(201).json(await enrichDispute(dispute));
});

router.get("/payments/:id/disputes", async (req, res): Promise<void> => {
  const profile = await profileFor(req);
  if (!profile) { res.status(401).json({ error: "Unauthorized" }); return; }
  const paymentId = Number(req.params.id);
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment || (profile.role !== "admin" && payment.clientId !== profile.id && payment.freelancerId !== profile.id)) {
    res.status(404).json({ error: "Payment not found" }); return;
  }
  const disputes = await db.select().from(disputesTable).where(eq(disputesTable.paymentId, paymentId)).orderBy(desc(disputesTable.createdAt));
  res.json({ disputes: await Promise.all(disputes.map(enrichDispute)) });
});

router.post("/disputes/:id/evidence", async (req, res): Promise<void> => {
  const profile = await profileFor(req);
  if (!profile) { res.status(401).json({ error: "Unauthorized" }); return; }
  const disputeId = Number(req.params.id);
  const parsed = z.object({ objectPath: z.string().min(1), fileName: z.string().min(1).max(255), contentType: z.string().min(1).max(120) }).safeParse(req.body);
  if (!Number.isInteger(disputeId) || !parsed.success) { res.status(400).json({ error: "Invalid evidence details" }); return; }
  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, disputeId));
  const [payment] = dispute ? await db.select().from(paymentsTable).where(eq(paymentsTable.id, dispute.paymentId)) : [];
  if (!dispute || !payment || (profile.role !== "admin" && payment.clientId !== profile.id && payment.freelancerId !== profile.id)) {
    res.status(404).json({ error: "Dispute not found" }); return;
  }
  const [evidence] = await db.insert(disputeEvidenceTable).values({ disputeId, ...parsed.data }).returning();
  res.status(201).json(evidence);
});

router.get("/admin/disputes", async (req, res): Promise<void> => {
  const profile = await profileFor(req);
  if (!profile || profile.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const disputes = await db.select().from(disputesTable)
    .where(status ? eq(disputesTable.status, status) : undefined)
    .orderBy(desc(disputesTable.createdAt));
  res.json({ disputes: await Promise.all(disputes.map(enrichDispute)) });
});

router.patch("/admin/disputes/:id/decision", async (req, res): Promise<void> => {
  const profile = await profileFor(req);
  if (!profile || profile.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
  const disputeId = Number(req.params.id);
  const parsed = z.object({
    decision: z.enum(["refund_partial", "refund_full", "reject"]),
    refundAmount: z.number().positive().optional(),
    decisionNotes: z.string().trim().min(3).max(5000),
  }).safeParse(req.body);
  if (!Number.isInteger(disputeId) || !parsed.success) { res.status(400).json({ error: "Invalid decision details" }); return; }
  const [dispute] = await db.select().from(disputesTable).where(eq(disputesTable.id, disputeId));
  const [payment] = dispute ? await db.select().from(paymentsTable).where(eq(paymentsTable.id, dispute.paymentId)) : [];
  if (!dispute || !payment) { res.status(404).json({ error: "Dispute not found" }); return; }
  if (!["open", "under_review"].includes(dispute.status)) { res.status(409).json({ error: "Dispute has already been decided" }); return; }

  const refundAmount = parsed.data.decision === "refund_full" ? payment.amount : parsed.data.decision === "refund_partial" ? parsed.data.refundAmount : 0;
  if (parsed.data.decision !== "reject" && (!refundAmount || refundAmount > payment.amount)) {
    res.status(400).json({ error: "Refund amount must be greater than zero and no more than the payment" }); return;
  }
  if (parsed.data.decision !== "reject" && !payment.paystackReference) {
    res.status(400).json({ error: "This payment has no Paystack reference and cannot be refunded" }); return;
  }
  if (parsed.data.decision !== "reject" && payment.status !== "disputed") {
    res.status(400).json({ error: "Payment is not currently held for dispute" }); return;
  }

  try {
    if (refundAmount && payment.paystackReference) await refundTransaction({ reference: payment.paystackReference, amount: refundAmount });
    const paymentStatus = parsed.data.decision === "reject" ? "escrowed" : refundAmount === payment.amount ? "refunded" : "partially_refunded";
    const disputeStatus = parsed.data.decision === "reject" ? "rejected" : "resolved";
    const [updated] = await db.update(disputesTable).set({
      status: disputeStatus,
      decisionNotes: parsed.data.decisionNotes,
      refundAmount: refundAmount || 0,
      decidedBy: profile.id,
      updatedAt: new Date(),
      resolvedAt: new Date(),
    }).where(eq(disputesTable.id, disputeId)).returning();
    await db.update(paymentsTable).set({ status: paymentStatus, updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id));
    await db.insert(paymentStatusHistoryTable).values({ paymentId: payment.id, status: paymentStatus, note: parsed.data.decisionNotes, changedBy: profile.id });
    await notifyDisputeParticipants(payment, "Payment dispute decided", `An admin decided your payment dispute: ${disputeStatus}.`);
    res.json(await enrichDispute(updated));
  } catch (error) {
    req.log.error({ err: error }, "Dispute refund failed");
    res.status(502).json({ error: "Refund could not be processed. No decision was saved." });
  }
});

router.get("/payments/:id/status-history", async (req, res): Promise<void> => {
  const profile = await profileFor(req);
  if (!profile) { res.status(401).json({ error: "Unauthorized" }); return; }
  const paymentId = Number(req.params.id);
  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, paymentId));
  if (!payment || (profile.role !== "admin" && payment.clientId !== profile.id && payment.freelancerId !== profile.id)) {
    res.status(404).json({ error: "Payment not found" }); return;
  }
  const history = await db.select().from(paymentStatusHistoryTable).where(eq(paymentStatusHistoryTable.paymentId, paymentId)).orderBy(desc(paymentStatusHistoryTable.createdAt));
  res.json({ history });
});

export default router;