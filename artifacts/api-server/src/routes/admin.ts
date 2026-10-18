import { Router } from "express";
import { eq, ilike, and, sql, desc, isNull, lt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getAuth } from "@clerk/express";
import { isAdminUser } from "../lib/adminAccess";
import {
  db,
  profilesTable,
  jobsTable,
  proposalsTable,
  paymentsTable,
  notificationsTable,
  auditLogsTable,
} from "@workspace/db";
import {
  AdminListUsersQueryParams,
  AdminBlockUserParams,
  AdminBlockUserBody,
  AdminListJobsQueryParams,
  AdminFlagJobParams,
  AdminFlagJobBody,
} from "@workspace/api-zod";
import { z } from "zod";

const AdminVerifyUserParams = z.object({ id: z.coerce.number().int() });
const AdminVerifyUserBody = z.object({
  isVerified: z.boolean().optional(),
  isTopRated: z.boolean().optional(),
  verificationStatus: z.enum(["none", "pending", "approved", "rejected"]).optional(),
});

const router = Router();
const paymentClientProfile = alias(profilesTable, "admin_payment_client");
const paymentFreelancerProfile = alias(profilesTable, "admin_payment_freelancer");

async function requireAdmin(userId: string) {
  if (!(await isAdminUser(userId))) return null;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  if (!profile) return null;
  return { ...profile, role: "admin" };
}

async function requireModeratorOrAdmin(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  if (!profile) return null;
  if (await isAdminUser(userId)) return { ...profile, role: "admin" };
  return profile.role === "moderator" ? profile : null;
}

async function insertAuditLog(params: {
  adminId: number;
  adminName: string;
  action: string;
  entityType: string;
  entityId: number;
  entityName?: string | null;
  details?: string;
}) {
  await db.insert(auditLogsTable).values(params).catch(() => {});
}

// GET /admin/users
router.get("/admin/users", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const moderator = await requireModeratorOrAdmin(userId);
  if (!moderator) {
    res.status(403).json({ error: "Moderator access required" });
    return;
  }

  const parsed = AdminListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { role, search, limit = 50, offset = 0 } = parsed.data;
  const conditions = [];
  if (role === "admin") conditions.push(eq(profilesTable.userId, userId));
  else if (role) conditions.push(eq(profilesTable.role, role));
  if (search) {
    conditions.push(ilike(profilesTable.name, `%${search}%`));
  }

  const users = await db
    .select()
    .from(profilesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(Number(limit))
    .offset(Number(offset))
    .orderBy(desc(profilesTable.createdAt));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(profilesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({
    users: users.map((user) => ({
      ...user,
      role: user.userId === userId ? moderator.role : user.role === "admin" ? "freelancer" : user.role,
    })),
    total: Number(count),
  });
});

// PATCH /admin/users/:id/block
router.patch("/admin/users/:id/block", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const moderator = await requireModeratorOrAdmin(userId);
  if (!moderator) {
    res.status(403).json({ error: "Moderator access required" });
    return;
  }

  const params = AdminBlockUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminBlockUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [target] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, params.data.id));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const actorIsAdmin = await isAdminUser(userId);
  const targetIsAdmin = await isAdminUser(target.userId);
  if (target.userId === userId || (!actorIsAdmin && (target.role === "moderator" || targetIsAdmin))) {
    res.status(403).json({ error: "You cannot block this user" });
    return;
  }

  const [updated] = await db
    .update(profilesTable)
    .set({ isBlocked: parsed.data.isBlocked })
    .where(eq(profilesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const action = parsed.data.isBlocked ? "block_user" : "unblock_user";
  await insertAuditLog({
    adminId: moderator.id,
    adminName: moderator.name,
    action,
    entityType: "user",
    entityId: updated.id,
    entityName: updated.name,
    details: `${parsed.data.isBlocked ? "Blocked" : "Unblocked"} user "${updated.name}" (${updated.role})`,
  });

  res.json(updated);
});

