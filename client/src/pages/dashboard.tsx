import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  RefreshCw,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { ExecutionChart } from "@/components/execution-chart";
import { StatusDistributionChart } from "@/components/status-distribution-chart";
import { ExecutionTable } from "@/components/execution-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstanceSelector } from "@/components/instance-selector";
import { useInstance } from "@/lib/instance-context";
import type { ExecutionLog, ExecutionStats, DailyStats } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const { selectedInstanceId, selectedInstance, instances, isLoading: instancesLoading } = useInstance();

  const {
    data: executions,
    isLoading: executionsLoading,
    error: executionsError,
    refetch: refetchExecutions,
  } = useQuery<ExecutionLog[]>({
    queryKey: [`/api/executions?instanceId=${selectedInstanceId}`],
    enabled: !!selectedInstanceId,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<ExecutionStats>({
    queryKey: [`/api/executions/stats?instanceId=${selectedInstanceId}`],
    enabled: !!selectedInstanceId,
  });

  const {
    data: dailyStats,
    isLoading: dailyLoading,
    error: dailyError,
  } = useQuery<DailyStats[]>({
    queryKey: [`/api/executions/daily?instanceId=${selectedInstanceId}`],
    enabled: !!selectedInstanceId,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/executions?instanceId=${selectedInstanceId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/executions/stats?instanceId=${selectedInstanceId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/executions/daily?instanceId=${selectedInstanceId}`] });
    refetchExecutions();
  };

  const formatDuration = (ms: number | undefined) => {
    if (!ms) return "0s";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const isLoading = executionsLoading || statsLoading || dailyLoading;
  const hasError = executionsError || statsError || dailyError;

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return "An error occurred while fetching data";
  };

  const noInstances = !instancesLoading && instances.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  n8n Execution Dashboard
                </h1>
                <p className="text-xs text-muted-foreground">
                  Workflow monitoring & analytics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <InstanceSelector />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || !selectedInstanceId}
                data-testid="button-refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {noInstances && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-8 text-center">
              <Server className="h-10 w-10 mx-auto mb-3 text-blue-500" />
              <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-1">No instances configured</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Click the gear icon above to add your first n8n instance.
              </p>
            </div>
          )}

          {hasError && !noInstances && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <Activity className="h-5 w-5" />
                <span className="font-medium">Connection Issue</span>
              </div>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Unable to connect to the selected instance. Check SSH and database credentials.
              </p>
            </div>
          )}

          {!noInstances && (
            <>
              <section>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Total Executions"
                    value={statsLoading ? "..." : stats?.totalExecutions ?? 0}
                    description="All time workflow runs"
                    icon={Activity}
                    variant="default"
                  />
                  <StatCard
                    title="Successful"
                    value={statsLoading ? "..." : stats?.successCount ?? 0}
                    description={statsLoading ? "Loading..." : `${stats?.successRate?.toFixed(1) ?? 0}% success rate`}
                    icon={CheckCircle2}
                    variant="success"
                  />
                  <StatCard
                    title="Failed"
                    value={statsLoading ? "..." : stats?.errorCount ?? 0}
                    description="Requires attention"
                    icon={XCircle}
                    variant="error"
                  />
                  <StatCard
                    title="Avg Duration"
                    value={statsLoading ? "..." : formatDuration(stats?.avgDurationMs)}
                    description="Average execution time"
                    icon={Clock}
                    variant="default"
                  />
                </div>
              </section>

              <section>
                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <ExecutionChart
                      data={dailyStats ?? []}
                      isLoading={dailyLoading}
                      error={dailyError ? getErrorMessage(dailyError) : null}
                    />
                  </div>
                  <div>
                    <StatusDistributionChart
                      stats={stats ?? null}
                      isLoading={statsLoading}
                      error={statsError ? getErrorMessage(statsError) : null}
                    />
                  </div>
                </div>
              </section>

              <section>
                <ExecutionTable
                  data={executions ?? []}
                  isLoading={executionsLoading}
                  error={executionsError ? getErrorMessage(executionsError) : null}
                  n8nBaseUrl={selectedInstance?.n8nBaseUrl}
                />
              </section>
            </>
          )}
        </div>
      </main>

      <footer className="border-t py-6 mt-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>n8n Execution Dashboard</p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Real-time monitoring
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
