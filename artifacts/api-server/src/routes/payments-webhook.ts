import { Router } from "express";
import { and, eq, or } from "drizzle-orm";
import { db, jobsTable, notificationsTable, paymentStatusHistoryTable, paymentsTable } from "@workspace/db";
import { verifyWebhookSignature } from "../lib/paystack";

const router = Router();

router.post("/", async (req, res): Promise<void> => {
  const signature = req.headers["x-paystack-signature"] as string;
  if (!signature) { res.status(400).json({ error: "Missing signature" }); return; }

  const rawBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid signature" }); return;
  }

  const parsed = JSON.parse(rawBody);
  const { event, data } = parsed;

  if (event === "charge.success") {
    const reference = data?.reference;
    if (reference) {
      const [payment] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.paystackReference, reference));
      if (payment && payment.status === "pending") {
        const [updated] = await db
          .update(paymentsTable)
          .set({ status: "escrowed", updatedAt: new Date() })
          .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "pending")))
          .returning();
        if (updated) {
          await db.insert(paymentStatusHistoryTable).values({ paymentId: payment.id, status: "escrowed", note: "Payment confirmed by Paystack webhook" });
          const [job] = await db.update(jobsTable)
            .set({ status: "in_progress", updatedAt: new Date() })
            .where(and(eq(jobsTable.id, payment.jobId), or(eq(jobsTable.status, "payment_pending"), eq(jobsTable.status, "awaiting_funding"), eq(jobsTable.status, "open"))))
            .returning();
          if (job) {
            await db.insert(notificationsTable).values([
              { userId: payment.clientId, type: "job_in_progress", title: "Project is in progress", body: `Payment is confirmed for "${job.title}". The freelancer can begin work.`, relatedId: job.id, relatedType: "job" },
              { userId: payment.freelancerId, type: "job_funded", title: "Project funded — work can begin", body: `The client has funded "${job.title}". You can begin work now.`, relatedId: job.id, relatedType: "job" },
            ]);
          }
        }
      }
    }
  }

  if (event === "transfer.success") {
    const transferCode = data?.transfer_code;
    const transferReference = data?.reference;
    const transferConditions = [
      ...(typeof transferCode === "string" ? [eq(paymentsTable.paystackTransferCode, transferCode)] : []),
      ...(typeof transferReference === "string" ? [eq(paymentsTable.paystackTransferReference, transferReference)] : []),
    ];
    if (transferConditions.length) {
      const [payment] = await db.select().from(paymentsTable).where(or(...transferConditions));
      if (payment && payment.status === "release_pending") {
        const [updated] = await db
          .update(paymentsTable)
          .set({ status: "released", releasedAt: new Date(), paystackTransferCode: typeof transferCode === "string" ? transferCode : payment.paystackTransferCode, updatedAt: new Date() })
          .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "release_pending")))
          .returning();
        if (updated) {
          await db.insert(paymentStatusHistoryTable).values({ paymentId: payment.id, status: "released", note: "Paystack confirmed the freelancer transfer" });
          const [job] = await db.update(jobsTable)
            .set({ status: "completed", updatedAt: new Date() })
            .where(and(eq(jobsTable.id, payment.jobId), eq(jobsTable.status, "awaiting_release")))
            .returning();
          if (job) {
            await db.insert(notificationsTable).values([
              { userId: payment.clientId, type: "job_completed", title: "Project completed", body: `The approved work for "${job.title}" has been paid out and marked complete.`, relatedId: job.id, relatedType: "job" },
              { userId: payment.freelancerId, type: "job_completed", title: "Project completed", body: `Your payout for "${job.title}" has been confirmed.`, relatedId: job.id, relatedType: "job" },
            ]);
          }
        }
      }
    }
  }

  if (event === "transfer.failed" || event === "transfer.reversed") {
    const transferCode = data?.transfer_code;
    const transferReference = data?.reference;
    const transferConditions = [
      ...(typeof transferCode === "string" ? [eq(paymentsTable.paystackTransferCode, transferCode)] : []),
      ...(typeof transferReference === "string" ? [eq(paymentsTable.paystackTransferReference, transferReference)] : []),
    ];
    if (transferConditions.length) {
      const [payment] = await db.select().from(paymentsTable).where(or(...transferConditions));
      if (payment && payment.status === "release_pending") {
        const [updated] = await db.update(paymentsTable)
          .set({ status: "escrowed", paystackTransferCode: null, paystackTransferReference: null, updatedAt: new Date() })
          .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "release_pending")))
          .returning();
        if (updated) {
          await db.insert(paymentStatusHistoryTable).values({ paymentId: payment.id, status: "escrowed", note: "Paystack transfer failed; funds remain in escrow" });
          await db.insert(notificationsTable).values({
            userId: payment.clientId,
            type: "payment_release_failed",
            title: "Payout could not be completed",
            body: "The freelancer payout failed. Funds remain in escrow; review the payment and try again.",
            relatedId: payment.id,
            relatedType: "payment",
          });
        }
      }
    }
  }

  if (event === "charge.failed") {
    const reference = data?.reference;
    if (reference) {
      const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.paystackReference, reference));
      if (payment && payment.status === "pending") {
        const [failed] = await db.update(paymentsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "pending")))
          .returning({ id: paymentsTable.id });
        if (failed) {
          await db.insert(paymentStatusHistoryTable).values({ paymentId: payment.id, status: "failed", note: "Paystack reported that the charge failed" });
          await db.update(jobsTable).set({ status: "awaiting_funding", updatedAt: new Date() })
            .where(and(eq(jobsTable.id, payment.jobId), eq(jobsTable.status, "payment_pending")));
          await db.insert(notificationsTable).values({
            userId: payment.clientId,
            type: "payment_failed",
            title: "Project payment failed",
            body: "The charge failed. The project is still awaiting funding; you can retry from the Payments page.",
            relatedId: payment.jobId,
            relatedType: "job",
          });
        }
      }
    }
  }

  res.sendStatus(200);
});

export default router;
