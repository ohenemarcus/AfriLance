import { Router } from "express";
import { eq, ilike, and, gte, lte, sql, or, asc, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, jobsTable, profilesTable, proposalsTable } from "@workspace/db";
import { isAdminUser } from "../lib/adminAccess";
import {
  ListJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  UpdateJobParams,
  UpdateJobBody,
  DeleteJobParams,
} from "@workspace/api-zod";

const router = Router();

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

// GET /jobs
router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { category, skill, location, remote, minBudget, maxBudget, status, search, limit = 20, offset = 0, budgetType, sortBy } = parsed.data;

  const conditions = [eq(jobsTable.isFlagged, false)];

  if (category) conditions.push(eq(jobsTable.category, category));
  if (skill) conditions.push(sql`${skill} = ANY(${jobsTable.skills})`);
  if (location) conditions.push(ilike(jobsTable.location, `%${location}%`));
  if (remote !== undefined) conditions.push(eq(jobsTable.remote, remote));
  if (minBudget !== undefined) conditions.push(gte(jobsTable.budgetMin, minBudget));
  if (maxBudget !== undefined) conditions.push(lte(jobsTable.budgetMax, maxBudget));
  if (budgetType) conditions.push(eq(jobsTable.budgetType, budgetType));
  if (status) conditions.push(eq(jobsTable.status, status));
  else conditions.push(eq(jobsTable.status, "open"));

  if (search) {
    conditions.push(
      or(
        ilike(jobsTable.title, `%${search}%`),
        ilike(jobsTable.description, `%${search}%`),
      )!,
    );
  }

  const orderByClause =
    sortBy === "oldest" ? asc(jobsTable.createdAt) :
    sortBy === "budget_asc" ? asc(jobsTable.budgetMin) :
    sortBy === "budget_desc" ? desc(jobsTable.budgetMin) :
    desc(jobsTable.createdAt);

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
    .where(and(...conditions))
    .limit(Number(limit))
    .offset(Number(offset))
    .orderBy(orderByClause);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobsTable)
    .where(and(...conditions));

  res.json({ jobs, total: Number(count) });
});

// POST /jobs
router.post("/jobs", async (req, res): Promise<void> => {
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
  const isAdmin = await isAdminUser(userId);
  if (profile.role !== "client" && !isAdmin) {
    res.status(403).json({ error: "Only clients can post jobs" });
    return;
  }

  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .insert(jobsTable)
    .values({
      ...parsed.data,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      clientId: profile.id,
    })
    .returning();

  res.status(201).json({ ...job, clientName: profile.name, clientAvatarUrl: profile.avatarUrl });
});

// GET /jobs/my
router.get("/jobs/my", async (req, res): Promise<void> => {
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
    .where(eq(jobsTable.clientId, profile.id))
    .orderBy(jobsTable.createdAt);

  res.json({ jobs, total: jobs.length });
});

// GET /jobs/:id
router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
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
    .where(eq(jobsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(row);
});

// PATCH /jobs/:id
router.patch("/jobs/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = await requireProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const isAdmin = await isAdminUser(userId);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, params.data.id))
      .for("update");

    if (!existing) return { error: "not_found" as const };
    if (existing.clientId !== profile.id && !isAdmin) return { error: "forbidden" as const };

    const isContentUpdate = Object.keys(parsed.data).some((key) => key !== "status");
    if (isContentUpdate) {
      const [proposal] = await tx
        .select({ id: proposalsTable.id })
        .from(proposalsTable)
        .where(eq(proposalsTable.jobId, existing.id))
        .limit(1);
      if (proposal) return { error: "has_proposals" as const };
    }

    if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
      if (parsed.data.status !== "closed" || existing.status !== "open") {
        return { error: "invalid_status" as const };
      }
      const [acceptedProposal] = await tx
        .select({ id: proposalsTable.id })
        .from(proposalsTable)
        .where(and(
          eq(proposalsTable.jobId, existing.id),
          eq(proposalsTable.status, "accepted"),
        ))
        .limit(1);
      if (acceptedProposal) return { error: "accepted_proposal" as const };
    }

    const { deadline, ...jobFields } = parsed.data;
    const updateValues: Partial<typeof jobsTable.$inferInsert> = {
      ...jobFields,
      updatedAt: new Date(),
    };
    if (deadline !== undefined) {
      updateValues.deadline = deadline ? new Date(deadline) : null;
    }

    const [job] = await tx
      .update(jobsTable)
      .set(updateValues)
      .where(eq(jobsTable.id, params.data.id))
      .returning();

    return { job };
  });

  if ("error" in result) {
    if (result.error === "not_found") {
      res.status(404).json({ error: "Job not found" });
    } else if (result.error === "forbidden") {
      res.status(403).json({ error: "Forbidden" });
    } else if (result.error === "has_proposals") {
      res.status(409).json({ error: "Jobs cannot be edited after a freelancer submits a proposal" });
    } else if (result.error === "accepted_proposal") {
      res.status(409).json({ error: "A job with an accepted freelancer cannot be closed as a listing" });
    } else {
      res.status(409).json({ error: "Project status is controlled by the hiring and payment workflow" });
    }
    return;
  }

  res.json({ ...result.job, clientName: profile.name, clientAvatarUrl: profile.avatarUrl });
});

// DELETE /jobs/:id
router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const profile = await requireProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const isAdmin = await isAdminUser(userId);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, params.data.id))
      .for("update");

    if (!existing) return { error: "not_found" as const };
    if (existing.clientId !== profile.id && !isAdmin) return { error: "forbidden" as const };

    const [proposal] = await tx
      .select({ id: proposalsTable.id })
      .from(proposalsTable)
      .where(eq(proposalsTable.jobId, existing.id))
      .limit(1);
    if (proposal) return { error: "has_proposals" as const };

    await tx.delete(jobsTable).where(eq(jobsTable.id, existing.id));
    return { deleted: true as const };
  });

  if ("error" in result) {
    if (result.error === "not_found") {
      res.status(404).json({ error: "Job not found" });
    } else if (result.error === "forbidden") {
      res.status(403).json({ error: "Forbidden" });
    } else {
      res.status(409).json({ error: "Jobs cannot be deleted after a freelancer submits a proposal" });
    }
    return;
  }

  res.sendStatus(204);
});

export default router;
