import { Router } from "express";
import { eq, and, or, sql, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, conversationsTable, messagesTable, profilesTable, notificationsTable } from "@workspace/db";
import {
  GetConversationMessagesParams,
  GetConversationMessagesQueryParams,
  SendMessageBody,
} from "@workspace/api-zod";

const router = Router();

async function requireProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  return profile;
}

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
    })
    .returning();

  // Update last message on conversation
  await db
    .update(conversationsTable)
    .set({ lastMessage: parsed.data.content, lastMessageAt: new Date() })
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
      body: `${profile.name} sent you a message: "${parsed.data.content.slice(0, 80)}${parsed.data.content.length > 80 ? "…" : ""}"`,
      relatedId: conversation.id,
      relatedType: "conversation",
    });
  }

  res.status(201).json(message);
});

export default router;
