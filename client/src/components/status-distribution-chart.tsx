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
  success: "#22C55E",
  error: "#FF4444",
  running: "#748FFC",
  waiting: "#FFD43B",
  canceled: "#94A3B8",
};

export function StatusDistributionChart({
  stats,
  isLoading,
  error,
}: StatusDistributionChartProps) {
  if (isLoading) {
    return (
      <div className="border-2 border-foreground bg-card shadow-brutal h-full">
        <div className="bg-brutal-lavender border-b-2 border-foreground px-6 py-3">
          <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
            Status Distribution
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[300px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" strokeWidth={3} />
              <span className="font-heading text-sm uppercase tracking-wide text-muted-foreground">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-2 border-foreground bg-card shadow-brutal h-full">
        <div className="bg-brutal-coral border-b-2 border-foreground px-6 py-3">
          <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
            Status Distribution
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="border-2 border-foreground bg-brutal-yellow p-3 shadow-brutal-sm">
              <AlertCircle className="h-8 w-8 text-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold uppercase">Unable to load data</span>
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
      <div className="border-2 border-foreground bg-card shadow-brutal h-full">
        <div className="bg-brutal-lavender border-b-2 border-foreground px-6 py-3">
          <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
            Status Distribution
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[300px] flex items-center justify-center">
            <span className="text-muted-foreground font-bold uppercase tracking-wide">No execution data available</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-foreground bg-card shadow-brutal h-full">
      <div className="bg-brutal-lavender border-b-2 border-foreground px-6 py-3">
        <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
          Status Distribution
        </h3>
      </div>
      <div className="p-6">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={0}
                dataKey="value"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "2px solid hsl(var(--foreground))",
                  boxShadow: "var(--brutal-shadow)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                }}
                formatter={(value: number) => [value, "Executions"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Custom legend */}
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {data.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center gap-1.5 border-2 border-foreground px-2 py-1 text-xs font-bold uppercase tracking-wide shadow-brutal-sm"
              style={{ backgroundColor: entry.color }}
            >
              <span className="text-foreground">{entry.name}</span>
              <span className="text-foreground font-heading">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
