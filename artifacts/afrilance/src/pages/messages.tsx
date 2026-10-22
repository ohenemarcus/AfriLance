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
import { useAuth } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { formatBudget, formatCurrency, formatRelative } from "@/lib/format";
import { useFileUpload } from "@/hooks/useFileUpload";
import { ArrowLeft, Ban, BellOff, FileText, Flag, ImagePlus, Search, X } from "lucide-react";

function attachmentApiUrl(messageId: number): string {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "";
  return `${apiBase}/api/messages/${messageId}/attachment`;
}

function MessageAttachment({ message }: { message: { id: number; attachmentType: string | null; attachmentName: string | null } }) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";

    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch(attachmentApiUrl(message.id), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`File request failed (${response.status})`);
        objectUrl = URL.createObjectURL(await response.blob());
        setUrl(objectUrl);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : "Could not load attachment");
        }
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [getToken, message.id]);

  if (error) return <p className="mt-2 text-xs text-destructive">{error}</p>;
  if (!url) return <p className="mt-2 text-xs opacity-70">Loading attachment…</p>;

  if (message.attachmentType?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block">
        <img src={url} alt={message.attachmentName ?? "Message attachment"} className="max-h-64 max-w-full rounded object-contain" />
        <span className="mt-1 block break-all text-xs underline">{message.attachmentName}</span>
      </a>
    );
  }

  return (
    <a href={url} download={message.attachmentName ?? "attachment"} className="mt-1 flex items-center gap-2 rounded border border-current/20 p-2 underline">
      <FileText className="h-4 w-4 shrink-0" />
      <span className="break-all">{message.attachmentName ?? "Download attachment"}</span>
    </a>
  );
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
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reportUserReason, setReportUserReason] = useState("Harassment or abuse");
  const [reportUserDetails, setReportUserDetails] = useState("");
  const [reportUserError, setReportUserError] = useState("");
  const [userActionError, setUserActionError] = useState("");
  const [userActionNotice, setUserActionNotice] = useState("");
  const [userActionPending, setUserActionPending] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [conversationOpenError, setConversationOpenError] = useState("");
  const handledProposalId = useRef<number | null>(null);
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
    `${conversation.otherUserName} ${conversation.lastMessage ?? ""} ${conversation.job?.title ?? ""}`
      .toLowerCase()
      .includes(conversationSearch.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!selectedConversation || !messagesData) return;
    queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  }, [selectedConversation, messagesData, queryClient]);

  useEffect(() => {
    const requestedConversationId = Number(new URLSearchParams(window.location.search).get("conversation"));
    if (!Number.isInteger(requestedConversationId) || requestedConversationId <= 0) return;
    const requestedConversation = conversationsData?.conversations.find(
      (conversation) => conversation.id === requestedConversationId,
    );
    if (requestedConversation) setSelectedConversation(requestedConversation.id);
  }, [conversationsData]);

  useEffect(() => {
    const proposalId = Number(new URLSearchParams(window.location.search).get("proposal"));
    if (!profile || !Number.isInteger(proposalId) || proposalId <= 0 || handledProposalId.current === proposalId) return;
    handledProposalId.current = proposalId;
    setConversationOpenError("");
    void customFetch<{ conversationId: number }>(`/api/messages/conversations/accepted-proposal/${proposalId}`, {
      method: "POST",
    }).then(({ conversationId }) => {
      setSelectedConversation(conversationId);
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    }).catch(() => {
      setConversationOpenError("This conversation is only available to the client and freelancer on an accepted proposal.");
      handledProposalId.current = null;
    });
  }, [profile, queryClient]);

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
          conversationId: selectedConversation,
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

  const toggleMute = async () => {
    if (!selectedConvo) return;
    setUserActionError("");
    setUserActionNotice("");
    setUserActionPending(true);
    try {
      await customFetch<{ muted: boolean }>(`/api/messages/conversations/${selectedConvo.id}/mute`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: !selectedConvo.isMuted }),
      });
      await queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      setUserActionError("Could not update this conversation’s notification setting. Please try again.");
    } finally {
      setUserActionPending(false);
    }
  };

  const setUserBlocked = async (blocked: boolean) => {
    if (!selectedConvo) return;
    setUserActionError("");
    setUserActionNotice("");
    setUserActionPending(true);
    try {
      await customFetch<{ blocked: boolean }>(`/api/messages/conversations/${selectedConvo.id}/block`, {
        method: blocked ? "POST" : "DELETE",
      });
      setConfirmBlockOpen(false);
      if (blocked) updateTyping(false);
      setUserActionNotice(blocked ? "User blocked. Existing conversation history remains available." : "User unblocked.");
      await queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      setUserActionError(blocked ? "Could not block this user. Please try again." : "Could not unblock this user. Please try again.");
    } finally {
      setUserActionPending(false);
    }
  };

  const reportUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedConvo) return;
    setReportUserError("");
    setUserActionPending(true);
    try {
      await customFetch<{ reported: boolean }>(`/api/messages/conversations/${selectedConvo.id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reportUserReason, details: reportUserDetails }),
      });
      setReportUserOpen(false);
      setReportUserDetails("");
      setUserActionNotice("Your report was submitted to Afrlance for review.");
    } catch {
      setReportUserError("Could not submit this report. Please try again.");
    } finally {
      setUserActionPending(false);
    }
  };

  const selectedConvo = conversationsData?.conversations.find(
    (c) => c.id === selectedConversation,
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        {conversationOpenError && <p role="alert" className="mt-2 text-sm text-destructive">{conversationOpenError}</p>}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden flex min-w-0 h-[calc(100dvh-220px)] min-h-[360px] md:h-[calc(100vh-260px)] md:min-h-[400px]">
        {/* Conversations list */}
        <div className={`w-full md:w-80 md:flex-shrink-0 border-r border-border flex-col ${selectedConversation ? "hidden md:flex" : "flex"}`}>
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
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground truncate">{c.otherUserName}</span>
                        {c.isMuted && <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Muted" />}
                        {c.isBlockedByMe && <Ban className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="Blocked" />}
                      </span>
                      {c.unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-1">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                    {c.lastMessage && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</div>
                    )}
                    {c.job && (
                      <div className="text-xs text-primary truncate mt-0.5">{c.job.title}</div>
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
        <div className={`min-w-0 flex-1 flex-col ${selectedConversation ? "flex" : "hidden md:flex"}`}>
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
              <div className="flex items-center gap-3 px-3 py-3 border-b border-border sm:px-5">
                <button type="button" onClick={() => setSelectedConversation(null)} aria-label="Back to conversations" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <UserAvatar name={selectedConvo?.otherUserName} avatarUrl={selectedConvo?.otherUserAvatarUrl} size="sm" />
                <div className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{selectedConvo?.otherUserName}</span>
                  {otherUserTyping?.isTyping && <span aria-live="polite" className="text-xs text-muted-foreground">Typing…</span>}
                </div>
                {selectedConvo && (
                  <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                    <button type="button" onClick={() => void toggleMute()} disabled={userActionPending} aria-label={selectedConvo.isMuted ? "Unmute conversation" : "Mute conversation"} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                      <BellOff className="h-3.5 w-3.5" />{selectedConvo.isMuted ? "Unmute" : "Mute"}
                    </button>
                    <button type="button" onClick={() => { setReportUserError(""); setReportUserOpen(true); }} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted">
                      <Flag className="h-3.5 w-3.5" />Report
                    </button>
                    {selectedConvo.isBlockedByMe ? (
                      <button type="button" onClick={() => void setUserBlocked(false)} disabled={userActionPending} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                        Unblock
                      </button>
                    ) : (
                      <button type="button" onClick={() => setConfirmBlockOpen(true)} disabled={userActionPending || selectedConvo.hasBlockedMe} className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">
                        <Ban className="h-3.5 w-3.5" />Block
                      </button>
                    )}
                  </div>
                )}
              </div>

              {(userActionError || userActionNotice) && (
                <p role={userActionError ? "alert" : "status"} className={`border-b px-4 py-2 text-sm ${userActionError ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}>
                  {userActionError || userActionNotice}
                </p>
              )}

              {(selectedConvo?.isBlockedByMe || selectedConvo?.hasBlockedMe) && (
                <div role="status" className="border-b border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  {selectedConvo.isBlockedByMe
                    ? "You blocked this user. Existing messages remain available; unblock them to send new messages."
                    : "This user has blocked you. You can still view this conversation, but messaging is unavailable."}
                </div>
              )}

              {selectedConvo?.job && (
                <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Job conversation</p>
                      <p className="truncate text-sm font-semibold text-foreground">{selectedConvo.job.title}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                      {selectedConvo.job.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Budget: {formatBudget(selectedConvo.job.budgetMin, selectedConvo.job.budgetMax, selectedConvo.job.budgetType)}</span>
                    {selectedConvo.job.proposalBidAmount != null && (
                      <span>Proposal: {formatCurrency(selectedConvo.job.proposalBidAmount)}</span>
                    )}
                  </div>
                </div>
              )}

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
                          {msg.attachmentUrl && <MessageAttachment message={msg} />}
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
              <form onSubmit={submitMessage} className="border-t border-border p-3 sm:p-4">
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
                  <button type="button" onClick={() => fileInput.current?.click()} disabled={selectedConvo?.isBlockedByMe || selectedConvo?.hasBlockedMe} aria-label="Attach a file or image" title="Attach a file or image" className="rounded-md border border-border p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
                    <ImagePlus className="h-4 w-4" />
                  </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => handleMessageChange(e.target.value)}
                  placeholder={selectedConvo?.isBlockedByMe || selectedConvo?.hasBlockedMe ? "Messaging is unavailable" : "Type a message..."}
                  disabled={selectedConvo?.isBlockedByMe || selectedConvo?.hasBlockedMe}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={sending || isUploading || (!newMessage.trim() && !attachment) || selectedConvo?.isBlockedByMe || selectedConvo?.hasBlockedMe}
                  className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Send
                </button>
                </div>
              </form>
              {reportUserOpen && selectedConvo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportUserOpen(false); }}>
                  <form className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="report-user-title" onSubmit={(event) => void reportUser(event)}>
                    <div className="flex items-start justify-between gap-4">
                      <div><h2 id="report-user-title" className="font-semibold">Report {selectedConvo.otherUserName}</h2><p className="mt-1 text-sm text-muted-foreground">Tell Afrlance why this user should be reviewed. Reports are sent to the support team.</p></div>
                      <button type="button" onClick={() => setReportUserOpen(false)} aria-label="Close report dialog" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                    </div>
                    <select value={reportUserReason} onChange={(event) => setReportUserReason(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                      <option>Harassment or abuse</option><option>Spam or scam</option><option>Impersonation</option><option>Inappropriate behavior</option><option>Other</option>
                    </select>
                    <textarea value={reportUserDetails} onChange={(event) => setReportUserDetails(event.target.value)} maxLength={1000} rows={3} placeholder="Additional details (optional)" className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm" />
                    {reportUserError && <p role="alert" className="text-sm text-destructive">{reportUserError}</p>}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setReportUserOpen(false)} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
                      <button type="submit" disabled={userActionPending} className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50">{userActionPending ? "Submitting..." : "Submit report"}</button>
                    </div>
                  </form>
                </div>
              )}
              {confirmBlockOpen && selectedConvo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmBlockOpen(false); }}>
                  <section className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="block-user-title">
                    <div>
                      <h2 id="block-user-title" className="font-semibold">Block {selectedConvo.otherUserName}?</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">They won’t be able to send you messages, and you won’t be able to message them. Existing conversation history stays available. You can unblock them later.</p>
                    </div>
                    {userActionError && <p role="alert" className="text-sm text-destructive">{userActionError}</p>}
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setConfirmBlockOpen(false)} className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
                      <button type="button" onClick={() => void setUserBlocked(true)} disabled={userActionPending} className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50">{userActionPending ? "Blocking..." : "Block user"}</button>
                    </div>
                  </section>
                </div>
              )}
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
