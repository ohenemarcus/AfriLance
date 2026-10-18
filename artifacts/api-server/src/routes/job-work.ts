import { Router } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { Readable } from "node:stream";
import {
  db,
  jobsTable,
  jobWorkAttachmentsTable,
  jobWorkSubmissionsTable,
  notificationsTable,
  paymentsTable,
  profilesTable,
  proposalsTable,
} from "@workspace/db";
import { z } from "zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorage = new ObjectStorageService();

async function getParticipant(userId: string, jobId: number) {
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId));
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!profile || !job) return null;
  if (profile.id === job.clientId) return { profile, job, role: "client" as const };

  const [acceptedProposal] = await db.select({ id: proposalsTable.id }).from(proposalsTable).where(and(
    eq(proposalsTable.jobId, jobId),
    eq(proposalsTable.freelancerId, profile.id),
    eq(proposalsTable.status, "accepted"),
  ));
  if (!acceptedProposal) return null;
  return { profile, job, role: "freelancer" as const };
}

router.post("/jobs/:jobId/cancel-hire", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const jobId = Number(req.params.jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) { res.status(400).json({ error: "Invalid job ID" }); return; }
  const access = await getParticipant(userId, jobId);
  if (!access || access.role !== "client") { res.status(404).json({ error: "Project not found" }); return; }
  if (access.job.status !== "awaiting_funding") {
    res.status(409).json({ error: "A hire can only be cancelled before payment starts" });
    return;
  }

  const [activePayment] = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(and(
    eq(paymentsTable.jobId, jobId),
    or(eq(paymentsTable.status, "pending"), eq(paymentsTable.status, "escrowed"), eq(paymentsTable.status, "release_pending")),
  )).limit(1);
  if (activePayment) { res.status(409).json({ error: "Payment is already underway. Resolve its status before cancelling the hire." }); return; }

  const result = await db.transaction(async (tx) => {
    const [job] = await tx.update(jobsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, "awaiting_funding")))
      .returning({ id: jobsTable.id });
    if (!job) return null;
    const [proposal] = await tx.update(proposalsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(and(eq(proposalsTable.jobId, jobId), eq(proposalsTable.status, "accepted")))
      .returning({ freelancerId: proposalsTable.freelancerId });
    return { freelancerId: proposal?.freelancerId ?? null };
  });
  if (!result) { res.status(409).json({ error: "Project status changed. Refresh and try again." }); return; }

  if (result.freelancerId != null) {
    await db.insert(notificationsTable).values({
      userId: result.freelancerId,
      type: "hire_cancelled",
      title: "Hiring was cancelled",
      body: `The client cancelled the hire for "${access.job.title}" before funding the project.`,
      relatedId: jobId,
      relatedType: "job",
    });
  }
  res.json({ jobId, status: "cancelled" });
});

router.get("/jobs/:jobId/submissions", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const jobId = Number(req.params.jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) { res.status(400).json({ error: "Invalid job ID" }); return; }

  const access = await getParticipant(userId, jobId);
  if (!access) { res.status(404).json({ error: "Project not found" }); return; }

  const submissions = await db.select().from(jobWorkSubmissionsTable)
    .where(eq(jobWorkSubmissionsTable.jobId, jobId))
    .orderBy(desc(jobWorkSubmissionsTable.createdAt));
  const submissionIds = submissions.map((submission) => submission.id);
  const attachments = submissionIds.length
    ? await db.select().from(jobWorkAttachmentsTable).where(inArray(jobWorkAttachmentsTable.submissionId, submissionIds))
    : [];
  res.json({
    submissions: submissions.map((submission) => ({
      ...submission,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
      attachments: attachments.filter((attachment) => attachment.submissionId === submission.id),
    })),
  });
});

