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

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: StatCardProps) {
  return (
    <div
      className="rounded-lg border border-border bg-card shadow-sm p-6"
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
          <div className="text-3xl font-mono font-semibold tracking-tight">{value}</div>
        </div>
        <div className="text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {description && (
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      )}
      {trend && (
        <div className="flex items-center mt-2 gap-1.5">
          <span
            className={`text-sm font-medium ${
              trend.isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-sm text-muted-foreground">
            vs last period
          </span>
        </div>
      )}
    </div>
  );
}
