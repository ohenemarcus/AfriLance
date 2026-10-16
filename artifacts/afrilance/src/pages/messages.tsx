import { useEffect, useRef, useState } from "react";
import {
  useListConversations,
  useGetConversationMessages,
  useSendMessage,
  getListConversationsQueryKey,
  getGetConversationMessagesQueryKey,
} from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { formatRelative } from "@/lib/format";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FileText, Flag, ImagePlus, Search, X } from "lucide-react";

function attachmentHref(messageId: number): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
  return `${apiBase}/api/messages/${messageId}/attachment`;
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [reportingMessage, setReportingMessage] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("Harassment or abuse");
  const [reportDetails, setReportDetails] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSending, setReportSending] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress, error: uploadError } = useFileUpload({ maxSizeMB: 10 });

  const { data: profile } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

  const { data: conversationsData, isLoading: convoLoading } = useListConversations({
    query: { queryKey: getListConversationsQueryKey() },
  });

  const { data: messagesData, isLoading: msgLoading } = useGetConversationMessages(
    selectedConversation!,
    {},
    {
      query: {
        enabled: !!selectedConversation,
        queryKey: getGetConversationMessagesQueryKey(selectedConversation!, {}),
        refetchInterval: 3000,
      },
    },
  );

  const { mutate: sendMessage, isPending: sending } = useSendMessage();

  const { data: otherUserTyping } = useQuery({
    queryKey: ["conversation-typing", selectedConversation],
    queryFn: () => customFetch<{ isTyping: boolean }>(`/api/messages/conversations/${selectedConversation}/typing`),
    enabled: !!selectedConversation,
    refetchInterval: 1500,
  });

  const visibleConversations = conversationsData?.conversations.filter((conversation) =>
    `${conversation.otherUserName} ${conversation.lastMessage ?? ""}`
      .toLowerCase()
      .includes(conversationSearch.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!selectedConversation || !messagesData) return;
    queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  }, [selectedConversation, messagesData, queryClient]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
  }, []);

  const updateTyping = (isTyping: boolean) => {
    if (!selectedConversation) return;
    void customFetch<void>(`/api/messages/conversations/${selectedConversation}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTyping }),
    }).catch(() => undefined);
  };

  const handleMessageChange = (value: string) => {
    setNewMessage(value);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    if (!value.trim()) {
      updateTyping(false);
      return;
    }
    typingTimer.current = setTimeout(() => updateTyping(true), 300);
    typingStopTimer.current = setTimeout(() => updateTyping(false), 1800);
  };

  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachment) || !selectedConversation || !selectedConvo) return;
    let attachmentUrl: string | undefined;
    if (attachment) {
      attachmentUrl = (await uploadFile(attachment)) ?? undefined;
      if (!attachmentUrl) return;
    }
    updateTyping(false);
    sendMessage(
      {
        data: {
          recipientId: selectedConvo.otherUserId,
          content: newMessage.trim(),
          ...(attachmentUrl && attachment ? {
            attachmentUrl,
            attachmentName: attachment.name,
            attachmentType: attachment.type || "application/octet-stream",
          } : {}),
        },
      },
      {
        onSuccess: () => {
          setNewMessage("");
          setAttachment(null);
          if (fileInput.current) fileInput.current.value = "";
          queryClient.invalidateQueries({ queryKey: getGetConversationMessagesQueryKey(selectedConversation, {}) });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
      },
    );
  };

  const reportMessage = async (messageId: number) => {
    setReportSending(true);
    setReportError(null);
    try {
      await customFetch<{ reported: boolean }>(`/api/messages/${messageId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      setReportingMessage(null);
      setReportDetails("");
    } catch {
      setReportError("Could not submit this report. Please try again.");
    } finally {
      setReportSending(false);
    }
  };

  const selectedConvo = conversationsData?.conversations.find(
    (c) => c.id === selectedConversation,
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden flex" style={{ height: "calc(100vh - 260px)", minHeight: "400px" }}>
        {/* Conversations list */}
        <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
            <label className="relative mt-3 block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {convoLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : !visibleConversations?.length ? (
              <div className="text-center py-10 px-4">
                <svg className="w-8 h-8 text-muted-foreground mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm text-muted-foreground">
                  {conversationSearch ? "No matching conversations" : "No messages yet"}
                </p>
              </div>
            ) : (
              visibleConversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConversation(c.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${
                    selectedConversation === c.id ? "bg-muted" : ""
                  }`}
                >
                  <UserAvatar name={c.otherUserName} avatarUrl={c.otherUserAvatarUrl} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">{c.otherUserName}</span>
                      {c.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-1">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    {c.lastMessage && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</div>
                    )}
                    {c.lastMessageAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">{formatRelative(c.lastMessageAt)}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message thread */}
        <div className="flex-1 flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-muted-foreground font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground mt-1">Choose a conversation from the left to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                <UserAvatar name={selectedConvo?.otherUserName} avatarUrl={selectedConvo?.otherUserAvatarUrl} size="sm" />
                <div className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{selectedConvo?.otherUserName}</span>
                  {otherUserTyping?.isTyping && <span className="text-xs text-muted-foreground">Typing...</span>}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgLoading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-xl max-w-xs" />)}
                  </div>
                ) : !messagesData?.messages.length ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messagesData.messages.map((msg) => {
                    const isMe = msg.senderId === profile?.id;
                    return (
                      <div key={msg.id} className={`group flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => setReportingMessage(msg.id)}
                            title="Report message"
                            aria-label="Report message"
                            className="mb-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                          >
                            <Flag className="h-4 w-4" />
                          </button>
                        )}
                        <div className={`max-w-sm min-w-24 rounded-2xl px-4 py-2.5 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                          {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                          {msg.attachmentUrl && (
                            msg.attachmentType?.startsWith("image/") ? (
                              <a href={attachmentHref(msg.id)} target="_blank" rel="noreferrer" className="mt-1 block">
                                <img src={attachmentHref(msg.id)} alt={msg.attachmentName ?? "Message attachment"} className="max-h-64 max-w-full rounded object-contain" />
                                <span className="mt-1 block break-all text-xs underline">{msg.attachmentName}</span>
                              </a>
                            ) : (
                              <a href={attachmentHref(msg.id)} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-2 rounded border border-current/20 p-2 underline">
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="break-all">{msg.attachmentName ?? "Download attachment"}</span>
                              </a>
                            )
                          )}
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            <time dateTime={msg.createdAt} title={formatRelative(msg.createdAt)}>{formatMessageTime(msg.createdAt)}</time>
                            {isMe && <span>{msg.isRead ? "Read" : "Sent"}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <form onSubmit={submitMessage} className="border-t border-border p-4">
                {attachment && (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded border border-border bg-muted/40 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{attachment.name}{isUploading ? ` · ${progress}%` : ""}</span>
                    <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                )}
                {uploadError && <p className="mb-2 text-xs text-destructive">{uploadError}</p>}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.zip"
                    className="hidden"
                    onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                  />
                  <button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach a file or image" title="Attach a file or image" className="rounded-md border border-border p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <ImagePlus className="h-4 w-4" />
                  </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  placeholder="Type a message..."
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={sending || isUploading || (!newMessage.trim() && !attachment)}
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Send
                </button>
                </div>
              </form>
              {reportingMessage !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportingMessage(null); }}>
                  <form className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="report-title" onSubmit={(event) => { event.preventDefault(); void reportMessage(reportingMessage); }}>
                    <div className="flex items-start justify-between gap-4">
                      <div><h2 id="report-title" className="font-semibold">Report message</h2><p className="mt-1 text-sm text-muted-foreground">Tell us why this message needs review.</p></div>
                      <button type="button" onClick={() => setReportingMessage(null)} aria-label="Close report dialog" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    </div>
                    <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <option>Harassment or abuse</option><option>Spam or scam</option><option>Inappropriate content</option><option>Other</option>
                    </select>
                    <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={1000} rows={3} placeholder="Additional details (optional)" className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm" />
                    {reportError && <p role="alert" className="text-sm text-destructive">{reportError}</p>}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setReportingMessage(null)} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
                      <button type="submit" disabled={reportSending} className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50">{reportSending ? "Submitting..." : "Submit report"}</button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
