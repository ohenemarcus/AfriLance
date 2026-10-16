import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

function NotifIcon({ type }: { type: string }) {
  const base = "w-4 h-4";
  if (type === "new_proposal") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
  if (type === "proposal_accepted") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (type === "proposal_rejected" || type === "proposal_status") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (type === "payment_escrowed") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
  if (type === "payment_released") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
  if (type === "new_message") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
  if (type === "id_verified") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
  if (type === "id_rejected") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (type === "top_rated") return (
    <svg className={base} fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
  if (type === "job_flagged") return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  );
  return (
    <svg className={base} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function notifColors(type: string, isRead: boolean) {
  if (isRead) return "bg-muted text-muted-foreground";
  if (type === "proposal_accepted" || type === "id_verified" || type === "top_rated" || type === "payment_released")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (type === "proposal_rejected" || type === "id_rejected" || type === "job_flagged")
    return "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
  if (type === "payment_escrowed")
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
  if (type === "new_message")
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
  return "bg-primary/10 text-primary";
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useListNotifications({}, {
    query: { queryKey: getListNotificationsQueryKey({}) },
  });

  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllNotificationsRead();

  const handleMarkRead = (id: number) => {
    markRead(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) });
        },
      },
    );
  };

  const handleMarkAll = () => {
    markAllRead(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) });
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          {data?.unreadCount != null && data.unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{data.unreadCount} unread</p>
          )}
        </div>
        {data?.unreadCount != null && data.unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : !data?.notifications.length ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-muted-foreground font-medium">No notifications</p>
          <p className="text-sm text-muted-foreground mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-4 p-4 bg-card border rounded-xl transition-colors",
                n.isRead ? "border-border" : "border-primary/30 bg-primary/5",
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                notifColors(n.type, n.isRead),
              )}>
                <NotifIcon type={n.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{n.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.body}</div>
                <div className="text-xs text-muted-foreground mt-1.5">{formatRelative(n.createdAt)}</div>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="text-xs text-primary hover:underline flex-shrink-0 mt-0.5"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
