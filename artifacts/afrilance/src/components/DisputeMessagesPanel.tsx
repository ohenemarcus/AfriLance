import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import { formatRelative } from "@/lib/format";
import { useFileUpload } from "@/hooks/useFileUpload";

type DisputeMessage = {
  id: number;
  disputeId: number;
  senderId: number;
  recipientId: number;
  replyToId: number | null;
  content: string;
  createdAt: string;
  senderName: string;
  senderRole: string;
  senderIsModerator: boolean;
  recipientName: string;
  evidence: Array<{ id: number; objectPath: string; fileName: string }>;
};

type Participant = { id: number; name: string };

export function DisputeMessagesPanel({
  disputeId,
  disputeStatus,
  viewerId,
  moderator,
  client,
  freelancer,
}: {
  disputeId: number;
  disputeStatus: string;
  viewerId?: number;
  moderator: boolean;
  client?: Participant | null;
  freelancer?: Participant | null;
}) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipient, setRecipient] = useState<"client" | "freelancer" | "both">("both");
  const [content, setContent] = useState("");
  const [replyContent, setReplyContent] = useState<Record<number, string>>({});
  const [replyFiles, setReplyFiles] = useState<Record<number, File[]>>({});
  const [sending, setSending] = useState(false);
  const { uploadFile } = useFileUpload({ maxSizeMB: 10, accept: ["image/", "application/pdf", "text/"] });

  const loadMessages = useCallback(async (active?: () => boolean) => {
    try {
      const token = await getToken();
      const response = await fetch(`/api/disputes/${disputeId}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load dispute messages");
      if (!active || active()) {
        setMessages(body.messages ?? []);
        setError("");
      }
    } catch (cause) {
      if (!active || active()) setError(cause instanceof Error ? cause.message : "Could not load dispute messages");
    } finally {
      if (!active || active()) setLoading(false);
    }
  }, [disputeId, getToken]);

  useEffect(() => {
    let active = true;
    void loadMessages(() => active);
    const interval = window.setInterval(() => void loadMessages(() => active), 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadMessages]);

  const send = async (body: Record<string, string | number>, url: string) => {
    setSending(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not send dispute message");
      setContent("");
      setReplyContent({});
      setReplyFiles({});
      await loadMessages();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send dispute message");
    } finally {
      setSending(false);
    }
  };

  const sendParticipantReply = async (requestId: number) => {
    const reply = replyContent[requestId]?.trim();
    if (!reply) return;
    setSending(true);
    setError("");
    try {
      const evidence = [];
      for (const file of replyFiles[requestId] ?? []) {
        const objectPath = await uploadFile(file);
        if (!objectPath) throw new Error(`Could not upload ${file.name}. Check the file type and 10MB size limit.`);
        evidence.push({
          objectPath,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        });
      }
      const token = await getToken();
      const response = await fetch(`/api/disputes/${disputeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ replyToId: requestId, content: reply, evidence }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not send dispute response");
      setReplyContent((current) => ({ ...current, [requestId]: "" }));
      setReplyFiles((current) => ({ ...current, [requestId]: [] }));
      await loadMessages();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send dispute response");
    } finally {
      setSending(false);
    }
  };

  const canReply = disputeStatus === "open" || disputeStatus === "under_review";
  const hasReply = (messageId: number) => messages.some((message) => message.replyToId === messageId);
  const unansweredRequests = messages.filter((message) =>
    message.senderIsModerator &&
    message.recipientId === viewerId &&
    !hasReply(message.id),
  );
  const unansweredParticipantMessages = messages.filter((message) =>
    !message.senderIsModerator &&
    message.senderId === viewerId &&
    !hasReply(message.id),
  );

  return (
    <section className="rounded-xl border border-border bg-background/60 p-4 space-y-4">
      <div>
        <h4 className="font-semibold text-sm text-foreground">Dispute messages</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {moderator
            ? "Messages are private to the selected party and the moderation team."
            : "Your messages are private to you and the moderation team."}
        </p>
      </div>

      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading dispute messages…</p>
      ) : messages.length ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.map((message) => (
            <article key={message.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {message.senderIsModerator ? "Moderation team" : message.senderName}
                  {moderator && ` → ${message.recipientName}`}
                </span>
                <time dateTime={message.createdAt}>{formatRelative(message.createdAt)}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-foreground">{message.content}</p>
              {!!message.evidence?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.evidence.map((file) => (
                    <a
                      key={file.id}
                      href={file.objectPath.startsWith("/api/storage/") ? file.objectPath : `/api/storage${file.objectPath}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Evidence: {file.fileName}
                    </a>
                  ))}
                </div>
              )}

              {moderator && canReply && !message.senderIsModerator && message.recipientId === viewerId && !hasReply(message.id) && (
                <form
                  className="mt-3 flex flex-col sm:flex-row gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const reply = replyContent[message.id]?.trim();
                    if (reply) void send({ replyToId: message.id, content: reply }, `/api/admin/disputes/${disputeId}/messages`);
                  }}
                >
                  <input
                    value={replyContent[message.id] ?? ""}
                    onChange={(event) => setReplyContent((current) => ({ ...current, [message.id]: event.target.value }))}
                    maxLength={5000}
                    required
                    aria-label="Reply to participant"
                    placeholder="Reply to this participant"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  />
                  <button disabled={sending} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Reply</button>
                </form>
              )}
              {!moderator && hasReply(message.id) && (
                <p className="mt-2 text-xs text-muted-foreground">Your response has been sent.</p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      )}

      {moderator && canReply && (
        <form
          className="space-y-2 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = content.trim();
            if (trimmed) void send({ recipient, content: trimmed }, `/api/admin/disputes/${disputeId}/messages`);
          }}
        >
          <label className="block text-xs font-medium text-foreground">
            Send to
            <select
              value={recipient}
              onChange={(event) => setRecipient(event.target.value as typeof recipient)}
              className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="both">Both parties</option>
              <option value="client">{client?.name ?? "Client"}</option>
              <option value="freelancer">{freelancer?.name ?? "Freelancer"}</option>
            </select>
          </label>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={5000}
            required
            rows={3}
            placeholder="Request information or provide an update…"
            className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <button disabled={sending || !content.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {sending ? "Sending…" : "Send message"}
          </button>
        </form>
      )}

      {!moderator && canReply && unansweredRequests.map((request) => (
        <form
          key={request.id}
          className="space-y-2 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendParticipantReply(request.id);
          }}
        >
          <label className="block text-xs font-medium text-foreground" htmlFor={`dispute-reply-${request.id}`}>
            Reply to the moderation team
          </label>
          <textarea
            id={`dispute-reply-${request.id}`}
            value={replyContent[request.id] ?? ""}
            onChange={(event) => setReplyContent((current) => ({ ...current, [request.id]: event.target.value }))}
            maxLength={5000}
            required
            rows={3}
            placeholder="Add the information requested…"
            className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          />
          <input
            key={`${request.id}-${replyFiles[request.id]?.length ?? 0}`}
            type="file"
            multiple
            accept="image/*,application/pdf,text/*"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 5) setError("You can attach up to 5 files to one response.");
              setReplyFiles((current) => ({ ...current, [request.id]: files.slice(0, 5) }));
            }}
            className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:font-medium"
          />
          {!!replyFiles[request.id]?.length && (
            <p className="text-xs text-muted-foreground">{replyFiles[request.id].map((file) => file.name).join(", ")} · up to 10MB each</p>
          )}
          <button disabled={sending || !replyContent[request.id]?.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {sending ? "Sending…" : "Send response"}
          </button>
        </form>
      ))}

      {!moderator && canReply && unansweredParticipantMessages.length > 0 && (
        <p className="text-xs text-muted-foreground">Your message is with the moderation team; you’ll be notified when they reply.</p>
      )}
      {!canReply && <p className="text-xs text-muted-foreground">This dispute is closed and no longer accepts messages.</p>}
    </section>
  );
}
