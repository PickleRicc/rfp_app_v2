import { AlertCircle, CheckCircle2, Info, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "warning" | "error" | "success";

interface AlertBannerProps {
  variant?: AlertVariant;
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
  center?: boolean;
}

const VARIANT_STYLES: Record<
  AlertVariant,
  { border: string; bg: string; icon: React.ComponentType<{ className?: string }>; iconColor: string; titleColor: string; textColor: string }
> = {
  info: {
    border: "border-primary/30",
    bg: "bg-primary/5",
    icon: Info,
    iconColor: "text-primary",
    titleColor: "text-foreground",
    textColor: "text-muted-foreground",
  },
  warning: {
    border: "border-warning/40",
    bg: "bg-warning/10",
    icon: AlertTriangle,
    iconColor: "text-warning",
    titleColor: "text-warning-foreground",
    textColor: "text-warning-foreground/80",
  },
  error: {
    border: "border-destructive/40",
    bg: "bg-destructive/10",
    icon: XCircle,
    iconColor: "text-destructive",
    titleColor: "text-foreground",
    textColor: "text-muted-foreground",
  },
  success: {
    border: "border-success/40",
    bg: "bg-success/10",
    icon: CheckCircle2,
    iconColor: "text-success",
    titleColor: "text-foreground",
    textColor: "text-muted-foreground",
  },
};

export function AlertBanner({
  variant = "info",
  title,
  message,
  action,
  className,
  center = false,
}: AlertBannerProps) {
  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        styles.border,
        styles.bg,
        center && "text-center",
        className
      )}
    >
      <div className={cn("flex gap-3", center && "flex-col items-center")}>
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", styles.iconColor, center && "mt-0")} />
        <div className="flex-1 min-w-0">
          {title && (
            <p className={cn("text-sm font-medium", styles.titleColor)}>{title}</p>
          )}
          <p className={cn("text-sm", title ? "mt-0.5" : "", styles.textColor)}>{message}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}
