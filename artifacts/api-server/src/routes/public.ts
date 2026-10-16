import { Router } from "express";
import { eq, ilike, and, gte, lte, sql, or, asc, desc } from "drizzle-orm";
import { db, profilesTable, jobsTable } from "@workspace/db";
import { ListFreelancersQueryParams, ListJobsQueryParams, GetJobParams, GetProfileParams } from "@workspace/api-zod";

const router = Router();

// GET /profiles/freelancers — public
router.get("/profiles/freelancers", async (req, res): Promise<void> => {
  const parsed = ListFreelancersQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { category, skill, location, minRate, maxRate, minFixedRate, maxFixedRate, search, featured, limit = 20, offset = 0 } = parsed.data;
  const conditions = [eq(profilesTable.role, "freelancer"), eq(profilesTable.isBlocked, false)];

  if (category) conditions.push(ilike(profilesTable.category, category));
  if (skill) conditions.push(sql`${skill} = ANY(${profilesTable.skills})`);
  if (location) conditions.push(ilike(profilesTable.location, `%${location}%`));
  if (minRate !== undefined) conditions.push(gte(profilesTable.hourlyRate, minRate));
  if (maxRate !== undefined) conditions.push(lte(profilesTable.hourlyRate, maxRate));
  if (minFixedRate !== undefined) conditions.push(gte(profilesTable.fixedRate, minFixedRate));
  if (maxFixedRate !== undefined) conditions.push(lte(profilesTable.fixedRate, maxFixedRate));
  if (search) conditions.push(or(ilike(profilesTable.name, `%${search}%`), ilike(profilesTable.bio, `%${search}%`))!);
  if (featured === true) conditions.push(eq(profilesTable.featured, true));

  const freelancers = await db
    .select()
    .from(profilesTable)
    .where(and(...conditions))
    .limit(Number(limit))
    .offset(Number(offset))
    .orderBy(profilesTable.featured, profilesTable.avgRating);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(profilesTable)
    .where(and(...conditions));

  res.json({ freelancers, total: Number(count) });
});

// GET /profiles/me should be handled by the protected route in the main router.
// Calling next("router") skips the rest of this public router and lets the parent
// /api router handle the request instead.
router.get("/profiles/me", (_req, _res, next) => next("router"));

// GET /profiles/:id — public
router.get("/profiles/:id", async (req, res): Promise<void> => {
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, params.data.id));

  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json(profile);
});

// GET /jobs — public
router.get("/jobs", async (req, res): Promise<void> => {
  const parsed = ListJobsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

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
  if (search) conditions.push(or(ilike(jobsTable.title, `%${search}%`), ilike(jobsTable.description, `%${search}%`))!);

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

// GET /jobs/:id — public
router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

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

  if (!row) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(row);
});

export default router;