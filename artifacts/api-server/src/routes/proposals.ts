import { Router } from "express";
import { eq, and, or, sql, inArray, ne } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, proposalsTable, profilesTable, jobsTable, notificationsTable, conversationsTable } from "@workspace/db";
import {
  CreateProposalBody,
  GetProposalParams,
  UpdateProposalStatusParams,
  UpdateProposalStatusBody,
  ListJobProposalsParams,
} from "@workspace/api-zod";

const router = Router();

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

function enrichProposal(p: typeof proposalsTable.$inferSelect, freelancer?: typeof profilesTable.$inferSelect | null, job?: typeof jobsTable.$inferSelect | null) {
  return {
    ...p,
    freelancerName: freelancer?.name ?? null,
    freelancerAvatarUrl: freelancer?.avatarUrl ?? null,
    freelancerLocation: freelancer?.location ?? null,
    freelancerSkills: freelancer?.skills ?? [],
    freelancerAvgRating: freelancer?.avgRating ?? null,
    jobTitle: job?.title ?? null,
  };
}

// GET /proposals (my proposals as freelancer)
router.get("/proposals", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const profile = await requireProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const rows = await db
    .select({
      proposal: proposalsTable,
      job: jobsTable,
    })
    .from(proposalsTable)
    .leftJoin(jobsTable, eq(proposalsTable.jobId, jobsTable.id))
    .where(eq(proposalsTable.freelancerId, profile.id))
    .orderBy(proposalsTable.createdAt);

  const proposals = rows.map((r) =>
    enrichProposal(r.proposal, profile, r.job),
  );

  res.json({ proposals, total: proposals.length });
});

// POST /proposals
router.post("/proposals", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const profile = await requireProfile(userId);
  if (!profile || profile.role !== "freelancer") {
    res.status(403).json({ error: "Only freelancers can submit proposals" });
    return;
  }

  const parsed = CreateProposalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, parsed.data.jobId))
      .for("update");

    if (!job) return { error: "job_not_found" as const };
    if (job.status !== "open") return { error: "job_closed" as const };

    const [existing] = await tx
      .select({ id: proposalsTable.id })
      .from(proposalsTable)
      .where(and(
        eq(proposalsTable.jobId, parsed.data.jobId),
        eq(proposalsTable.freelancerId, profile.id),
      ));
    if (existing) return { error: "already_applied" as const };

    const [proposal] = await tx
      .insert(proposalsTable)
      .values({ ...parsed.data, freelancerId: profile.id })
      .returning();

    await tx
      .update(jobsTable)
      .set({ proposalCount: sql`${jobsTable.proposalCount} + 1` })
      .where(eq(jobsTable.id, job.id));

    return { proposal, job };
  });

  if ("error" in result) {
    if (result.error === "job_not_found") {
      res.status(404).json({ error: "Job not found" });
    } else if (result.error === "already_applied") {
      res.status(409).json({ error: "Already applied to this job" });
    } else {
      res.status(409).json({ error: "This job is no longer accepting proposals" });
    }
    return;
  }

  const { proposal, job } = result;

  if (job) {
    await db.insert(notificationsTable).values({
      userId: job.clientId,
      type: "new_proposal",
      title: "New proposal received",
      body: `${profile.name} submitted a proposal for "${job.title}"`,
      relatedId: job.id,
      relatedType: "job",
    });
  }

  res.status(201).json(enrichProposal(proposal, profile, job));
});