// PATCH /admin/users/:id/verify
router.patch("/admin/users/:id/verify", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const moderator = await requireModeratorOrAdmin(userId);
  if (!moderator) { res.status(403).json({ error: "Moderator access required" }); return; }

  const params = AdminVerifyUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AdminVerifyUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [target] = await db.select().from(profilesTable).where(eq(profilesTable.id, params.data.id));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  const actorIsAdmin = await isAdminUser(userId);
  if (!actorIsAdmin && (target.role !== "freelancer" || parsed.data.isTopRated !== undefined)) {
    res.status(403).json({ error: "Moderators can only verify freelancers" });
    return;
  }

  const updateData: Record<string, boolean | string> = {};
  if (parsed.data.isVerified !== undefined) updateData.isVerified = parsed.data.isVerified;
  if (parsed.data.isTopRated !== undefined) updateData.isTopRated = parsed.data.isTopRated;
  if (parsed.data.verificationStatus !== undefined) updateData.verificationStatus = parsed.data.verificationStatus;

  const [updated] = await db
    .update(profilesTable)
    .set(updateData)
    .where(eq(profilesTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  // Determine action type for audit + notification
  if (parsed.data.verificationStatus === "approved" || parsed.data.isVerified === true) {
    await insertAuditLog({
      adminId: moderator.id,
      adminName: moderator.name,
      action: "verify_user",
      entityType: "user",
      entityId: updated.id,
      entityName: updated.name,
      details: `Approved identity verification for "${updated.name}"`,
    });
    // Notify the freelancer
    await db.insert(notificationsTable).values({
      userId: updated.id,
      type: "id_verified",
      title: "Identity verified!",
      body: "Your identity has been verified by our team. A verified badge will now appear on your profile — this helps you stand out to clients.",
      relatedId: updated.id,
      relatedType: "profile",
    });
  } else if (parsed.data.verificationStatus === "rejected" || parsed.data.isVerified === false) {
    await insertAuditLog({
      adminId: moderator.id,
      adminName: moderator.name,
      action: "reject_verification",
      entityType: "user",
      entityId: updated.id,
      entityName: updated.name,
      details: `Rejected identity verification for "${updated.name}"`,
    });
    // Notify the freelancer
    await db.insert(notificationsTable).values({
      userId: updated.id,
      type: "id_rejected",
      title: "Identity verification not approved",
      body: "Your identity document could not be verified. Please upload a clearer photo of your Ghana Card, Voter's ID, or ECOWAS card in your profile settings.",
      relatedId: updated.id,
      relatedType: "profile",
    });
  } else if (parsed.data.isTopRated !== undefined) {
    const action = parsed.data.isTopRated ? "top_rate_user" : "remove_top_rated";
    await insertAuditLog({
      adminId: moderator.id,
      adminName: moderator.name,
      action,
      entityType: "user",
      entityId: updated.id,
      entityName: updated.name,
      details: `${parsed.data.isTopRated ? "Granted" : "Removed"} Top Rated status for "${updated.name}"`,
    });
    if (parsed.data.isTopRated) {
      await db.insert(notificationsTable).values({
        userId: updated.id,
        type: "top_rated",
        title: "You're now Top Rated!",
        body: "Congratulations! Our team has granted you Top Rated status. This badge boosts your visibility and signals your excellence to clients.",
        relatedId: updated.id,
        relatedType: "profile",
      });
    }
  }

  res.json(updated);
});

// PATCH /admin/users/:id/role
router.patch("/admin/users/:id/role", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = await requireAdmin(userId);
  if (!admin) { res.status(403).json({ error: "Admin access required" }); return; }

  const params = z.object({ id: z.coerce.number().int() }).safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = z.object({ role: z.enum(["freelancer", "client", "moderator"]) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (params.data.id === admin.id) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }

  const [updated] = await db
    .update(profilesTable)
    .set({ role: parsed.data.role, updatedAt: new Date() })
    .where(eq(profilesTable.id, params.data.id))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }

  await insertAuditLog({
    adminId: admin.id,
    adminName: admin.name,
    action: "change_role",
    entityType: "user",
    entityId: updated.id,
    entityName: updated.name,
    details: `Changed role of "${updated.name}" to "${parsed.data.role}"`,
  });

  res.json(updated);
});

// GET /admin/onboarding-issues
router.get("/admin/onboarding-issues", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!(await requireModeratorOrAdmin(userId))) { res.status(403).json({ error: "Moderator access required" }); return; }

  const profiles = await db.select({
    id: profilesTable.id,
    name: profilesTable.name,
    role: profilesTable.role,
    category: profilesTable.category,
    bio: profilesTable.bio,
    skills: profilesTable.skills,
    location: profilesTable.location,
    createdAt: profilesTable.createdAt,
  }).from(profilesTable).where(or(
    and(eq(profilesTable.role, "freelancer"), or(
      isNull(profilesTable.category),
      eq(profilesTable.category, ""),
      isNull(profilesTable.bio),
      eq(profilesTable.bio, ""),
      sql`coalesce(cardinality(${profilesTable.skills}), 0) = 0`,
    )),
    and(eq(profilesTable.role, "client"), or(isNull(profilesTable.bio), eq(profilesTable.bio, ""))),
  )).orderBy(desc(profilesTable.createdAt)).limit(100);

  res.json({ issues: profiles.map((profile) => ({
    ...profile,
    missingFields: [
      ...(!profile.bio?.trim() ? ["bio"] : []),
      ...(profile.role === "freelancer" && !profile.category ? ["category"] : []),
      ...(profile.role === "freelancer" && profile.skills.length === 0 ? ["skills"] : []),
    ],
  })) });
});

