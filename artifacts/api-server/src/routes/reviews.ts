import { Router } from "express";
import { eq, avg, count, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, reviewsTable, profilesTable, jobsTable, proposalsTable } from "@workspace/db";
import {
  CreateReviewBody,
  ListProfileReviewsParams,
} from "@workspace/api-zod";

const router = Router();

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

// POST /reviews
router.post("/reviews", async (req, res): Promise<void> => {
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

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (
    !Number.isInteger(parsed.data.jobId) || parsed.data.jobId <= 0 ||
    !Number.isInteger(parsed.data.revieweeId) || parsed.data.revieweeId <= 0 ||
    !Number.isInteger(parsed.data.rating) || parsed.data.rating < 1 || parsed.data.rating > 5
  ) {
    res.status(400).json({ error: "Review requires a valid job, reviewee, and a rating from 1 to 5" });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, parsed.data.jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "completed") {
    res.status(409).json({ error: "Reviews can be submitted after the project is completed and paid out" });
    return;
  }

  const [acceptedProposal] = await db.select().from(proposalsTable).where(and(
    eq(proposalsTable.jobId, job.id),
    eq(proposalsTable.status, "accepted"),
  )).limit(1);
  if (!acceptedProposal) {
    res.status(409).json({ error: "This job has no accepted freelancer to review" });
    return;
  }

  const expectedRevieweeId = profile.id === job.clientId
    ? acceptedProposal.freelancerId
    : profile.id === acceptedProposal.freelancerId
      ? job.clientId
      : null;
  if (expectedRevieweeId === null || parsed.data.revieweeId !== expectedRevieweeId) {
    res.status(403).json({ error: "Only the client and accepted freelancer can review each other for this job" });
    return;
  }

  const [existingReview] = await db.select({ id: reviewsTable.id }).from(reviewsTable).where(and(
    eq(reviewsTable.jobId, job.id),
    eq(reviewsTable.reviewerId, profile.id),
  )).limit(1);
  if (existingReview) {
    res.status(409).json({ error: "You have already reviewed this job" });
    return;
  }

  const [review] = await db
    .insert(reviewsTable)
    .values({ ...parsed.data, reviewerId: profile.id })
    .onConflictDoNothing({ target: [reviewsTable.jobId, reviewsTable.reviewerId] })
    .returning();
  if (!review) {
    res.status(409).json({ error: "You have already reviewed this job" });
    return;
  }

  // Update reviewee avg rating
  const [stats] = await db
    .select({
      avg: avg(reviewsTable.rating),
      count: count(),
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.revieweeId, parsed.data.revieweeId));

  await db
    .update(profilesTable)
    .set({
      avgRating: stats.avg ? Number(stats.avg) : null,
      totalReviews: Number(stats.count),
    })
    .where(eq(profilesTable.id, parsed.data.revieweeId));

  res.status(201).json({
    ...review,
    reviewerName: profile.name,
    reviewerAvatarUrl: profile.avatarUrl,
  });
});

// GET /reviews/profile/:profileId
router.get("/reviews/profile/:profileId", async (req, res): Promise<void> => {
  const params = ListProfileReviewsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select({
      review: reviewsTable,
      reviewer: profilesTable,
    })
    .from(reviewsTable)
    .leftJoin(profilesTable, eq(reviewsTable.reviewerId, profilesTable.id))
    .where(eq(reviewsTable.revieweeId, params.data.profileId))
    .orderBy(reviewsTable.createdAt);

  const [stats] = await db
    .select({ avg: avg(reviewsTable.rating) })
    .from(reviewsTable)
    .where(eq(reviewsTable.revieweeId, params.data.profileId));

  const reviews = rows.map((r) => ({
    ...r.review,
    reviewerName: r.reviewer?.name ?? null,
    reviewerAvatarUrl: r.reviewer?.avatarUrl ?? null,
  }));

  res.json({ reviews, total: reviews.length, avgRating: stats.avg ? Number(stats.avg) : null });
});

export default router;