// GET /proposals/:id
router.get("/proposals/:id", async (req, res): Promise<void> => {
  const params = GetProposalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({
      proposal: proposalsTable,
      freelancer: profilesTable,
      job: jobsTable,
    })
    .from(proposalsTable)
    .leftJoin(profilesTable, eq(proposalsTable.freelancerId, profilesTable.id))
    .leftJoin(jobsTable, eq(proposalsTable.jobId, jobsTable.id))
    .where(eq(proposalsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  res.json(enrichProposal(row.proposal, row.freelancer, row.job));
});

// PATCH /proposals/:id (update status - client action)
router.patch("/proposals/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateProposalStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProposalStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [actorProfile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  if (!actorProfile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  // Fetch proposal + job to authorize the client and validate the transition.
  const [existingRow] = await db
    .select({ proposal: proposalsTable, job: jobsTable })
    .from(proposalsTable)
    .leftJoin(jobsTable, eq(proposalsTable.jobId, jobsTable.id))
    .where(eq(proposalsTable.id, params.data.id));

  if (!existingRow?.proposal || !existingRow.job) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }
  const existingJob = existingRow.job;
  if (existingRow.job.clientId !== actorProfile.id) {
    res.status(403).json({ error: "Only the job owner can update proposal status" });
    return;
  }
  if (!["submitted", "under_review"].includes(existingRow.proposal.status) ||
      !["under_review", "accepted", "rejected"].includes(parsed.data.status)) {
    res.status(400).json({ error: "This proposal can no longer be updated" });
    return;
  }

  const jobTitle = existingRow?.job?.title ?? "a job";
  const isAccepted = parsed.data.status === "accepted";
  if (isAccepted) {
    if (existingRow.job.status !== "open") {
      res.status(409).json({ error: "This job is no longer accepting a freelancer" });
      return;
    }
    const [alreadyAccepted] = await db.select({ id: proposalsTable.id }).from(proposalsTable).where(and(
      eq(proposalsTable.jobId, existingRow.job.id),
      eq(proposalsTable.status, "accepted"),
    )).limit(1);
    if (alreadyAccepted && alreadyAccepted.id !== existingRow.proposal.id) {
      res.status(409).json({ error: "Another freelancer has already been accepted for this job" });
      return;
    }
  }

  let updateResult;
  try {
    updateResult = await db.transaction(async (tx) => {
      if (isAccepted) {
        const [job] = await tx.update(jobsTable)
          .set({ status: "awaiting_funding", updatedAt: new Date() })
          .where(and(eq(jobsTable.id, existingJob.id), eq(jobsTable.status, "open")))
          .returning({ id: jobsTable.id });
        if (!job) return null;
      }

      const [updated] = await tx.update(proposalsTable)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(proposalsTable.id, params.data.id))
        .returning();
      if (!updated) return null;

      const superseded = isAccepted
        ? await tx.update(proposalsTable)
            .set({ status: "rejected", updatedAt: new Date() })
            .where(and(
              eq(proposalsTable.jobId, existingJob.id),
              ne(proposalsTable.id, updated.id),
              inArray(proposalsTable.status, ["submitted", "under_review"]),
            ))
            .returning({ freelancerId: proposalsTable.freelancerId })
        : [];

      return { updated, superseded };
    });
  } catch (error) {
    req.log.error({ err: error, proposalId: params.data.id }, "Proposal status update failed");
    res.status(500).json({ error: "Could not update proposal status" });
    return;
  }

  if (!updateResult) {
    res.status(isAccepted ? 409 : 404).json({ error: isAccepted ? "Another action changed this job. Refresh and try again." : "Proposal not found" });
    return;
  }
  const { updated, superseded } = updateResult;
  let acceptedConversationId: number | null = null;

  if (isAccepted && existingRow.job) {
    let [conversation] = await db
      .select()
      .from(conversationsTable)
      .where(or(
        and(
          eq(conversationsTable.participantA, existingRow.job.clientId),
          eq(conversationsTable.participantB, updated.freelancerId),
        ),
        and(
          eq(conversationsTable.participantA, updated.freelancerId),
          eq(conversationsTable.participantB, existingRow.job.clientId),
        ),
      ));

    if (!conversation) {
      [conversation] = await db
        .insert(conversationsTable)
        .values({
          participantA: existingRow.job.clientId,
          participantB: updated.freelancerId,
        })
        .returning();
    }
    acceptedConversationId = conversation.id;
  }

  // Rich, specific notifications per status
  if (parsed.data.status === "accepted") {
    await db.insert(notificationsTable).values({
      userId: updated.freelancerId,
      type: "proposal_accepted",
      title: "Proposal accepted!",
      body: `Your proposal for "${jobTitle}" was accepted. Open the conversation to coordinate, but wait for payment confirmation before starting work.`,
      relatedId: existingJob.id,
      relatedType: "job",
    });
  } else if (parsed.data.status === "rejected") {
    await db.insert(notificationsTable).values({
      userId: updated.freelancerId,
      type: "proposal_rejected",
      title: "Proposal not selected",
      body: `Your proposal for "${jobTitle}" was not selected this time. Keep applying — there are more opportunities!`,
      relatedId: updated.id,
      relatedType: "proposal",
    });
  } else {
    await db.insert(notificationsTable).values({
      userId: updated.freelancerId,
      type: "proposal_status",
      title: "Proposal status updated",
      body: `Your proposal for "${jobTitle}" status changed to: ${parsed.data.status}`,
      relatedId: updated.id,
      relatedType: "proposal",
    });
  }

  // Also notify the client's other proposals on the same job are now closed (if accepted)
  if (isAccepted && existingRow?.job) {
    const clientId = existingRow.job.clientId;
    // Notify client that they accepted a proposal
    await db.insert(notificationsTable).values({
      userId: clientId,
      type: "proposal_accepted",
      title: "You accepted a proposal",
      body: `You accepted a proposal for "${jobTitle}". Open the conversation to coordinate next steps.`,
      relatedId: acceptedConversationId,
      relatedType: "conversation",
    });
    if (superseded.length) {
      await db.insert(notificationsTable).values(superseded.map((proposal) => ({
        userId: proposal.freelancerId,
        type: "proposal_rejected",
        title: "This job is no longer accepting proposals",
        body: `The client selected another freelancer for "${jobTitle}".`,
        relatedId: existingJob.id,
        relatedType: "job",
      })));
    }
  }

  res.json(enrichProposal(updated, null, null));
});

// GET /jobs/:jobId/proposals (client view)
router.get("/jobs/:jobId/proposals", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = ListJobProposalsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      proposal: proposalsTable,
      freelancer: profilesTable,
      job: jobsTable,
    })
    .from(proposalsTable)
    .leftJoin(profilesTable, eq(proposalsTable.freelancerId, profilesTable.id))
    .leftJoin(jobsTable, eq(proposalsTable.jobId, jobsTable.id))
    .where(eq(proposalsTable.jobId, params.data.jobId))
    .orderBy(proposalsTable.createdAt);

  const proposals = rows.map((r) =>
    enrichProposal(r.proposal, r.freelancer, r.job),
  );

  res.json({ proposals, total: proposals.length });
});

export default router;
