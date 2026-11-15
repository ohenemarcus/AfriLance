import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, notificationsTable, profilesTable, servicesTable, userReportsTable } from "@workspace/db";
import { z } from "zod";

const router = Router();
const reportBodySchema = z.object({
  reason: z.enum(["suspicious", "harassment", "misleading", "other"]),
  details: z.string().trim().max(1000).optional().default(""),
});
const reportTargetSchema = z.object({ id: z.coerce.number().int().positive() });

async function submitReport(
  req: Request,
  res: Response,
  targetType: "profile" | "service",
): Promise<void> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = reportTargetSchema.safeParse({ id: targetType === "profile" ? req.params.profileId : req.params.serviceId });
  const body = reportBodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid report" });
    return;
  }

  const [reporter] = await db.select({ id: profilesTable.id })
    .from(profilesTable)
    .where(and(eq(profilesTable.userId, userId), eq(profilesTable.isBlocked, false)));
  if (!reporter) {
    res.status(404).json({ error: "Your profile could not be found" });
    return;
  }

  let reportedId: number;
  let targetDetails: string;
  if (targetType === "profile") {
    const [target] = await db.select({ id: profilesTable.id, name: profilesTable.name })
      .from(profilesTable)
      .where(and(eq(profilesTable.id, params.data.id), eq(profilesTable.isBlocked, false)));
    if (!target) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    reportedId = target.id;
    targetDetails = `Reported profile #${target.id} (${target.name}).`;
  } else {
    const [target] = await db.select({
      id: servicesTable.id,
      title: servicesTable.title,
      userId: profilesTable.id,
    })
      .from(servicesTable)
      .innerJoin(profilesTable, eq(servicesTable.userId, profilesTable.userId))
      .where(and(eq(servicesTable.id, params.data.id), eq(profilesTable.isBlocked, false)));
    if (!target) {
      res.status(404).json({ error: "Service listing not found" });
      return;
    }
    reportedId = target.userId;
    targetDetails = `Reported service listing #${target.id} (${target.title}).`;
  }

  if (reporter.id === reportedId) {
    res.status(400).json({ error: "You cannot report your own profile or listing." });
    return;
  }

  const [report] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(userReportsTable).values({
      reporterId: reporter.id,
      reportedId,
      reason: body.data.reason,
      details: [targetDetails, body.data.details].filter(Boolean).join("\n\n"),
    }).returning();
    await tx.insert(notificationsTable).values({
      userId: reporter.id,
      type: "moderation_report_received",
      title: "We received your report",
      body: "Thanks for helping keep Afrlance safe. Our team will review your report.",
      relatedId: created.id,
      relatedType: "user_report",
    });
    return [created];
  });

  res.status(201).json({ reported: true, reportId: report.id });
}

router.post("/profiles/:profileId/reports", async (req, res): Promise<void> => {
  await submitReport(req, res, "profile");
});

router.post("/services/:serviceId/reports", async (req, res): Promise<void> => {
  await submitReport(req, res, "service");
});

export default router;
