import { useState } from "react";
import {
  useListConversations,
  useGetConversationMessages,
  useSendMessage,
  getListConversationsQueryKey,
  getGetConversationMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { formatRelative } from "@/lib/format";

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");

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
      },
    },
  );

  const { mutate: sendMessage, isPending: sending } = useSendMessage();

  const selectedConvo = conversationsData?.conversations.find(
    (c) => c.id === selectedConversation,
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !selectedConvo) return;
    sendMessage(
      {
        data: {
          recipientId: selectedConvo.otherUserId,
          content: newMessage.trim(),
        },
      },
      {
        onSuccess: () => {
          setNewMessage("");
          queryClient.invalidateQueries({
            queryKey: getGetConversationMessagesQueryKey(selectedConversation, {}),
          });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        },
      },
    );
  };

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
          </div>
          <div className="flex-1 overflow-y-auto">
            {convoLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : !conversationsData?.conversations.length ? (
              <div className="text-center py-10 px-4">
                <svg className="w-8 h-8 text-muted-foreground mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-sm text-muted-foreground">No messages yet</p>
              </div>
            ) : (
              conversationsData.conversations.map((c) => (
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
                <UserAvatar name={selectedConvo?.otherUserName} size="sm" />
                <span className="font-medium text-foreground">{selectedConvo?.otherUserName}</span>
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
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {formatRelative(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-border flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