router.post("/jobs/:jobId/submissions", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const jobId = Number(req.params.jobId);
  if (!Number.isInteger(jobId) || jobId <= 0) { res.status(400).json({ error: "Invalid job ID" }); return; }

  const parsed = z.object({
    note: z.string().trim().min(10).max(5000),
    attachments: z.array(z.object({
      objectPath: z.string().min(1).max(500),
      fileName: z.string().trim().min(1).max(255),
      contentType: z.string().min(1).max(120),
    })).max(5).default([]),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Add a work summary and up to five valid attachments" }); return; }

  const access = await getParticipant(userId, jobId);
  if (!access || access.role !== "freelancer") { res.status(404).json({ error: "Project not found" }); return; }
  if (access.job.status !== "in_progress") { res.status(409).json({ error: "Work can only be submitted while the project is in progress" }); return; }

  const objectPathPattern = /^\/api\/storage\/(?:r2|local)-objects\/[0-9a-f-]{36}$/i;
  if (parsed.data.attachments.some((attachment) => !objectPathPattern.test(attachment.objectPath))) {
    res.status(400).json({ error: "One or more attachments use an unsupported storage path" });
    return;
  }

  const [escrowedPayment] = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(and(
    eq(paymentsTable.jobId, jobId),
    eq(paymentsTable.freelancerId, access.profile.id),
    eq(paymentsTable.status, "escrowed"),
  ));
  if (!escrowedPayment) { res.status(409).json({ error: "A confirmed project payment is required before submitting work" }); return; }

  const [latestSubmission] = await db.select().from(jobWorkSubmissionsTable)
    .where(eq(jobWorkSubmissionsTable.jobId, jobId))
    .orderBy(desc(jobWorkSubmissionsTable.createdAt))
    .limit(1);
  if (latestSubmission && latestSubmission.status !== "revision_requested") {
    res.status(409).json({ error: "A work submission is already awaiting client approval" });
    return;
  }

  const submission = await db.transaction(async (tx) => {
    const [updatedJob] = await tx.update(jobsTable)
      .set({ status: "awaiting_approval", updatedAt: new Date() })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, "in_progress")))
      .returning({ id: jobsTable.id });
    if (!updatedJob) return null;

    const [created] = await tx.insert(jobWorkSubmissionsTable).values({
      jobId,
      freelancerId: access.profile.id,
      note: parsed.data.note,
      status: "awaiting_approval",
      ...(latestSubmission?.revisionNote ? { revisionNote: latestSubmission.revisionNote } : {}),
    }).returning();
    if (parsed.data.attachments.length) {
      await tx.insert(jobWorkAttachmentsTable).values(parsed.data.attachments.map((attachment) => ({
        submissionId: created.id,
        ...attachment,
      })));
    }
    return created;
  });
  if (!submission) { res.status(409).json({ error: "Project status changed. Refresh and try again." }); return; }

  await db.insert(notificationsTable).values({
    userId: access.job.clientId,
    type: "work_submitted",
    title: "Work submitted for review",
    body: `${access.profile.name} submitted work for "${access.job.title}". Review it before releasing payment.`,
    relatedId: jobId,
    relatedType: "job",
  });
  res.status(201).json({ ...submission, createdAt: submission.createdAt.toISOString(), updatedAt: submission.updatedAt.toISOString(), attachments: parsed.data.attachments });
});

router.post("/jobs/:jobId/submissions/:submissionId/revisions", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const jobId = Number(req.params.jobId);
  const submissionId = Number(req.params.submissionId);
  const parsed = z.object({ note: z.string().trim().min(5).max(2000) }).safeParse(req.body);
  if (!Number.isInteger(jobId) || !Number.isInteger(submissionId) || !parsed.success) {
    res.status(400).json({ error: "Provide a clear revision request" });
    return;
  }
  const access = await getParticipant(userId, jobId);
  if (!access || access.role !== "client") { res.status(404).json({ error: "Project not found" }); return; }

  const [submission] = await db.select().from(jobWorkSubmissionsTable).where(and(
    eq(jobWorkSubmissionsTable.id, submissionId),
    eq(jobWorkSubmissionsTable.jobId, jobId),
    eq(jobWorkSubmissionsTable.status, "awaiting_approval"),
  ));
  if (!submission || access.job.status !== "awaiting_approval") {
    res.status(409).json({ error: "This submission is no longer awaiting review" });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [job] = await tx.update(jobsTable).set({ status: "in_progress", updatedAt: new Date() })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, "awaiting_approval")))
      .returning({ id: jobsTable.id });
    if (!job) return null;
    const [result] = await tx.update(jobWorkSubmissionsTable)
      .set({ status: "revision_requested", revisionNote: parsed.data.note, updatedAt: new Date() })
      .where(eq(jobWorkSubmissionsTable.id, submissionId))
      .returning();
    return result;
  });
  if (!updated) { res.status(409).json({ error: "Project status changed. Refresh and try again." }); return; }

  await db.insert(notificationsTable).values({
    userId: submission.freelancerId,
    type: "work_revision_requested",
    title: "Revisions requested",
    body: `The client requested revisions for "${access.job.title}". Review their notes and submit the updated work.`,
    relatedId: jobId,
    relatedType: "job",
  });
  res.json(updated);
});

