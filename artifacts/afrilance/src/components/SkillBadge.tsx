import { cn } from "@/lib/utils";

interface SkillBadgeProps {
  skill: string;
  className?: string;
}

export function SkillBadge({ skill, className }: SkillBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-accent text-accent-foreground border border-border",
        className,
      )}
    >
      {skill}
    </span>
  );
}
