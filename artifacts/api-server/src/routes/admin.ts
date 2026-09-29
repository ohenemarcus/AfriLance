import { Router } from "express";
import { eq, ilike, and, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
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

async function requireAdmin(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  if (!profile || profile.role !== "admin") return null;
  return profile;
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
  const admin = await requireAdmin(userId);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const parsed = AdminListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { role, search, limit = 50, offset = 0 } = parsed.data;
  const conditions = [];
  if (role) conditions.push(eq(profilesTable.role, role));
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

  res.json({ users, total: Number(count) });
});

// PATCH /admin/users/:id/block
router.patch("/admin/users/:id/block", async (req, res): Promise<void> => {
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
    adminId: admin.id,
    adminName: admin.name,
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
  const admin = await requireAdmin(userId);
  if (!admin) { res.status(403).json({ error: "Admin access required" }); return; }

  const params = AdminVerifyUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AdminVerifyUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

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
      adminId: admin.id,
      adminName: admin.name,
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
      adminId: admin.id,
      adminName: admin.name,
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
      adminId: admin.id,
      adminName: admin.name,
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

  const parsed = z.object({ role: z.enum(["freelancer", "client", "admin"]) }).safeParse(req.body);
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

// GET /admin/jobs
router.get("/admin/jobs", async (req, res): Promise<void> => {
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
  const admin = await requireAdmin(userId);
  if (!admin) {
    res.status(403).json({ error: "Admin access required" });
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
    adminId: admin.id,
    adminName: admin.name,
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
