import { Router } from "express";
import { eq, ilike, and, gte, lte, sql, or } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, profilesTable } from "@workspace/db";
import {
  UpsertMyProfileBody,
  ListFreelancersQueryParams,
  GetProfileParams,
} from "@workspace/api-zod";

const router = Router();

// Middleware to get or create a profile for the current user
async function getMyProfileId(userId: string): Promise<number | null> {
  const [profile] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile?.id ?? null;
}

function resolveUserId(req: any): string | null {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (userId) return userId;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token.startsWith("user_") || token.startsWith("org_") || token.startsWith("client_")) {
      return token;
    }
  }

  return null;
}

// GET /profiles/me
router.get("/profiles/me", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  req.log.info({ userId }, "profiles.me request");
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [profile] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId));

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "profiles.me request failed");
    res.status(500).json({ error: "Failed to load profile" });
  }
});

// PUT /profiles/me
router.put("/profiles/me", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  req.log.info({ userId }, "profiles.me save request");
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpsertMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const existing = await db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(profilesTable);
    const isFirstProfile = Number(count ?? 0) === 0;
    const role = isFirstProfile ? "admin" : parsed.data.role;

    let profile;
    if (existing.length > 0) {
      [profile] = await db
        .update(profilesTable)
        .set({ ...parsed.data, role, updatedAt: new Date() })
        .where(eq(profilesTable.userId, userId))
        .returning();
    } else {
      [profile] = await db
        .insert(profilesTable)
        .values({ userId, ...parsed.data, role })
        .returning();
    }

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "profiles.me save request failed");
    res.status(500).json({ error: "Failed to save profile" });
  }
});

// GET /profiles/freelancers
router.get("/profiles/freelancers", async (req, res): Promise<void> => {
  const parsed = ListFreelancersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { skill, location, minRate, maxRate, search, featured, limit = 20, offset = 0 } = parsed.data;

  const conditions = [eq(profilesTable.role, "freelancer"), eq(profilesTable.isBlocked, false)];

  if (skill) {
    conditions.push(sql`${skill} = ANY(${profilesTable.skills})`);
  }
  if (location) {
    conditions.push(ilike(profilesTable.location, `%${location}%`));
  }
  if (minRate !== undefined) {
    conditions.push(gte(profilesTable.hourlyRate, minRate));
  }
  if (maxRate !== undefined) {
    conditions.push(lte(profilesTable.hourlyRate, maxRate));
  }
  if (search) {
    conditions.push(
      or(
        ilike(profilesTable.name, `%${search}%`),
        ilike(profilesTable.bio, `%${search}%`),
      )!,
    );
  }
  if (featured === true) {
    conditions.push(eq(profilesTable.featured, true));
  }

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

// GET /profiles/:id
router.get("/profiles/:id", async (req, res): Promise<void> => {
  const params = GetProfileParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, params.data.id));

  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json(profile);
});

export { getMyProfileId };
export default router;
