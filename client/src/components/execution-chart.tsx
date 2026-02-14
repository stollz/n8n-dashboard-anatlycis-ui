import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyStats } from "@shared/schema";
import { AlertCircle, Loader2 } from "lucide-react";

interface ExecutionChartProps {
  data: DailyStats[];
  isLoading?: boolean;
  error?: string | null;
}

export function ExecutionChart({ data, isLoading, error }: ExecutionChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Execution Trends
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
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Execution Trends
          </h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <span className="text-sm font-medium">Unable to load chart data</span>
            <span className="text-xs max-w-xs text-center">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Execution Trends
          </h3>
        </div>
        <div className="px-6 pb-6">
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <span className="text-sm">No execution data available</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">
          Execution Trends
        </h3>
      </div>
      <div className="px-6 pb-6">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                fontFamily="var(--font-sans)"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                fontFamily="var(--font-sans)"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                }}
                labelStyle={{
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                }}
              />
              <Area
                type="monotone"
                dataKey="success"
                name="Success"
                stroke="#059669"
                strokeWidth={2}
                fillOpacity={1}
                fill="rgba(5, 150, 105, 0.1)"
              />
              <Area
                type="monotone"
                dataKey="error"
                name="Errors"
                stroke="#DC2626"
                strokeWidth={2}
                fillOpacity={1}
                fill="rgba(220, 38, 38, 0.1)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
