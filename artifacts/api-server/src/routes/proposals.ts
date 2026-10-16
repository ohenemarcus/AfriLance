import { Router } from "express";
import { eq, and, or, sql } from "drizzle-orm";
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

  // Check not already applied
  const existing = await db
    .select({ id: proposalsTable.id })
    .from(proposalsTable)
    .where(
      and(
        eq(proposalsTable.jobId, parsed.data.jobId),
        eq(proposalsTable.freelancerId, profile.id),
      ),
    );
  if (existing.length > 0) {
    res.status(409).json({ error: "Already applied to this job" });
    return;
  }

  const [proposal] = await db
    .insert(proposalsTable)
    .values({ ...parsed.data, freelancerId: profile.id })
    .returning();

  // Increment proposal count on job
  await db
    .update(jobsTable)
    .set({ proposalCount: sql`${jobsTable.proposalCount} + 1` })
    .where(eq(jobsTable.id, parsed.data.jobId));

  // Notify client
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, parsed.data.jobId));

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

  res.status(201).json(enrichProposal(proposal, profile, job ?? null));
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
  if (existingRow.job.clientId !== actorProfile.id) {
    res.status(403).json({ error: "Only the job owner can update proposal status" });
    return;
  }
  if (!["submitted", "under_review"].includes(existingRow.proposal.status) ||
      !["under_review", "accepted", "rejected"].includes(parsed.data.status)) {
    res.status(400).json({ error: "This proposal can no longer be updated" });
    return;
  }

  const [updated] = await db
    .update(proposalsTable)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(proposalsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  const jobTitle = existingRow?.job?.title ?? "a job";
  const isAccepted = parsed.data.status === "accepted";
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
      body: `Your proposal for "${jobTitle}" was accepted. Open the conversation to coordinate next steps.`,
      relatedId: acceptedConversationId,
      relatedType: "conversation",
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
