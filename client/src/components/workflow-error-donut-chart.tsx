import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { WorkflowStats } from "@shared/schema";
import { AlertCircle, Loader2 } from "lucide-react";

interface WorkflowErrorDonutChartProps {
  title: string;
  data: WorkflowStats[] | undefined;
  isLoading?: boolean;
  error?: string | null;
}

const PALETTE = [
  "#DC2626", // red-600
  "#EA580C", // orange-600
  "#D97706", // amber-600
  "#CA8A04", // yellow-600
  "#9333EA", // purple-600
  "#2563EB", // blue-600
  "#0D9488", // teal-600
  "#DB2777", // pink-600
];

export function WorkflowErrorDonutChart({
  title,
  data,
  isLoading,
  error,
}: WorkflowErrorDonutChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm h-full">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[180px] flex items-center justify-center">
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
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[180px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <span className="text-sm font-medium">Unable to load data</span>
            <span className="text-xs max-w-xs text-center">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  const errorWorkflows = (data ?? [])
    .filter((w) => w.failed > 0)
    .sort((a, b) => b.failed - a.failed);

  const totalErrors = errorWorkflows.reduce((sum, w) => sum + w.failed, 0);

  if (errorWorkflows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm h-full">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[180px] flex items-center justify-center">
            <span className="text-sm text-muted-foreground">No errors in this period</span>
          </div>
        </div>
      </div>
    );
  }

  const chartData = errorWorkflows.map((w, i) => ({
    name: w.workflow_name,
    value: w.failed,
    color: PALETTE[i % PALETTE.length],
  }));

  const legendItems = chartData.slice(0, 6);
  const overflowCount = chartData.length - 6;

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm h-full">
      <div className="px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalErrors} error{totalErrors !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="px-6 pb-6">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                stroke="hsl(var(--card))"
                strokeWidth={2}
              >
                {chartData.map((entry, index) => (
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
                  color: "hsl(var(--foreground))",
                }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number, name: string) => [`${value} errors`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-3">
          {legendItems.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center gap-1.5 text-sm"
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground max-w-[120px] truncate" title={entry.name}>
                {entry.name}
              </span>
              <span className="font-mono font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
          {overflowCount > 0 && (
            <span className="text-xs text-muted-foreground self-center">
              + {overflowCount} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
