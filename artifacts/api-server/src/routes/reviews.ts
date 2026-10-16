import { Router } from "express";
import { eq, avg, count, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, reviewsTable, profilesTable } from "@workspace/db";
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

  const [review] = await db
    .insert(reviewsTable)
    .values({ ...parsed.data, reviewerId: profile.id })
    .returning();

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
