import { cn } from "@/lib/utils";

type Status = "open" | "awaiting_funding" | "payment_pending" | "in_progress" | "awaiting_approval" | "awaiting_release" | "release_pending" | "completed" | "cancelled" | "closed" | "submitted" | "under_review" | "accepted" | "rejected" | "escrowed" | "released" | string;

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  awaiting_funding: { label: "Awaiting funding", className: "bg-amber-100 text-amber-800 border-amber-200" },
  payment_pending: { label: "Payment processing", className: "bg-amber-100 text-amber-800 border-amber-200" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800 border-amber-200" },
  awaiting_approval: { label: "Awaiting approval", className: "bg-blue-100 text-blue-800 border-blue-200" },
  awaiting_release: { label: "Approved · Awaiting payout", className: "bg-violet-100 text-violet-800 border-violet-200" },
  release_pending: { label: "Payout processing", className: "bg-violet-100 text-violet-800 border-violet-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 border-gray-200" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-600 border-gray-200" },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-800 border-blue-200" },
  under_review: { label: "Under Review", className: "bg-amber-100 text-amber-800 border-amber-200" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  escrowed: { label: "Escrowed", className: "bg-blue-100 text-blue-800 border-blue-200" },
  released: { label: "Released", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