router.post("/jobs/:jobId/submissions/:submissionId/approve", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const jobId = Number(req.params.jobId);
  const submissionId = Number(req.params.submissionId);
  if (!Number.isInteger(jobId) || !Number.isInteger(submissionId)) { res.status(400).json({ error: "Invalid project or submission ID" }); return; }
  const access = await getParticipant(userId, jobId);
  if (!access || access.role !== "client") { res.status(404).json({ error: "Project not found" }); return; }

  const [escrowedPayment] = await db.select({ id: paymentsTable.id }).from(paymentsTable).where(and(
    eq(paymentsTable.jobId, jobId),
    eq(paymentsTable.freelancerId, (await db.select({ freelancerId: proposalsTable.freelancerId }).from(proposalsTable).where(and(eq(proposalsTable.jobId, jobId), eq(proposalsTable.status, "accepted"))).limit(1))[0]?.freelancerId ?? -1),
    eq(paymentsTable.status, "escrowed"),
  ));
  if (!escrowedPayment) { res.status(409).json({ error: "There is no confirmed escrow payment to release" }); return; }

  const [submission] = await db.select().from(jobWorkSubmissionsTable).where(and(
    eq(jobWorkSubmissionsTable.id, submissionId),
    eq(jobWorkSubmissionsTable.jobId, jobId),
    eq(jobWorkSubmissionsTable.status, "awaiting_approval"),
  ));
  if (!submission || access.job.status !== "awaiting_approval") {
    res.status(409).json({ error: "This submission is no longer awaiting review" });
    return;
  }

  const approved = await db.transaction(async (tx) => {
    const [job] = await tx.update(jobsTable).set({ status: "awaiting_release", updatedAt: new Date() })
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.status, "awaiting_approval")))
      .returning({ id: jobsTable.id });
    if (!job) return null;
    const [result] = await tx.update(jobWorkSubmissionsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(jobWorkSubmissionsTable.id, submissionId))
      .returning();
    return result;
  });
  if (!approved) { res.status(409).json({ error: "Project status changed. Refresh and try again." }); return; }

  await db.insert(notificationsTable).values({
    userId: submission.freelancerId,
    type: "work_approved",
    title: "Work approved",
    body: `The client approved your work for "${access.job.title}". Your payment is ready to be released.`,
    relatedId: jobId,
    relatedType: "job",
  });
  res.json({ submission: approved, jobStatus: "awaiting_release" });
});

router.get("/jobs/:jobId/submissions/:submissionId/attachments/:attachmentId", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Sign in to view this file" }); return; }
  const jobId = Number(req.params.jobId);
  const submissionId = Number(req.params.submissionId);
  const attachmentId = Number(req.params.attachmentId);
  if (![jobId, submissionId, attachmentId].every((value) => Number.isInteger(value) && value > 0)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const access = await getParticipant(userId, jobId);
  if (!access) { res.status(404).json({ error: "File not found" }); return; }
  const [attachment] = await db.select().from(jobWorkAttachmentsTable)
    .innerJoin(jobWorkSubmissionsTable, eq(jobWorkAttachmentsTable.submissionId, jobWorkSubmissionsTable.id))
    .where(and(
      eq(jobWorkAttachmentsTable.id, attachmentId),
      eq(jobWorkAttachmentsTable.submissionId, submissionId),
      eq(jobWorkSubmissionsTable.jobId, jobId),
    ));
  if (!attachment) { res.status(404).json({ error: "File not found" }); return; }

  const objectPath = attachment.job_work_attachments.objectPath;
  try {
    let object: { data: Buffer; contentType: string } | null = null;
    const r2Id = objectPath.match(/^\/api\/storage\/r2-objects\/([0-9a-f-]{36})$/i)?.[1];
    const localId = objectPath.match(/^\/api\/storage\/local-objects\/([0-9a-f-]{36})$/i)?.[1];
    if (r2Id) object = await objectStorage.readR2Upload(r2Id);
    else if (localId) object = await objectStorage.readLocalUpload(localId);
    if (!object) { res.status(404).json({ error: "File not found" }); return; }

    res.setHeader("Content-Type", object.contentType || attachment.job_work_attachments.contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(attachment.job_work_attachments.fileName)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(object.data);
  } catch (error) {
    req.log.error({ err: error, jobId, submissionId, attachmentId }, "Failed to read work submission attachment");
    res.status(502).json({ error: "Work file storage is temporarily unavailable" });
  }
});

export default router;
