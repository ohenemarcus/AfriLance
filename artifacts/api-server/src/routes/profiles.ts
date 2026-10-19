import { Router } from "express";
import { eq, ilike, and, gte, lte, sql, or, isNull } from "drizzle-orm";
import { clerkClient, getAuth } from "@clerk/express";
import { db, profilesTable, auditLogsTable } from "@workspace/db";
import { isAdminUser } from "../lib/adminAccess";
import { withoutPrivateNameFields } from "../lib/profilePrivacy";
import {
  UpsertMyProfileBody,
  ListFreelancersQueryParams,
  GetProfileParams,
} from "@workspace/api-zod";

const router = Router();
const PUBLIC_NAME_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

async function registrationNameFor(userId: string, fallbackName: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  return user.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    fallbackName;
}

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

    const legalName = profile.legalName ?? await registrationNameFor(userId, profile.name);
    if (!profile.legalName) {
      await db.update(profilesTable)
        .set({ legalName })
        .where(eq(profilesTable.userId, userId));
    }

    const isAdmin = await isAdminUser(userId);
    res.json({
      ...profile,
      legalName,
      role: isAdmin ? "admin" : profile.role === "admin" ? "freelancer" : profile.role,
    });
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
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId));

    const isAdmin = await isAdminUser(userId);
    const role = isAdmin
      ? "admin"
      : existing[0]?.role === "moderator"
        ? "moderator"
        : parsed.data.role === "client" || parsed.data.role === "freelancer"
          ? parsed.data.role
          : "freelancer";

    const requestedName = parsed.data.name.trim();
    if (requestedName.length < 2 || requestedName.length > 120) {
      res.status(400).json({ error: "Public profile name must be between 2 and 120 characters" });
      return;
    }

    const now = new Date();
    const previousProfile = existing[0];
    const publicNameChanged = !!previousProfile && requestedName !== previousProfile.name;
    if (publicNameChanged && previousProfile.nameChangedAt) {
      const nextChangeAt = new Date(previousProfile.nameChangedAt.getTime() + PUBLIC_NAME_COOLDOWN_MS);
      if (now < nextChangeAt) {
        res.status(429).json({
          error: `Your public name can next be changed on ${nextChangeAt.toISOString().slice(0, 10)}.`,
          nameChangeAllowedAt: nextChangeAt.toISOString(),
        });
        return;
      }
    }

    const legalName = previousProfile?.legalName ?? await registrationNameFor(userId, requestedName);
    let profile;
    if (previousProfile) {
      profile = await db.transaction(async (tx) => {
        const [updated] = await tx.update(profilesTable)
          .set({
            ...parsed.data,
            name: requestedName,
            legalName,
            role,
            ...(publicNameChanged ? { nameChangedAt: now } : {}),
            updatedAt: now,
          })
          .where(and(
            eq(profilesTable.userId, userId),
            eq(profilesTable.name, previousProfile.name),
            ...(publicNameChanged
              ? [or(isNull(profilesTable.nameChangedAt), lte(profilesTable.nameChangedAt, new Date(now.getTime() - PUBLIC_NAME_COOLDOWN_MS)))!]
              : []),
          ))
          .returning();
        if (!updated) return null;

        if (publicNameChanged) {
          await tx.insert(auditLogsTable).values({
            adminId: previousProfile.id,
            adminName: previousProfile.name,
            action: "public_name_changed",
            entityType: "profile",
            entityId: previousProfile.id,
            entityName: requestedName,
            details: `Public profile name changed from "${previousProfile.name}" to "${requestedName}".`,
          });
        }
        return updated;
      });
      if (!profile) {
        res.status(409).json({ error: "Your profile changed while saving. Refresh and try again." });
        return;
      }
    } else {
      [profile] = await db
        .insert(profilesTable)
        .values({ userId, ...parsed.data, name: requestedName, legalName, role })
        .returning();
    }

    res.json({ ...profile, legalName: profile.legalName ?? legalName });
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

  res.json({ freelancers: freelancers.map(withoutPrivateNameFields), total: Number(count) });
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

  res.json(withoutPrivateNameFields(profile));
});

export { getMyProfileId };
export default router;
