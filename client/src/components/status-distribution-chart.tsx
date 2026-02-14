import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ExecutionStats } from "@shared/schema";
import { AlertCircle, Loader2 } from "lucide-react";

interface StatusDistributionChartProps {
  stats: ExecutionStats | null;
  isLoading?: boolean;
  error?: string | null;
}

const COLORS: Record<string, string> = {
  success: "#059669",
  error: "#DC2626",
  running: "#2563EB",
  waiting: "#D97706",
  canceled: "#6B7280",
};

export function StatusDistributionChart({
  stats,
  isLoading,
  error,
}: StatusDistributionChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm h-full">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Status Distribution
          </h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[300px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm h-full">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Status Distribution
          </h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <span className="text-sm font-medium">Unable to load data</span>
            <span className="text-xs max-w-xs text-center">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  const data = stats
    ? [
        { name: "Success", value: stats.successCount, color: COLORS.success },
        { name: "Error", value: stats.errorCount, color: COLORS.error },
        { name: "Running", value: stats.runningCount, color: COLORS.running },
        { name: "Waiting", value: stats.waitingCount, color: COLORS.waiting },
        { name: "Canceled", value: stats.canceledCount, color: COLORS.canceled },
      ].filter((item) => item.value > 0)
    : [];

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm h-full">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Status Distribution
          </h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[300px] flex items-center justify-center">
            <span className="text-sm text-muted-foreground">No execution data available</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm h-full">
      <div className="px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">
          Status Distribution
        </h3>
      </div>
      <div className="px-6 pb-6">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                }}
                formatter={(value: number) => [value, "Executions"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3 justify-center">
          {data.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center gap-1.5 text-sm"
            >
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-mono font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
