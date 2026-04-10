import { cn } from "@/lib/utils";

export interface StatusConfig {
  label: string;
  classes: string;
}

interface StatusBadgeProps {
  label: string;
  classes?: string;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ label, classes, className, pulse }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        classes,
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}

export function makeStatusBadge<T extends string>(
  config: Record<T, StatusConfig>,
  fallback: StatusConfig = { label: "Unknown", classes: "bg-muted/50 text-muted-foreground" }
) {
  return function BoundStatusBadge({
    status,
    pulse,
    className,
  }: {
    status: T | string;
    pulse?: boolean;
    className?: string;
  }) {
    const cfg = (config as Record<string, StatusConfig>)[status] ?? fallback;
    const isActive =
      pulse ??
      ["uploading", "classifying", "reconciling", "analyzing", "extracting", "processing"].includes(
        status
      );
    return (
      <StatusBadge
        label={cfg.label}
        classes={cfg.classes}
        className={className}
        pulse={isActive}
      />
    );
  };
}
