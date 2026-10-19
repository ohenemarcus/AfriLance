import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { getAuth } from "@clerk/express";
import {
  db,
  disputeEvidenceTable,
  disputesTable,
  paymentsTable,
  profilesTable,
} from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { isAdminUser } from "../lib/adminAccess";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const useR2 = objectStorageService.isR2Enabled();
    const useReplitStorage = Boolean(process.env.REPL_ID && process.env.PRIVATE_OBJECT_DIR);

    if (useR2) {
      const localUpload = await objectStorageService.createUpload();
      res.json(
        RequestUploadUrlResponse.parse({
          ...localUpload,
          metadata: { name, size, contentType },
        }),
      );
      return;
    }

    if (!useReplitStorage && process.env.NODE_ENV === "production") {
      res.status(503).json({ error: "Durable file storage is not configured. Set the Cloudflare R2 account, bucket, access key, and secret key on the API service." });
      return;
    }

    if (!useReplitStorage) {
      const localUpload = await objectStorageService.createLocalUpload();
      res.json(RequestUploadUrlResponse.parse({
        ...localUpload,
        metadata: { name, size, contentType },
      }));
      return;
    }

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    const message = error instanceof Error ? error.message : "Failed to generate upload URL";
    const isR2ConfigurationError = message.startsWith("Cloudflare R2 configuration is incomplete");
    res.status(isR2ConfigurationError ? 503 : 500).json({
      error: isR2ConfigurationError
        ? message
        : process.env.REPL_ID && process.env.PRIVATE_OBJECT_DIR
          ? "Replit object storage could not generate an upload URL"
          : "Upload service could not generate an upload URL. Check the API service logs.",
    });
  }
});

router.put("/storage/r2-uploads/:objectId", async (req: Request, res: Response) => {
  const objectId = req.params.objectId;
  if (!objectStorageService.isR2Enabled()) {
    res.status(503).json({ error: "Cloudflare R2 is not configured" });
    return;
  }
  if (!objectId || Array.isArray(objectId) || !/^[0-9a-f-]{36}$/i.test(objectId)) {
    res.status(400).json({ error: "Invalid upload ID" });
    return;
  }

  const contentType = req.header("content-type") || "application/octet-stream";
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 10 * 1024 * 1024) {
      res.status(413).json({ error: "File must be no larger than 10MB" });
      return;
    }
    chunks.push(buffer);
  }
  const data = Buffer.concat(chunks);
  if (data.length === 0) {
    res.status(400).json({ error: "File cannot be empty" });
    return;
  }

  try {
    await objectStorageService.saveUpload(objectId, data, contentType);
    res.status(200).json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, "Failed to store upload in Cloudflare R2");
    res.status(502).json({ error: "File storage is temporarily unavailable" });
  }
});

router.get("/storage/r2-objects/:objectId", async (req: Request, res: Response) => {
  const objectId = req.params.objectId;
  if (!objectId || Array.isArray(objectId) || !/^[0-9a-f-]{36}$/i.test(objectId)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    const objectPath = `/api/storage/r2-objects/${objectId}`;
    const [owner] = await db.select({ userId: profilesTable.userId, role: profilesTable.role, avatarUrl: profilesTable.avatarUrl, resumeUrl: profilesTable.resumeUrl, verificationDocUrl: profilesTable.verificationDocUrl })
      .from(profilesTable)
      .where(or(eq(profilesTable.avatarUrl, objectPath), eq(profilesTable.verificationDocUrl, objectPath), eq(profilesTable.resumeUrl, objectPath)));
    const [evidence] = await db.select({ disputeId: disputeEvidenceTable.disputeId })
      .from(disputeEvidenceTable)
      .where(eq(disputeEvidenceTable.objectPath, objectPath));
    if (!owner && !evidence) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    if (owner?.verificationDocUrl === objectPath || evidence) {
      const userId = getAuth(req)?.userId;
      const [viewer] = userId
        ? await db.select({ id: profilesTable.id, role: profilesTable.role }).from(profilesTable).where(eq(profilesTable.userId, userId))
        : [];
      const isOwner = userId === owner?.userId;
      const isModerator = viewer?.role === "moderator";
      const isAdmin = userId ? await isAdminUser(userId) : false;
      let isDisputeParticipant = false;
      if (evidence && viewer) {
        const [dispute] = await db.select({ paymentId: disputesTable.paymentId })
          .from(disputesTable)
          .where(eq(disputesTable.id, evidence.disputeId));
        const [payment] = dispute
          ? await db.select({ clientId: paymentsTable.clientId, freelancerId: paymentsTable.freelancerId })
            .from(paymentsTable)
            .where(eq(paymentsTable.id, dispute.paymentId))
          : [];
        isDisputeParticipant = payment?.clientId === viewer.id || payment?.freelancerId === viewer.id;
      }
      if (!isOwner && !isModerator && !isAdmin && !isDisputeParticipant) {
        res.status(404).json({ error: "File not found" });
        return;
      }
    }

    const object = await objectStorageService.readR2Upload(objectId);
    if (!object) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.setHeader("Content-Type", object.contentType);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", owner?.verificationDocUrl === objectPath || evidence ? "private, no-store" : "public, max-age=3600");
    res.send(object.data);
  } catch (error) {
    req.log.error({ err: error }, "Failed to read file from Cloudflare R2");
    res.status(502).json({ error: "File storage is temporarily unavailable" });
  }
});

router.put("/storage/local-uploads/:objectId", async (req: Request, res: Response) => {
  const objectId = req.params.objectId;
  if (!objectId || Array.isArray(objectId) || !/^[0-9a-f-]{36}$/i.test(objectId)) {
    res.status(400).json({ error: "Invalid upload ID" });
    return;
  }

  const contentType = req.header("content-type") || "application/octet-stream";
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const data = Buffer.concat(chunks);

  if (data.length === 0 || data.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: "File must be between 1 byte and 10MB" });
    return;
  }

  await objectStorageService.saveLocalUpload(objectId, data, contentType);
  res.status(200).json({ ok: true });
});

router.get("/storage/local-objects/:objectId", async (req: Request, res: Response) => {
  const objectId = req.params.objectId;
  if (!objectId || Array.isArray(objectId) || !/^[0-9a-f-]{36}$/i.test(objectId)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const object = await objectStorageService.readLocalUpload(objectId);
  if (!object) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.setHeader("Content-Type", object.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(object.data);
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