// GET /admin/failed-payments
router.get("/admin/failed-payments", async (req, res): Promise<void> => {
  const userId = getAuth(req)?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (!(await requireModeratorOrAdmin(userId))) { res.status(403).json({ error: "Moderator access required" }); return; }

  const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
  const payments = await db.select({
    id: paymentsTable.id,
    jobId: paymentsTable.jobId,
    amount: paymentsTable.amount,
    status: paymentsTable.status,
    paystackReference: paymentsTable.paystackReference,
    createdAt: paymentsTable.createdAt,
    jobTitle: jobsTable.title,
    clientName: paymentClientProfile.name,
    freelancerName: paymentFreelancerProfile.name,
  }).from(paymentsTable)
    .leftJoin(jobsTable, eq(paymentsTable.jobId, jobsTable.id))
    .leftJoin(paymentClientProfile, eq(paymentsTable.clientId, paymentClientProfile.id))
    .leftJoin(paymentFreelancerProfile, eq(paymentsTable.freelancerId, paymentFreelancerProfile.id))
    .where(or(
      eq(paymentsTable.status, "failed"),
      and(eq(paymentsTable.status, "pending"), lt(paymentsTable.createdAt, staleBefore)),
    ))
    .orderBy(desc(paymentsTable.createdAt))
    .limit(100);
  res.json({ payments });
});

// GET /admin/jobs
router.get("/admin/jobs", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const moderator = await requireModeratorOrAdmin(userId);
  if (!moderator) {
    res.status(403).json({ error: "Moderator access required" });
    return;
  }

  const parsed = AdminListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, flagged, limit = 50, offset = 0 } = parsed.data;
  const conditions = [];
  if (status) conditions.push(eq(jobsTable.status, status));
  if (flagged === true) conditions.push(eq(jobsTable.isFlagged, true));

  const jobs = await db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(Number(limit))
    .offset(Number(offset))
    .orderBy(desc(jobsTable.createdAt));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({ jobs, total: Number(count) });
});

// PATCH /admin/jobs/:id/flag
router.patch("/admin/jobs/:id/flag", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const moderator = await requireModeratorOrAdmin(userId);
  if (!moderator) {
    res.status(403).json({ error: "Moderator access required" });
    return;
  }

  const params = AdminFlagJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AdminFlagJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(jobsTable)
    .set({ isFlagged: parsed.data.isFlagged })
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const action = parsed.data.isFlagged ? "flag_job" : "unflag_job";
  await insertAuditLog({
    adminId: moderator.id,
    adminName: moderator.name,
    action,
    entityType: "job",
    entityId: updated.id,
    entityName: updated.title,
    details: `${parsed.data.isFlagged ? "Flagged" : "Unflagged"} job "${updated.title}"`,
  });

  // Notify the client if their job was flagged
  if (parsed.data.isFlagged) {
    await db.insert(notificationsTable).values({
      userId: updated.clientId,
      type: "job_flagged",
      title: "Your job posting was flagged",
      body: `Your job "${updated.title}" has been flagged for review by our moderation team. Please ensure it complies with our community guidelines.`,
      relatedId: updated.id,
      relatedType: "job",
    });
  }

  res.json({ ...updated, clientName: null, clientAvatarUrl: null });
});

// GET /admin/stats
router.get("/admin/stats", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const admin = await requireAdmin(userId);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(profilesTable);
  const [totalFreelancers] = await db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.role, "freelancer"));
  const [totalClients] = await db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.role, "client"));
  const [totalJobs] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable);
  const [totalProposals] = await db.select({ count: sql<number>`count(*)` }).from(proposalsTable);
  const [paymentsRow] = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(paymentsTable).where(eq(paymentsTable.status, "released"));
  const [activeJobs] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable).where(eq(jobsTable.status, "open"));
  const [flaggedJobs] = await db.select({ count: sql<number>`count(*)` }).from(jobsTable).where(eq(jobsTable.isFlagged, true));
  const [blockedUsers] = await db.select({ count: sql<number>`count(*)` }).from(profilesTable).where(eq(profilesTable.isBlocked, true));

  res.json({
    totalUsers: Number(totalUsers.count),
    totalFreelancers: Number(totalFreelancers.count),
    totalClients: Number(totalClients.count),
    totalJobs: Number(totalJobs.count),
    totalProposals: Number(totalProposals.count),
    totalPayments: Number(paymentsRow.total),
    activeJobs: Number(activeJobs.count),
    flaggedJobs: Number(flaggedJobs.count),
    blockedUsers: Number(blockedUsers.count),
  });
});

// GET /admin/audit-logs
router.get("/admin/audit-logs", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const admin = await requireAdmin(userId);
  if (!admin) { res.status(403).json({ error: "Admin access required" }); return; }

  const parsed = z.object({
    action: z.string().optional(),
    entityType: z.string().optional(),
    limit: z.coerce.number().default(50),
    offset: z.coerce.number().default(0),
  }).safeParse(req.query);

  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { action, entityType, limit, offset } = parsed.data;
  const conditions = [];
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(auditLogsTable.createdAt));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({ logs, total: Number(count) });
});

export default router;
