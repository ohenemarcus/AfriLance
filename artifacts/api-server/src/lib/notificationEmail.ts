import { and, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  notificationEmailOutboxTable,
  notificationsTable,
  profilesTable,
} from "@workspace/db";
import { logger } from "./logger";

const MAX_ATTEMPTS = 8;
const BATCH_SIZE = 10;
const CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

async function deliverEmail(outboxId: number, notificationId: number, attempts: number): Promise<void> {
  const [row] = await db
    .select({
      notification: notificationsTable,
      clerkUserId: profilesTable.userId,
    })
    .from(notificationsTable)
    .innerJoin(profilesTable, eq(profilesTable.id, notificationsTable.userId))
    .where(eq(notificationsTable.id, notificationId));

  if (!row) {
    await db.update(notificationEmailOutboxTable)
      .set({ status: "failed", lastError: "Notification or recipient profile no longer exists", lockedAt: null })
      .where(eq(notificationEmailOutboxTable.id, outboxId));
    return;
  }

  try {
    const user = await clerkClient.users.getUser(row.clerkUserId);
    const primaryEmail = user.primaryEmailAddress;
    if (!primaryEmail?.emailAddress || primaryEmail.verification?.status !== "verified") {
      await db.update(notificationEmailOutboxTable)
        .set({ status: "failed", lastError: "Recipient has no verified primary email address", lockedAt: null })
        .where(eq(notificationEmailOutboxTable.id, outboxId));
      return;
    }
    const email = primaryEmail.emailAddress;

    const appUrl = new URL("/notifications", process.env.AFRLANCE_APP_URL || "https://afrlance.com").toString();
    const title = escapeHtml(row.notification.title);
    const text = `You have a new notification on Afrlance: ${row.notification.title}\n\nSign in to review it: ${appUrl}\n`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#183426"><h1 style="font-size:20px">You have a new Afrlance notification</h1><p>${title}</p><p><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#0f5132;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">View notification</a></p><p style="font-size:12px;color:#667">You received this email because it relates to an important account or project update.</p></div>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `afrlance-notification-${outboxId}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [email],
        subject: `Afrlance: ${row.notification.title}`,
        text,
        html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const responseText = (await response.text()).slice(0, 500);
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      throw Object.assign(new Error(`Resend returned ${response.status}: ${responseText}`), { retryable });
    }

    await db.update(notificationEmailOutboxTable)
      .set({ status: "sent", sentAt: new Date(), lockedAt: null, lastError: null })
      .where(eq(notificationEmailOutboxTable.id, outboxId));
  } catch (error) {
    const retryable = !(error && typeof error === "object" && "retryable" in error && error.retryable === false);
    const exhausted = attempts >= MAX_ATTEMPTS;
    const status = retryable && !exhausted ? "pending" : "failed";
    const backoffMs = Math.min(6 * 60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempts - 1));
    const message = error instanceof Error ? error.message : String(error);
    await db.update(notificationEmailOutboxTable)
      .set({
        status,
        lockedAt: null,
        nextAttemptAt: new Date(Date.now() + backoffMs),
        lastError: message.slice(0, 500),
      })
      .where(eq(notificationEmailOutboxTable.id, outboxId));
    logger.error({ err: error, outboxId, notificationId, attempts, retryable, exhausted }, "Notification email delivery failed");
  }
}

async function processEmailBatch(): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;

  const now = new Date();
  const staleClaim = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx.select()
      .from(notificationEmailOutboxTable)
      .where(or(
        and(
          eq(notificationEmailOutboxTable.status, "pending"),
          lte(notificationEmailOutboxTable.nextAttemptAt, now),
        ),
        and(
          eq(notificationEmailOutboxTable.status, "processing"),
          lt(notificationEmailOutboxTable.lockedAt, staleClaim),
        ),
      ))
      .orderBy(notificationEmailOutboxTable.createdAt)
      .limit(BATCH_SIZE)
      .for("update", { skipLocked: true });

    const claimedRows = [];
    for (const row of rows) {
      const [claimedRow] = await tx.update(notificationEmailOutboxTable)
        .set({
          status: "processing",
          lockedAt: now,
          attempts: sql`${notificationEmailOutboxTable.attempts} + 1`,
        })
        .where(inArray(notificationEmailOutboxTable.id, [row.id]))
        .returning();
      if (claimedRow) claimedRows.push(claimedRow);
    }
    return claimedRows;
  });

  for (const row of claimed) {
    await deliverEmail(row.id, row.notificationId, row.attempts);
  }
}

export function startNotificationEmailWorker(): void {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    logger.info("Notification email worker is disabled; configure RESEND_API_KEY and RESEND_FROM_EMAIL to enable delivery");
    return;
  }

  const run = () => {
    void processEmailBatch().catch((error) => {
      logger.error({ err: error }, "Notification email worker failed");
    });
  };
  run();
  const timer = setInterval(run, 30_000);
  timer.unref();
}
