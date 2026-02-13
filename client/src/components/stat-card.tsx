import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "error" | "warning";
}

const variantStyles = {
  default: {
    bg: "bg-brutal-blue",
    icon: "bg-brutal-blue",
    border: "border-foreground",
  },
  success: {
    bg: "bg-brutal-mint",
    icon: "bg-brutal-mint",
    border: "border-foreground",
  },
  error: {
    bg: "bg-brutal-coral",
    icon: "bg-brutal-coral",
    border: "border-foreground",
  },
  warning: {
    bg: "bg-brutal-yellow",
    icon: "bg-brutal-yellow",
    border: "border-foreground",
  },
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`border-2 ${styles.border} bg-card shadow-brutal brutal-hover overflow-hidden`}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Colored top strip */}
      <div className={`h-2 ${styles.bg}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-heading font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {title}
            </p>
            <div className="text-4xl font-heading font-bold tracking-tight">{value}</div>
          </div>
          <div className={`${styles.icon} border-2 border-foreground p-2.5 shadow-brutal-sm`}>
            <Icon className="h-5 w-5 text-foreground" strokeWidth={2.5} />
          </div>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-3 font-medium">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-3 gap-1.5">
            <span
              className={`text-sm font-bold px-2 py-0.5 border-2 border-foreground ${
                trend.isPositive
                  ? "bg-brutal-mint text-foreground"
                  : "bg-brutal-coral text-foreground"
              }`}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              vs last period
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
