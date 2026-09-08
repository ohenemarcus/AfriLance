import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, notificationsTable, profilesTable } from "@workspace/db";
import {
  MarkNotificationReadParams,
  ListNotificationsQueryParams,
} from "@workspace/api-zod";

const router = Router();

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

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

// GET /notifications
router.get("/notifications", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const profile = await requireProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const parsed = ListNotificationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [eq(notificationsTable.userId, profile.id)];
  if (parsed.data.unreadOnly === true) {
    conditions.push(eq(notificationsTable.isRead, false));
  }

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, profile.id), eq(notificationsTable.isRead, false)));

  res.json({ notifications, unreadCount: Number(count) });
});

// PATCH /notifications/:id/read
router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  res.json(updated);
});

// PATCH /notifications/read-all
router.patch("/notifications/read-all", async (req, res): Promise<void> => {
  const userId = resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const profile = await requireProfile(userId);
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, profile.id));

  res.json({ success: true });
});

export default router;
