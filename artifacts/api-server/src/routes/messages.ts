import { Router } from "express";
import { eq, and, or, sql, desc, ne } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { Readable } from "stream";
import { db, conversationsTable, messagesTable, messageReportsTable, profilesTable, notificationsTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  GetConversationMessagesParams,
  GetConversationMessagesQueryParams,
  SendMessageBody,
} from "@workspace/api-zod";

const router = Router();
const objectStorageService = new ObjectStorageService();
const typingByConversation = new Map<number, Map<number, number>>();
const TYPING_TTL_MS = 5_000;

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

router.get("/messages/:messageId/attachment", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const profile = auth?.userId ? await requireProfile(auth.userId) : null;
  const messageId = Number(req.params.messageId);
  if (!profile || !Number.isInteger(messageId) || messageId <= 0) {
    res.status(profile ? 400 : 401).json({ error: "Invalid attachment request" });
    return;
  }

  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
  if (!message?.attachmentUrl) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, message.conversationId));
  if (!conversation || ![conversation.participantA, conversation.participantB].includes(profile.id)) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  const localId = message.attachmentUrl.match(/^\/api\/storage\/local-objects\/([0-9a-f-]{36})$/i)?.[1];
  if (localId) {
    const object = await objectStorageService.readLocalUpload(localId);
    if (!object) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    res.setHeader("Content-Type", object.contentType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(message.attachmentName ?? "attachment")}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(object.data);
    return;
  }

  if (!message.attachmentUrl.startsWith("/objects/")) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }
  try {
    const file = await objectStorageService.getObjectEntityFile(message.attachmentUrl);
    const response = await objectStorageService.downloadObject(file, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(message.attachmentName ?? "attachment")}`);
    res.setHeader("Cache-Control", "private, no-store");
    if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    else res.end();
  } catch {
    res.status(404).json({ error: "Attachment not found" });
  }
});

// GET /messages/conversations
router.get("/messages/conversations", async (req, res): Promise<void> => {
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

  const convos = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        eq(conversationsTable.participantA, profile.id),
        eq(conversationsTable.participantB, profile.id),
      ),
    )
    .orderBy(desc(conversationsTable.lastMessageAt));

  const enriched = await Promise.all(
    convos.map(async (c) => {
      const otherId =
        c.participantA === profile.id ? c.participantB : c.participantA;
      const [other] = await db
        .select({ name: profilesTable.name, avatarUrl: profilesTable.avatarUrl })
        .from(profilesTable)
        .where(eq(profilesTable.id, otherId));

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, c.id),
            eq(messagesTable.isRead, false),
            sql`${messagesTable.senderId} != ${profile.id}`,
          ),
        );

      return {
        id: c.id,
        otherUserId: otherId,
        otherUserName: other?.name ?? "Unknown",
        otherUserAvatarUrl: other?.avatarUrl ?? null,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        unreadCount: Number(count),
      };
    }),
  );

  res.json({ conversations: enriched });
});

// GET /messages/conversations/:conversationId
router.get("/messages/conversations/:conversationId", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = GetConversationMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const query = GetConversationMessagesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { limit = 50, offset = 0 } = query.data;

  const profile = await requireProfile(userId);
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, params.data.conversationId));
  if (
    !profile ||
    !conversation ||
    (conversation.participantA !== profile.id && conversation.participantB !== profile.id)
  ) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.conversationId, conversation.id),
        ne(messagesTable.senderId, profile.id),
        eq(messagesTable.isRead, false),
      ),
    );

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .limit(Number(limit))
    .offset(Number(offset))
    .orderBy(messagesTable.createdAt);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId));

  res.json({ messages, total: Number(count) });
});

// POST /messages
router.post("/messages", async (req, res): Promise<void> => {
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

  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const hasAttachment = Boolean(parsed.data.attachmentUrl);
  if (
    (!parsed.data.content.trim() && !hasAttachment) ||
    parsed.data.content.length > 5000 ||
    (parsed.data.attachmentUrl && !/^\/(objects\/|api\/storage\/local-objects\/)/.test(parsed.data.attachmentUrl)) ||
    (parsed.data.attachmentName && parsed.data.attachmentName.length > 255) ||
    (parsed.data.attachmentType && parsed.data.attachmentType.length > 120)
  ) {
    res.status(400).json({ error: "Invalid message or attachment" });
    return;
  }

  // Find or create conversation
  let [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        and(
          eq(conversationsTable.participantA, profile.id),
          eq(conversationsTable.participantB, parsed.data.recipientId),
        ),
        and(
          eq(conversationsTable.participantA, parsed.data.recipientId),
          eq(conversationsTable.participantB, profile.id),
        ),
      ),
    );

  const isNewConversation = !conversation;

  if (!conversation) {
    [conversation] = await db
      .insert(conversationsTable)
      .values({
        participantA: profile.id,
        participantB: parsed.data.recipientId,
      })
      .returning();
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      conversationId: conversation.id,
      senderId: profile.id,
      content: parsed.data.content,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
      attachmentName: parsed.data.attachmentName ?? null,
      attachmentType: parsed.data.attachmentType ?? null,
    })
    .returning();

  // Update last message on conversation
  await db
    .update(conversationsTable)
    .set({
      lastMessage: parsed.data.content || `Attachment: ${parsed.data.attachmentName ?? "file"}`,
      lastMessageAt: new Date(),
    })
    .where(eq(conversationsTable.id, conversation.id));

  // Notify recipient of new message
  // Only notify if this is a new conversation OR there are no unread messages already
  // to avoid spamming — one notification per conversation burst
  const [{ unreadCount }] = await db
    .select({ unreadCount: sql<number>`count(*)` })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.conversationId, conversation.id),
        eq(messagesTable.isRead, false),
        sql`${messagesTable.senderId} = ${profile.id}`,
        sql`${messagesTable.id} != ${message.id}`,
      ),
    );

  if (isNewConversation || Number(unreadCount) === 0) {
    await db.insert(notificationsTable).values({
      userId: parsed.data.recipientId,
      type: "new_message",
      title: "New message",
      body: parsed.data.content
        ? `${profile.name} sent you a message: "${parsed.data.content.slice(0, 80)}${parsed.data.content.length > 80 ? "…" : ""}"`
        : `${profile.name} sent you an attachment: ${parsed.data.attachmentName ?? "file"}`,
      relatedId: conversation.id,
      relatedType: "conversation",
    });
  }

  res.status(201).json(message);
});

router.get("/messages/conversations/:conversationId/typing", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const profile = auth?.userId ? await requireProfile(auth.userId) : null;
  const conversationId = Number(req.params.conversationId);
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId));
  if (!profile || !conversation || ![conversation.participantA, conversation.participantB].includes(profile.id)) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const states = typingByConversation.get(conversationId);
  const now = Date.now();
  for (const [profileId, updatedAt] of states ?? []) {
    if (now - updatedAt > TYPING_TTL_MS) states?.delete(profileId);
  }
  res.json({ isTyping: [...(states?.entries() ?? [])].some(([profileId]) => profileId !== profile.id) });
});

router.post("/messages/conversations/:conversationId/typing", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const profile = auth?.userId ? await requireProfile(auth.userId) : null;
  const conversationId = Number(req.params.conversationId);
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId));
  if (!profile || !conversation || ![conversation.participantA, conversation.participantB].includes(profile.id)) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const states = typingByConversation.get(conversationId) ?? new Map<number, number>();
  if (req.body?.isTyping === true) states.set(profile.id, Date.now());
  else states.delete(profile.id);
  if (states.size) typingByConversation.set(conversationId, states);
  else typingByConversation.delete(conversationId);
  res.status(204).end();
});

router.post("/messages/:messageId/reports", async (req, res): Promise<void> => {
  const auth = getAuth(req);
  const profile = auth?.userId ? await requireProfile(auth.userId) : null;
  const messageId = Number(req.params.messageId);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const details = typeof req.body?.details === "string" ? req.body.details.trim() : "";
  if (!profile || !Number.isInteger(messageId) || messageId <= 0 || !reason || reason.length > 120 || details.length > 1000) {
    res.status(profile ? 400 : 401).json({ error: "Invalid report" });
    return;
  }

  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, messageId));
  if (!message) {
    res.status(404).json({ error: "Message not found" });
    return;
  }
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, message.conversationId));
  if (
    !conversation ||
    message.senderId === profile.id ||
    ![conversation.participantA, conversation.participantB].includes(profile.id)
  ) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  await db.insert(messageReportsTable).values({
    messageId,
    reporterId: profile.id,
    reason,
    details: details || null,
  });
  res.status(201).json({ reported: true });
});

export default router;
