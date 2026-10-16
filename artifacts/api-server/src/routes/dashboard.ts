import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  db,
  profilesTable,
  jobsTable,
  proposalsTable,
  messagesTable,
  notificationsTable,
  paymentsTable,
  conversationsTable,
} from "@workspace/db";

const router = Router();

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

// GET /dashboard/freelancer
router.get("/dashboard/freelancer", async (req, res): Promise<void> => {
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

  const [totalApp] = await db
    .select({ count: sql<number>`count(*)` })
    .from(proposalsTable)
    .where(eq(proposalsTable.freelancerId, profile.id));

  const [pendingApp] = await db
    .select({ count: sql<number>`count(*)` })
    .from(proposalsTable)
    .where(and(eq(proposalsTable.freelancerId, profile.id), eq(proposalsTable.status, "submitted")));

  const [acceptedApp] = await db
    .select({ count: sql<number>`count(*)` })
    .from(proposalsTable)
    .where(and(eq(proposalsTable.freelancerId, profile.id), eq(proposalsTable.status, "accepted")));

  const [rejectedApp] = await db
    .select({ count: sql<number>`count(*)` })
    .from(proposalsTable)
    .where(and(eq(proposalsTable.freelancerId, profile.id), eq(proposalsTable.status, "rejected")));

  const [earningsRow] = await db
    .select({ total: sql<number>`coalesce(sum(amount), 0)` })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.freelancerId, profile.id), eq(paymentsTable.status, "released")));

  const [unreadMsg] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .leftJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
    .where(
      and(
        eq(messagesTable.isRead, false),
        sql`${messagesTable.senderId} != ${profile.id}`,
        sql`(${conversationsTable.participantA} = ${profile.id} OR ${conversationsTable.participantB} = ${profile.id})`,
      ),
    );

  const [unreadNotif] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, profile.id), eq(notificationsTable.isRead, false)));

  const recentProposals = await db
    .select({
      proposal: proposalsTable,
      job: jobsTable,
    })
    .from(proposalsTable)
    .leftJoin(jobsTable, eq(proposalsTable.jobId, jobsTable.id))
    .where(eq(proposalsTable.freelancerId, profile.id))
    .orderBy(desc(proposalsTable.createdAt))
    .limit(5);

  res.json({
    totalApplications: Number(totalApp.count),
    pendingApplications: Number(pendingApp.count),
    acceptedApplications: Number(acceptedApp.count),
    rejectedApplications: Number(rejectedApp.count),
    completedJobs: profile.completedJobs,
    totalEarnings: Number(earningsRow.total),
    avgRating: profile.avgRating,
    unreadMessages: Number(unreadMsg.count),
    unreadNotifications: Number(unreadNotif.count),
    recentProposals: recentProposals.map((r) => ({
      ...r.proposal,
      jobTitle: r.job?.title ?? null,
      freelancerName: profile.name,
      freelancerAvatarUrl: profile.avatarUrl,
      freelancerLocation: profile.location,
      freelancerSkills: profile.skills,
      freelancerAvgRating: profile.avgRating,
    })),
  });
});

// GET /dashboard/client
router.get("/dashboard/client", async (req, res): Promise<void> => {
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

  const [totalJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(eq(jobsTable.clientId, profile.id));

  const [openJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.clientId, profile.id), eq(jobsTable.status, "open")));

  const [inProgressJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.clientId, profile.id), eq(jobsTable.status, "in_progress")));

  const [closedJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(eq(jobsTable.clientId, profile.id), eq(jobsTable.status, "closed")));

  const [totalProposals] = await db
    .select({ count: sql<number>`count(*)` })
    .from(proposalsTable)
    .leftJoin(jobsTable, eq(proposalsTable.jobId, jobsTable.id))
    .where(eq(jobsTable.clientId, profile.id));

  const [spentRow] = await db
    .select({ total: sql<number>`coalesce(sum(amount), 0)` })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.clientId, profile.id), eq(paymentsTable.status, "released")));

  const [unreadMsg] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .leftJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
    .where(
      and(
        eq(messagesTable.isRead, false),
        sql`${messagesTable.senderId} != ${profile.id}`,
        sql`(${conversationsTable.participantA} = ${profile.id} OR ${conversationsTable.participantB} = ${profile.id})`,
      ),
    );

  const [unreadNotif] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, profile.id), eq(notificationsTable.isRead, false)));

  const recentJobs = await db
    .select({
      id: jobsTable.id,
      clientId: jobsTable.clientId,
      title: jobsTable.title,
      description: jobsTable.description,
      category: jobsTable.category,
      skills: jobsTable.skills,
      budgetMin: jobsTable.budgetMin,
      budgetMax: jobsTable.budgetMax,
      budgetType: jobsTable.budgetType,
      location: jobsTable.location,
      remote: jobsTable.remote,
      deadline: jobsTable.deadline,
      status: jobsTable.status,
      isFlagged: jobsTable.isFlagged,
      proposalCount: jobsTable.proposalCount,
      createdAt: jobsTable.createdAt,
      updatedAt: jobsTable.updatedAt,
      clientName: profilesTable.name,
      clientAvatarUrl: profilesTable.avatarUrl,
    })
    .from(jobsTable)
    .leftJoin(profilesTable, eq(jobsTable.clientId, profilesTable.id))
    .where(eq(jobsTable.clientId, profile.id))
    .orderBy(desc(jobsTable.createdAt))
    .limit(5);

  res.json({
    totalJobs: Number(totalJobs.count),
    openJobs: Number(openJobs.count),
    inProgressJobs: Number(inProgressJobs.count),
    closedJobs: Number(closedJobs.count),
    totalProposalsReceived: Number(totalProposals.count),
    totalSpent: Number(spentRow.total),
    unreadMessages: Number(unreadMsg.count),
    unreadNotifications: Number(unreadNotif.count),
    recentJobs,
  });
});

export default router;
