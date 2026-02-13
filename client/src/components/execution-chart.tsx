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
      <div className="border-2 border-foreground bg-card shadow-brutal">
        <div className="bg-brutal-blue border-b-2 border-foreground px-6 py-3">
          <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
            Execution Trends
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
      <div className="border-2 border-foreground bg-card shadow-brutal">
        <div className="bg-brutal-coral border-b-2 border-foreground px-6 py-3">
          <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
            Execution Trends
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="border-2 border-foreground bg-brutal-yellow p-3 shadow-brutal-sm">
              <AlertCircle className="h-8 w-8 text-foreground" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold uppercase">Unable to load chart data</span>
            <span className="text-xs max-w-xs text-center">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="border-2 border-foreground bg-card shadow-brutal">
        <div className="bg-brutal-blue border-b-2 border-foreground px-6 py-3">
          <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
            Execution Trends
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            <span className="font-bold uppercase tracking-wide">No execution data available</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-foreground bg-card shadow-brutal">
      <div className="bg-brutal-blue border-b-2 border-foreground px-6 py-3">
        <h3 className="font-heading font-bold uppercase tracking-wide text-foreground">
          Execution Trends
        </h3>
      </div>
      <div className="p-6">
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="0"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                vertical={true}
              />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--foreground))"
                fontSize={12}
                fontWeight={600}
                fontFamily="var(--font-heading)"
                tickLine={true}
                axisLine={{ strokeWidth: 2 }}
              />
              <YAxis
                stroke="hsl(var(--foreground))"
                fontSize={12}
                fontWeight={600}
                fontFamily="var(--font-heading)"
                tickLine={true}
                axisLine={{ strokeWidth: 2 }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "2px solid hsl(var(--foreground))",
                  boxShadow: "var(--brutal-shadow)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                }}
                labelStyle={{
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              />
              <Legend
                wrapperStyle={{
                  fontFamily: "var(--font-heading)",
                  fontWeight: 700,
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              />
              <Area
                type="stepAfter"
                dataKey="success"
                name="Success"
                stroke="hsl(142, 76%, 36%)"
                strokeWidth={3}
                fillOpacity={1}
                fill="hsl(142, 76%, 56% / 0.25)"
              />
              <Area
                type="stepAfter"
                dataKey="error"
                name="Errors"
                stroke="hsl(0, 100%, 50%)"
                strokeWidth={3}
                fillOpacity={1}
                fill="hsl(0, 100%, 64% / 0.25)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
