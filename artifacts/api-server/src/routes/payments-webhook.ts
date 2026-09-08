import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, paymentsTable } from "@workspace/db";
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
        await db
          .update(paymentsTable)
          .set({ status: "escrowed", updatedAt: new Date() })
          .where(eq(paymentsTable.id, payment.id));
      }
    }
  }

  if (event === "transfer.success") {
    const transferCode = data?.transfer_code;
    if (transferCode) {
      const rows = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.paystackTransferCode, transferCode));
      if (rows[0] && rows[0].status !== "released") {
        await db
          .update(paymentsTable)
          .set({ status: "released", releasedAt: new Date(), updatedAt: new Date() })
          .where(eq(paymentsTable.id, rows[0].id));
      }
    }
  }

  res.sendStatus(200);
});

export default router;
