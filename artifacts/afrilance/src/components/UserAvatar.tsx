import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string | null | undefined;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
};

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function resolveAvatarUrl(avatarUrl: string): string {
  if (avatarUrl.startsWith("/api/storage")) return avatarUrl;
  if (avatarUrl.startsWith("/objects/") || avatarUrl.startsWith("/public-objects/")) {
    return `/api/storage${avatarUrl}`;
  }
  return avatarUrl;
}

export function UserAvatar({ name, avatarUrl, size = "md", className }: UserAvatarProps) {
  const sizeClass = sizes[size];
  if (avatarUrl) {
    return (
      <img
        src={resolveAvatarUrl(avatarUrl)}
        alt={name ?? "User"}
        className={cn("rounded-full object-cover flex-shrink-0", sizeClass, className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center flex-shrink-0 font-semibold bg-primary text-primary-foreground",
        sizeClass,
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
