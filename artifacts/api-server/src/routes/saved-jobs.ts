import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, profilesTable, savedJobsTable, jobsTable } from "@workspace/db";
import { z } from "zod";

const router = Router();

const SaveJobBody = z.object({ jobId: z.number().int() });
const UnsaveJobParams = z.object({ jobId: z.coerce.number().int() });

// GET /saved-jobs
router.get("/saved-jobs", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [profile] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.userId, userId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const rows = await db
    .select({
      id: savedJobsTable.id,
      profileId: savedJobsTable.profileId,
      jobId: savedJobsTable.jobId,
      createdAt: savedJobsTable.createdAt,
      job: {
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
      },
    })
    .from(savedJobsTable)
    .leftJoin(jobsTable, eq(savedJobsTable.jobId, jobsTable.id))
    .where(eq(savedJobsTable.profileId, profile.id))
    .orderBy(savedJobsTable.createdAt);

  res.json({ savedJobs: rows, total: rows.length });
});

// POST /saved-jobs
router.post("/saved-jobs", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = SaveJobBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [profile] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.userId, userId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  const [saved] = await db
    .insert(savedJobsTable)
    .values({ profileId: profile.id, jobId: parsed.data.jobId })
    .onConflictDoNothing()
    .returning();

  res.status(201).json(saved ?? { profileId: profile.id, jobId: parsed.data.jobId });
});

// DELETE /saved-jobs/:jobId
router.delete("/saved-jobs/:jobId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const params = UnsaveJobParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [profile] = await db.select({ id: profilesTable.id }).from(profilesTable).where(eq(profilesTable.userId, userId));
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  await db.delete(savedJobsTable).where(and(eq(savedJobsTable.profileId, profile.id), eq(savedJobsTable.jobId, params.data.jobId)));
  res.status(204).send();
});

export default router;
