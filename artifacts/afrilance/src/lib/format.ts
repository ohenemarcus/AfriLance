export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatBudget(
  min: number | null | undefined,
  max: number | null | undefined,
  type: string,
): string {
  if (!min && !max) return "Negotiable";
  const suffix = type === "hourly" ? "/hr" : "";
  if (min && max) return `${formatCurrency(min)} – ${formatCurrency(max)}${suffix}`;
  if (min) return `From ${formatCurrency(min)}${suffix}`;
  return `Up to ${formatCurrency(max)}${suffix}`;
}

export function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatStars(rating: number | null | undefined): string {
  if (rating == null) return "No rating";
  return rating.toFixed(1);
}
