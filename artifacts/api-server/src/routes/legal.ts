import { Router, type RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
} from "@workspace/api-zod";
import { db, legalAcceptancesTable } from "@workspace/db";

const router = Router();

function getUserId(req: Parameters<typeof getAuth>[0]): string | null {
  return getAuth(req).userId ?? null;
}

router.get("/legal/acceptance", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [acceptance] = await db
      .select({ acceptedAt: legalAcceptancesTable.acceptedAt })
      .from(legalAcceptancesTable)
      .where(
        and(
          eq(legalAcceptancesTable.userId, userId),
          eq(legalAcceptancesTable.termsVersion, CURRENT_TERMS_VERSION),
          eq(legalAcceptancesTable.privacyVersion, CURRENT_PRIVACY_VERSION),
        ),
      )
      .limit(1);

    res.json({
      accepted: Boolean(acceptance),
      acceptedAt: acceptance?.acceptedAt ?? null,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    });
  } catch (err) {
    req.log.error({ err, userId }, "legal acceptance lookup failed");
    res.status(500).json({ error: "Failed to load legal acceptance status" });
  }
});

router.post("/legal/acceptance", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.body?.accepted !== true) {
    res.status(400).json({ error: "Explicit acceptance is required" });
    return;
  }

  try {
    await db
      .insert(legalAcceptancesTable)
      .values({
        userId,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      })
      .onConflictDoNothing({
        target: [
          legalAcceptancesTable.userId,
          legalAcceptancesTable.termsVersion,
          legalAcceptancesTable.privacyVersion,
        ],
      });

    const [acceptance] = await db
      .select({ acceptedAt: legalAcceptancesTable.acceptedAt })
      .from(legalAcceptancesTable)
      .where(
        and(
          eq(legalAcceptancesTable.userId, userId),
          eq(legalAcceptancesTable.termsVersion, CURRENT_TERMS_VERSION),
          eq(legalAcceptancesTable.privacyVersion, CURRENT_PRIVACY_VERSION),
        ),
      )
      .limit(1);

    if (!acceptance) {
      throw new Error("Acceptance record was not found after saving.");
    }

    res.json({
      accepted: true,
      acceptedAt: acceptance.acceptedAt,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
    });
  } catch (err) {
    req.log.error({ err, userId }, "legal acceptance save failed");
    res.status(500).json({ error: "Failed to save legal acceptance" });
  }
});

export const requireCurrentLegalAcceptance: RequestHandler = async (
  req,
  res,
  next,
) => {
  const userId = getUserId(req);
  if (!userId) {
    next();
    return;
  }

  try {
    const [acceptance] = await db
      .select({ id: legalAcceptancesTable.id })
      .from(legalAcceptancesTable)
      .where(
        and(
          eq(legalAcceptancesTable.userId, userId),
          eq(legalAcceptancesTable.termsVersion, CURRENT_TERMS_VERSION),
          eq(legalAcceptancesTable.privacyVersion, CURRENT_PRIVACY_VERSION),
        ),
      )
      .limit(1);

    if (!acceptance) {
      res.status(403).json({ error: "legal_acceptance_required" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err, userId }, "legal acceptance enforcement failed");
    res.status(500).json({ error: "Failed to verify legal acceptance" });
  }
};

export default router;
