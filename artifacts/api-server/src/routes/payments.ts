import { Router } from "express";
import { eq, or, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, paymentsTable, profilesTable, jobsTable, notificationsTable } from "@workspace/db";
import { z } from "zod";
import {
  initializeTransaction,
  verifyTransaction,
  initiateTransfer,
  createTransferRecipient,
  generateReference,
  verifyWebhookSignature,
} from "../lib/paystack";

const router = Router();

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

function enrichPayment(
  p: typeof paymentsTable.$inferSelect,
  job?: typeof jobsTable.$inferSelect | null,
  freelancer?: typeof profilesTable.$inferSelect | null,
  client?: typeof profilesTable.$inferSelect | null,
) {
  return {
    ...p,
    jobTitle: job?.title ?? null,
    freelancerName: freelancer?.name ?? null,
    clientName: client?.name ?? null,
    releasedAt: p.releasedAt?.toISOString() ?? null,
  };
}

function formatGHS(amount: number) {
  return `₵${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// GET /payments
router.get("/payments", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await requireProfile(userId);
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const rows = await db
    .select()
    .from(paymentsTable)
    .where(or(eq(paymentsTable.clientId, profile.id), eq(paymentsTable.freelancerId, profile.id)))
    .orderBy(desc(paymentsTable.createdAt));

  const enriched = await Promise.all(
    rows.map(async (p) => {
      const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, p.jobId));
      const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, p.freelancerId));
      const [client] = await db.select().from(profilesTable).where(eq(profilesTable.id, p.clientId));
      return enrichPayment(p, job, freelancer, client);
    }),
  );

  res.json({ payments: enriched, total: enriched.length });
});

// POST /payments — Initialize Paystack transaction & create pending escrow record
router.post("/payments", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await requireProfile(userId);
  if (!profile || profile.role !== "client") {
    res.status(403).json({ error: "Only clients can initiate payments" });
    return;
  }

  const parsed = z.object({
    jobId: z.number().int(),
    freelancerId: z.number().int(),
    amount: z.number().positive(),
    clientEmail: z.string().email(),
  }).safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { jobId, freelancerId, amount, clientEmail } = parsed.data;

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }

  const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, freelancerId));
  if (!freelancer) { res.status(404).json({ error: "Freelancer not found" }); return; }

  const reference = generateReference("afl");

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      jobId,
      clientId: profile.id,
      freelancerId,
      amount,
      status: "pending",
      paystackReference: reference,
    })
    .returning();

  try {
    const txn = await initializeTransaction({
      email: clientEmail,
      amount,
      reference,
      metadata: {
        paymentId: payment.id,
        jobId,
        freelancerId,
        clientId: profile.id,
        jobTitle: job.title,
      },
    });

    res.status(201).json({
      paymentId: payment.id,
      authorizationUrl: txn.authorizationUrl,
      accessCode: txn.accessCode,
      reference: txn.reference,
    });
  } catch (err: any) {
    await db.delete(paymentsTable).where(eq(paymentsTable.id, payment.id));
    req.log.error({ err }, "Paystack initialization failed");
    res.status(502).json({ error: "Payment gateway error. Please try again." });
  }
});

// GET /payments/verify/:reference — Confirm payment with Paystack, move to escrowed
router.get("/payments/verify/:reference", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { reference } = req.params;
  if (!reference) { res.status(400).json({ error: "Missing reference" }); return; }

  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.paystackReference, reference));

  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }

  if (payment.status === "escrowed" || payment.status === "released") {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, payment.jobId));
    const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, payment.freelancerId));
    const [client] = await db.select().from(profilesTable).where(eq(profilesTable.id, payment.clientId));
    res.json(enrichPayment(payment, job, freelancer, client));
    return;
  }

  try {
    const txn = await verifyTransaction(reference);

    if (txn.status !== "success") {
      res.status(400).json({ error: `Payment not successful. Status: ${txn.status}` });
      return;
    }

    const [updated] = await db
      .update(paymentsTable)
      .set({ status: "escrowed", updatedAt: new Date() })
      .where(eq(paymentsTable.id, payment.id))
      .returning();

    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, updated.jobId));
    const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, updated.freelancerId));
    const [client] = await db.select().from(profilesTable).where(eq(profilesTable.id, updated.clientId));

    // Notify freelancer that funds are now in escrow
    await db.insert(notificationsTable).values({
      userId: updated.freelancerId,
      type: "payment_escrowed",
      title: "Payment placed in escrow",
      body: `${client?.name ?? "A client"} has placed ${formatGHS(updated.amount)} in escrow for "${job?.title ?? "your project"}". You can begin working now.`,
      relatedId: updated.id,
      relatedType: "payment",
    });

    res.json(enrichPayment(updated, job, freelancer, client));
  } catch (err: any) {
    req.log.error({ err }, "Paystack verify failed");
    res.status(502).json({ error: "Could not verify payment. Please contact support." });
  }
});

// PATCH /payments/:id/release — Transfer funds from escrow to freelancer
router.patch("/payments/:id/release", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid payment ID" }); return; }

  const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Payment not found" }); return; }

  const profile = await requireProfile(userId);
  if (!profile || existing.clientId !== profile.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (existing.status !== "escrowed") {
    res.status(400).json({ error: "Payment is not in escrow" });
    return;
  }

  const parsed = z.object({
    recipientCode: z.string().optional(),
    accountNumber: z.string().optional(),
    bankCode: z.string().optional(),
    accountName: z.string().optional(),
  }).safeParse(req.body ?? {});

  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    let recipientCode = existing.freelancerRecipientCode ?? parsed.data.recipientCode;

    if (!recipientCode && parsed.data.accountNumber && parsed.data.bankCode && parsed.data.accountName) {
      const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, existing.freelancerId));
      recipientCode = await createTransferRecipient({
        name: parsed.data.accountName || freelancer?.name || "Freelancer",
        accountNumber: parsed.data.accountNumber,
        bankCode: parsed.data.bankCode,
      });
      await db
        .update(paymentsTable)
        .set({ freelancerRecipientCode: recipientCode })
        .where(eq(paymentsTable.id, id));
    }

    if (!recipientCode) {
      res.status(400).json({
        error: "Freelancer bank details required. Provide accountNumber, bankCode, and accountName.",
      });
      return;
    }

    const transferRef = generateReference("trf");
    const transferCode = await initiateTransfer({
      recipientCode,
      amount: existing.amount,
      reason: `AfriLance escrow release for payment #${existing.id}`,
      reference: transferRef,
    });

    const [updated] = await db
      .update(paymentsTable)
      .set({
        status: "released",
        releasedAt: new Date(),
        paystackTransferCode: transferCode,
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, id))
      .returning();

    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, updated.jobId));
    const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, updated.freelancerId));
    const [client] = await db.select().from(profilesTable).where(eq(profilesTable.id, updated.clientId));

    // Notify freelancer that payment has been released
    await db.insert(notificationsTable).values({
      userId: updated.freelancerId,
      type: "payment_released",
      title: "Payment released to your account!",
      body: `${formatGHS(updated.amount)} from "${job?.title ?? "your project"}" has been transferred to your bank account. Check your balance shortly.`,
      relatedId: updated.id,
      relatedType: "payment",
    });

    // Notify client that release was successful
    await db.insert(notificationsTable).values({
      userId: updated.clientId,
      type: "payment_released",
      title: "Payment successfully released",
      body: `You've successfully released ${formatGHS(updated.amount)} to ${freelancer?.name ?? "the freelancer"} for "${job?.title ?? "your project"}".`,
      relatedId: updated.id,
      relatedType: "payment",
    });

    res.json(enrichPayment(updated, job, freelancer, client));
  } catch (err: any) {
    req.log.error({ err }, "Paystack transfer failed");
    const msg = err?.response?.data?.message ?? "Transfer failed. Please try again.";
    res.status(502).json({ error: msg });
  }
});

export default router;
