import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db, supportRequestsTable } from "@workspace/db";
import { isAdminUser } from "../lib/adminAccess";

const router = Router();

const createRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  category: z.enum(["account", "profile", "jobs", "payments", "safety", "other"]),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
});

async function requireAdmin(req: any, res: any): Promise<string | null> {
  const userId = getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  if (!(await isAdminUser(userId))) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return userId;
}

router.post("/support/requests", async (req, res): Promise<void> => {
  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Check the contact details and message, then try again." });
    return;
  }

  try {
    const [request] = await db
      .insert(supportRequestsTable)
      .values({ ...parsed.data, userId: getAuth(req)?.userId ?? null })
      .returning({ id: supportRequestsTable.id, status: supportRequestsTable.status });
    res.status(201).json(request);
  } catch (error) {
    req.log.error({ err: error }, "Support request could not be saved");
    res.status(500).json({ error: "Your request could not be sent. Please try again." });
  }
});

router.get("/admin/support-requests", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const status = typeof req.query.status === "string" ? req.query.status : "open";
  if (!["open", "in_progress", "resolved", "all"].includes(status)) {
    res.status(400).json({ error: "Invalid support request status" });
    return;
  }

  const requests = await db
    .select()
    .from(supportRequestsTable)
    .where(status === "all" ? undefined : eq(supportRequestsTable.status, status))
    .orderBy(desc(supportRequestsTable.createdAt))
    .limit(100);
  res.json({ requests });
});

router.patch("/admin/support-requests/:id", async (req, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const params = z.object({ id: z.coerce.number().int().positive() }).safeParse(req.params);
  const body = z.object({ status: z.enum(["open", "in_progress", "resolved"]) }).safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid support request update" });
    return;
  }

  const [request] = await db
    .update(supportRequestsTable)
    .set({ status: body.data.status, updatedAt: new Date() })
    .where(eq(supportRequestsTable.id, params.data.id))
    .returning();
  if (!request) {
    res.status(404).json({ error: "Support request not found" });
    return;
  }
  res.json(request);
});

export default router;