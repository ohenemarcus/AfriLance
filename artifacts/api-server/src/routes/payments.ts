import { Router } from "express";
import { eq, or, desc, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, paymentsTable, payoutMethodsTable, paymentStatusHistoryTable, profilesTable, jobsTable, proposalsTable, notificationsTable } from "@workspace/db";
import { z } from "zod";
import {
  initializeTransaction,
  verifyTransaction,
  initiateTransfer,
  createTransferRecipient,
  generateReference,
  resolveBankAccount,
  verifyWebhookSignature,
} from "../lib/paystack";
import {
  decryptPayoutAccountNumber,
  encryptPayoutAccountNumber,
} from "../lib/payout-encryption";

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
    freelancerRecipientCode: undefined,
    jobTitle: job?.title ?? null,
    jobStatus: job?.status ?? null,
    freelancerName: freelancer?.name ?? null,
    clientName: client?.name ?? null,
    releasedAt: p.releasedAt?.toISOString() ?? null,
  };
}

function formatGHS(amount: number) {
  return `₵${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function serializePayoutMethod(method: typeof payoutMethodsTable.$inferSelect) {
  return {
    bankCode: method.bankCode,
    bankName: method.bankName,
    channel: method.channel,
    accountLast4: method.accountLast4,
    verified: !!method.recipientCode,
    updatedAt: method.updatedAt.toISOString(),
  };
}

// GET /payments/payout-method — Return only the signed-in freelancer's masked payout method
router.get("/payments/payout-method", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await requireProfile(userId);
  if (!profile || profile.role !== "freelancer") {
    res.status(403).json({ error: "Only freelancers can manage payout details" });
    return;
  }

  const [method] = await db.select().from(payoutMethodsTable)
    .where(eq(payoutMethodsTable.freelancerId, profile.id));
  res.json({ payoutMethod: method ? serializePayoutMethod(method) : null });
});

// PUT /payments/payout-method — Save encrypted payout details for later verification
router.put("/payments/payout-method", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await requireProfile(userId);
  if (!profile || profile.role !== "freelancer") {
    res.status(403).json({ error: "Only freelancers can manage payout details" });
    return;
  }

  const parsed = z.object({
    accountNumber: z.string().trim().regex(/^\d{10,32}$/),
    bankCode: z.string().trim().min(1).max(32),
    bankName: z.string().trim().min(1).max(120),
    channel: z.enum(["bank", "mobile_money"]),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (!/^[0-9a-fA-F]{64}$/.test(process.env.PAYOUT_DETAILS_ENCRYPTION_KEY ?? "")) {
    req.log.error({ freelancerId: profile.id }, "Payout details encryption is not configured");
    res.status(503).json({
      error: "Payout setup is not configured on the server yet. Please contact support.",
    });
    return;
  }

  try {
    const encryptedAccountNumber = encryptPayoutAccountNumber(parsed.data.accountNumber);
    const method = await db.transaction(async (tx) => {
      const [savedMethod] = await tx.insert(payoutMethodsTable).values({
        freelancerId: profile.id,
        recipientCode: null,
        encryptedAccountNumber,
        bankCode: parsed.data.bankCode,
        bankName: parsed.data.bankName,
        channel: parsed.data.channel,
        accountLast4: parsed.data.accountNumber.slice(-4),
      }).onConflictDoUpdate({
        target: payoutMethodsTable.freelancerId,
        set: {
          recipientCode: null,
          encryptedAccountNumber,
          bankCode: parsed.data.bankCode,
          bankName: parsed.data.bankName,
          channel: parsed.data.channel,
          accountLast4: parsed.data.accountNumber.slice(-4),
          updatedAt: new Date(),
        },
      }).returning();
      await tx.insert(notificationsTable).values({
        userId: profile.id,
        type: "payout_method_updated",
        title: "Payout method updated",
        body: "Your payout details were saved and are awaiting verification. Verify them before requesting a payment release.",
        relatedId: profile.id,
        relatedType: "profile",
      });
      return savedMethod;
    });
    res.json({ payoutMethod: serializePayoutMethod(method) });
  } catch (err: any) {
    req.log.error({ err, freelancerId: profile.id }, "Payout method save failed");
    res.status(503).json({ error: "Payout details could not be saved. Please contact support." });
  }
});

// POST /payments/payout-method/verify — Verify the saved details and create a Paystack recipient
router.post("/payments/payout-method/verify", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const profile = await requireProfile(userId);
  if (!profile || profile.role !== "freelancer") {
    res.status(403).json({ error: "Only freelancers can verify payout details" });
    return;
  }

  const [method] = await db.select().from(payoutMethodsTable)
    .where(eq(payoutMethodsTable.freelancerId, profile.id));
  if (!method) { res.status(404).json({ error: "Save a payout method before verifying it" }); return; }
  if (method.recipientCode) {
    res.json({ payoutMethod: serializePayoutMethod(method) });
    return;
  }
  if (!method.encryptedAccountNumber) {
    res.status(409).json({ error: "Please update your payout details before verifying them" });
    return;
  }

  try {
    const accountNumber = decryptPayoutAccountNumber(method.encryptedAccountNumber);
    const payoutChannel = method.channel === "mobile_money" ? "mobile_money" : "bank";
    const accountName = payoutChannel === "mobile_money"
      ? profile.name
      : await resolveBankAccount({
          accountNumber,
          bankCode: method.bankCode,
        });
    const recipientCode = await createTransferRecipient({
      name: accountName,
      accountNumber,
      bankCode: method.bankCode,
      channel: payoutChannel,
      provider: method.bankName,
    });
    const [verifiedMethod] = await db.update(payoutMethodsTable)
      .set({ recipientCode, updatedAt: new Date() })
      .where(and(
        eq(payoutMethodsTable.freelancerId, profile.id),
        eq(payoutMethodsTable.encryptedAccountNumber, method.encryptedAccountNumber),
      ))
      .returning();
    if (!verifiedMethod) {
      res.status(409).json({ error: "Payout details changed during verification. Please try again." });
      return;
    }

    res.json({ payoutMethod: serializePayoutMethod(verifiedMethod) });
  } catch (err: any) {
    req.log.error({ err, freelancerId: profile.id, statusCode: err?.response?.status }, "Payout method verification failed");
    res.status(err?.response ? 422 : 503).json({
      error: err?.response?.data?.message ?? "Could not verify payout details right now. Please try again later.",
    });
  }
});

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
      const [payoutMethod] = await db.select({ recipientCode: payoutMethodsTable.recipientCode }).from(payoutMethodsTable)
        .where(eq(payoutMethodsTable.freelancerId, p.freelancerId));
      return {
        ...enrichPayment(p, job, freelancer, client),
        freelancerHasPayoutMethod: !!payoutMethod?.recipientCode,
      };
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
  if (job.clientId !== profile.id) {
    res.status(403).json({ error: "You can only pay for a job you posted" });
    return;
  }

  const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, freelancerId));
  if (!freelancer) { res.status(404).json({ error: "Freelancer not found" }); return; }

  const [acceptedProposal] = await db.select().from(proposalsTable).where(and(
    eq(proposalsTable.jobId, jobId),
    eq(proposalsTable.freelancerId, freelancerId),
    eq(proposalsTable.status, "accepted"),
  ));
  if (!acceptedProposal) {
    res.status(400).json({ error: "Payments can only be started for the freelancer whose proposal you accepted" });
    return;
  }
  if (job.status !== "open" && job.status !== "awaiting_funding") {
    res.status(409).json({ error: "This project is not awaiting funding" });
    return;
  }
  if (Math.abs(amount - acceptedProposal.bidAmount) > 0.01) {
    res.status(400).json({ error: "Payment amount must match the accepted proposal bid" });
    return;
  }

  const [activePayment] = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(and(
    eq(paymentsTable.jobId, jobId),
    or(eq(paymentsTable.status, "pending"), eq(paymentsTable.status, "escrowed"), eq(paymentsTable.status, "release_pending")),
  )).limit(1);
  if (activePayment) {
    res.status(409).json({ error: "A payment is already pending or funded for this project" });
    return;
  }

  const reference = generateReference("afl");

  const payment = await db.transaction(async (tx) => {
    const [claimedJob] = await tx.update(jobsTable)
      .set({ status: "payment_pending", updatedAt: new Date() })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, job.status)))
      .returning({ id: jobsTable.id });
    if (!claimedJob) return null;
    const [created] = await tx.insert(paymentsTable).values({
      jobId,
      clientId: profile.id,
      freelancerId,
      amount,
      status: "pending",
      paystackReference: reference,
    }).returning();
    await tx.insert(paymentStatusHistoryTable).values({ paymentId: created.id, status: "pending", note: "Payment initialized" });
    return created;
  });
  if (!payment) { res.status(409).json({ error: "The project status changed. Refresh and try again." }); return; }

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
    await db.update(paymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(paymentsTable.id, payment.id));
    await db.insert(paymentStatusHistoryTable).values({ paymentId: payment.id, status: "failed", note: "Payment initialization failed" });
    await db.update(jobsTable).set({ status: "awaiting_funding", updatedAt: new Date() })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, "payment_pending")));
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

  if (payment.status === "escrowed" || payment.status === "release_pending" || payment.status === "released") {
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, payment.jobId));
    const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, payment.freelancerId));
    const [client] = await db.select().from(profilesTable).where(eq(profilesTable.id, payment.clientId));
    res.json(enrichPayment(payment, job, freelancer, client));
    return;
  }

  try {
    const txn = await verifyTransaction(reference);

    if (txn.status !== "success") {
      const stillProcessing = txn.status === "pending" || txn.status === "ongoing";
      if (!stillProcessing) {
        const [failedPayment] = await db.update(paymentsTable)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "pending")))
          .returning();
        if (failedPayment) {
          await db.insert(paymentStatusHistoryTable).values({ paymentId: payment.id, status: "failed", note: `Paystack verification returned ${txn.status}` });
          await db.update(jobsTable).set({ status: "awaiting_funding", updatedAt: new Date() })
            .where(and(eq(jobsTable.id, payment.jobId), eq(jobsTable.status, "payment_pending")));
        }
      }
      res.json({
        status: txn.status,
        paymentStatus: stillProcessing ? "pending" : "failed",
        message: stillProcessing
          ? "Paystack is still processing this payment. Complete checkout and verify again in a moment."
          : `Paystack reports this payment as ${txn.status}. If you completed checkout, contact support before retrying the charge.`,
      });
      return;
    }

    if (txn.reference !== payment.paystackReference || Math.abs(txn.amount - payment.amount) > 0.01) {
      req.log.error({
        paymentId: payment.id,
        expectedReference: payment.paystackReference,
        receivedReference: txn.reference,
        expectedAmount: payment.amount,
        receivedAmount: txn.amount,
      }, "Paystack verification did not match the stored payment");
      res.status(409).json({ error: "Verified payment details do not match this payment. Please contact support." });
      return;
    }

    const [updated] = await db
      .update(paymentsTable)
      .set({ status: "escrowed", updatedAt: new Date() })
      .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "pending")))
      .returning();
    if (!updated) {
      const [currentPayment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, payment.id));
      if (currentPayment) {
        const [currentJob] = await db.select().from(jobsTable).where(eq(jobsTable.id, currentPayment.jobId));
        const [currentFreelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, currentPayment.freelancerId));
        const [currentClient] = await db.select().from(profilesTable).where(eq(profilesTable.id, currentPayment.clientId));
        res.json(enrichPayment(currentPayment, currentJob, currentFreelancer, currentClient));
        return;
      }
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    await db.insert(paymentStatusHistoryTable).values({ paymentId: updated.id, status: "escrowed", note: "Payment verified and placed in escrow", changedBy: payment.clientId });
    const [startedJob] = await db.update(jobsTable)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(and(eq(jobsTable.id, updated.jobId), or(eq(jobsTable.status, "payment_pending"), eq(jobsTable.status, "awaiting_funding"), eq(jobsTable.status, "open"))))
      .returning();

    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, updated.jobId));
    const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, updated.freelancerId));
    const [client] = await db.select().from(profilesTable).where(eq(profilesTable.id, updated.clientId));

    // Notify freelancer that funds are now in escrow
    await db.insert(notificationsTable).values({
      userId: updated.freelancerId,
      type: "job_funded",
      title: "Project funded — work can begin",
      body: `${client?.name ?? "A client"} has funded "${job?.title ?? "your project"}". You can begin work now.`,
      relatedId: updated.id,
      relatedType: "payment",
    });
    if (startedJob) {
      await db.insert(notificationsTable).values({
        userId: updated.clientId,
        type: "job_in_progress",
        title: "Project is in progress",
        body: `Payment is confirmed for "${job?.title ?? "your project"}". The freelancer can begin work.`,
        relatedId: updated.jobId,
        relatedType: "job",
      });
    }

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

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, existing.jobId));
  if (!job || job.status !== "awaiting_release") {
    res.status(409).json({ error: "The client must approve the submitted work before releasing payment" });
    return;
  }

  let transferRef: string | null = null;
  let transferAttempted = false;
  try {
    const [payoutMethod] = await db.select().from(payoutMethodsTable)
      .where(eq(payoutMethodsTable.freelancerId, existing.freelancerId));
    if (!payoutMethod?.recipientCode) {
      res.status(400).json({
        error: "The freelancer needs to save and verify a payout method before this payment can be released.",
      });
      return;
    }

    const recipientCode = payoutMethod.recipientCode;
    transferRef = generateReference("trf");
    const [reserved] = await db.update(paymentsTable)
      .set({ status: "release_pending", paystackTransferReference: transferRef, updatedAt: new Date() })
      .where(and(eq(paymentsTable.id, id), eq(paymentsTable.status, "escrowed")))
      .returning();
    if (!reserved) { res.status(409).json({ error: "Payment status changed. Refresh and try again." }); return; }
    await db.insert(paymentStatusHistoryTable).values({ paymentId: reserved.id, status: "release_pending", note: "Client approved work; Paystack transfer initiated", changedBy: profile.id });

    transferAttempted = true;
    const transferCode = await initiateTransfer({
      recipientCode,
      amount: existing.amount,
      reason: `Afrlance escrow release for payment #${existing.id}`,
      reference: transferRef,
    });
    const [storedTransfer] = await db
      .update(paymentsTable)
      .set({ paystackTransferCode: transferCode, updatedAt: new Date() })
      .where(and(
        eq(paymentsTable.id, id),
        eq(paymentsTable.status, "release_pending"),
        eq(paymentsTable.paystackTransferReference, transferRef),
      ))
      .returning();
    const [currentPayment] = storedTransfer
      ? [storedTransfer]
      : await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
    if (!currentPayment || (currentPayment.status !== "release_pending" && currentPayment.status !== "released")) {
      res.status(409).json({ error: "Payment status changed. Refresh and try again." });
      return;
    }

    const [updatedJob] = await db.select().from(jobsTable).where(eq(jobsTable.id, currentPayment.jobId));
    const [freelancer] = await db.select().from(profilesTable).where(eq(profilesTable.id, currentPayment.freelancerId));
    const [client] = await db.select().from(profilesTable).where(eq(profilesTable.id, currentPayment.clientId));

    if (currentPayment.status === "release_pending") {
      await db.insert(notificationsTable).values([
        { userId: currentPayment.freelancerId, type: "payment_processing", title: "Payout is processing", body: `The client approved "${updatedJob?.title ?? "your project"}". Your payout is being processed.`, relatedId: currentPayment.id, relatedType: "payment" },
        { userId: currentPayment.clientId, type: "payment_processing", title: "Payout is processing", body: `Your approval for "${updatedJob?.title ?? "your project"}" was received. Paystack is processing the transfer.`, relatedId: currentPayment.id, relatedType: "payment" },
      ]);
    }

    res.json(enrichPayment(currentPayment, updatedJob, freelancer, client));
  } catch (err: any) {
    if (transferRef && !transferAttempted) {
      const [restored] = await db.update(paymentsTable)
        .set({ status: "escrowed", paystackTransferReference: null, updatedAt: new Date() })
        .where(and(
          eq(paymentsTable.id, id),
          eq(paymentsTable.status, "release_pending"),
          eq(paymentsTable.paystackTransferReference, transferRef),
        ))
        .returning({ id: paymentsTable.id });
      if (restored) {
        await db.insert(paymentStatusHistoryTable).values({ paymentId: id, status: "escrowed", note: "Payout initiation failed; funds remain in escrow", changedBy: profile.id });
      }
    }
    req.log.error({ err }, "Paystack transfer failed");
    const msg = transferAttempted
      ? "The transfer request outcome is uncertain. The payment remains pending to prevent a duplicate payout; contact support before retrying."
      : err?.response?.data?.message ?? "Transfer failed. Please try again.";
    res.status(502).json({ error: msg });
  }
});

export default router;
