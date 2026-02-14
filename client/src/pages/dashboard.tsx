import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Server,
  Search,
  CalendarIcon,
  X,
  Info,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { StatCard } from "@/components/stat-card";
import { ExecutionChart } from "@/components/execution-chart";
import { StatusDistributionChart } from "@/components/status-distribution-chart";
import { ExecutionTable } from "@/components/execution-table";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstanceSelector } from "@/components/instance-selector";
import { useInstance } from "@/lib/instance-context";
import type { ExecutionLog, ExecutionStats, DailyStats } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface SyncStatusData {
  instanceId: string;
  lastSyncedAt: string | null;
  lastSyncSuccess: boolean | null;
  lastSyncError: string | null;
  lastSyncRecordCount: number | null;
  updatedAt: string;
}

export default function Dashboard() {
  const { selectedInstanceId, selectedInstance, instances, isLoading: instancesLoading } = useInstance();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState("");
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 800);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Clear all filters when instance changes
  useEffect(() => {
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedWorkflow("");
    setSelectedStatus("");
    setDateRange(undefined);
  }, [selectedInstanceId]);

  // Build executions query URL with all filters
  const executionsQueryKey = (() => {
    const params = new URLSearchParams();
    params.set("instanceId", selectedInstanceId ?? "");
    if (selectedWorkflow) params.set("workflowName", selectedWorkflow);
    if (selectedStatus) params.set("status", selectedStatus);
    if (dateRange?.from) params.set("startDate", dateRange.from.toISOString());
    if (dateRange?.to) {
      const endOfDay = new Date(dateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      params.set("endDate", endOfDay.toISOString());
    }
    if (debouncedSearch) params.set("search", debouncedSearch);
    return `/api/executions?${params.toString()}`;
  })();

  const {
    data: executions,
    isLoading: executionsLoading,
    error: executionsError,
    refetch: refetchExecutions,
  } = useQuery<ExecutionLog[]>({
    queryKey: [executionsQueryKey],
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

  const { data: workflowNames = [] } = useQuery<string[]>({
    queryKey: [`/api/workflow-names?instanceId=${selectedInstanceId}`],
    enabled: !!selectedInstanceId,
  });

  const { data: syncStatusData } = useQuery<SyncStatusData | null>({
    queryKey: [`/api/sync-status?instanceId=${selectedInstanceId}`],
    enabled: !!selectedInstanceId,
    refetchInterval: 30_000,
  });

  const hasActiveFilters = !!selectedWorkflow || !!selectedStatus || !!dateRange?.from || !!debouncedSearch;

  const clearFilters = () => {
    setSelectedWorkflow("");
    setSelectedStatus("");
    setDateRange(undefined);
    setSearchTerm("");
    setDebouncedSearch("");
  };

  const handleRefresh = async () => {
    if (selectedInstanceId) {
      try {
        await apiRequest("POST", `/api/instances/${selectedInstanceId}/sync`);
      } catch {
        // Sync trigger failed — still refresh local data below
      }
    }
    queryClient.invalidateQueries({ queryKey: [executionsQueryKey] });
    queryClient.invalidateQueries({ queryKey: [`/api/executions/stats?instanceId=${selectedInstanceId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/executions/daily?instanceId=${selectedInstanceId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/sync-status?instanceId=${selectedInstanceId}`] });
    queryClient.invalidateQueries({ queryKey: [`/api/workflow-names?instanceId=${selectedInstanceId}`] });
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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Activity className="h-5 w-5 text-primary" />
              <h1 className="text-sm font-semibold">
                n8n Dashboard
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <InstanceSelector />
              {selectedInstanceId && syncStatusData && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs">
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    syncStatusData.lastSyncSuccess === false ? "bg-rose-500" : "bg-emerald-500"
                  )} />
                  <span className="text-muted-foreground">
                    {syncStatusData.lastSyncSuccess === false
                      ? `Sync error`
                      : syncStatusData.lastSyncedAt
                        ? `Synced ${formatDistanceToNow(new Date(syncStatusData.lastSyncedAt), { addSuffix: true })}`
                        : "Syncing..."}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading || !selectedInstanceId}
                data-testid="button-refresh"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* No Instances */}
          {noInstances && (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <Server className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-lg mb-1">No instances configured</h3>
              <p className="text-sm text-muted-foreground">
                Click the gear icon above to add your first n8n instance.
              </p>
            </div>
          )}

          {/* Connection Error */}
          {hasError && !noInstances && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <span className="font-medium text-rose-800 dark:text-rose-300">Connection Issue</span>
                  <p className="text-sm text-rose-700 dark:text-rose-400 mt-0.5">
                    Unable to connect to the selected instance. Check SSH and database credentials.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!noInstances && (
            <>
              {/* Filters */}
              <section>
                <div className="flex flex-wrap items-center gap-3">
                  <Popover open={workflowOpen} onOpenChange={setWorkflowOpen}>
                    <PopoverTrigger asChild>
                      <button
                        role="combobox"
                        aria-expanded={workflowOpen}
                        disabled={!selectedInstanceId}
                        className={cn(
                          "h-9 w-52 flex items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:opacity-50",
                          !selectedWorkflow && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {selectedWorkflow || "All workflows"}
                        </span>
                        <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command filter={(value, search) =>
                        value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                      }>
                        <CommandInput placeholder="Search workflows..." />
                        <CommandList>
                          <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">No workflows found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__all__"
                              onSelect={() => {
                                setSelectedWorkflow("");
                                setWorkflowOpen(false);
                              }}
                            >
                              All workflows
                            </CommandItem>
                            {workflowNames.map((name) => (
                              <CommandItem
                                key={name}
                                value={name}
                                onSelect={() => {
                                  setSelectedWorkflow(name);
                                  setWorkflowOpen(false);
                                }}
                              >
                                {name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <Select
                    value={selectedStatus}
                    onValueChange={(v) => setSelectedStatus(v === "__all__" ? "" : v)}
                    disabled={!selectedInstanceId}
                  >
                    <SelectTrigger className="h-9 w-40 text-sm">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All statuses</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="waiting">Waiting</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        disabled={!selectedInstanceId}
                        className={cn(
                          "h-9 flex items-center rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:opacity-50",
                          !dateRange?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "MMM d, yyyy")} –{" "}
                              {format(dateRange.to, "MMM d, yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "MMM d, yyyy")
                          )
                        ) : (
                          "Pick date range"
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        disabled={{ after: new Date() }}
                      />
                    </PopoverContent>
                  </Popover>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search all data..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={!selectedInstanceId}
                      className="h-9 w-52 pl-9 text-sm"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="h-9 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Clear
                    </button>
                  )}
                </div>
              </section>

              {/* Stats */}
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
                    variant="warning"
                  />
                </div>
              </section>

              {/* Logging info */}
              {stats?.firstExecutionAt && (
                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-2.5">
                  <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Logging since{" "}
                    <span className="font-mono">{format(new Date(stats.firstExecutionAt), "MMM d, yyyy 'at' HH:mm")}</span>
                    {" — "}only workflows executed after this time appear in the dashboard.
                  </span>
                </div>
              )}

              {/* Charts */}
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

              {/* Table */}
              <section>
                <ExecutionTable
                  data={executions ?? []}
                  isLoading={executionsLoading}
                  error={executionsError ? getErrorMessage(executionsError) : null}
                  n8nBaseUrl={selectedInstance?.n8nBaseUrl}
                  instanceId={selectedInstanceId ?? undefined}
                  searchTerm={debouncedSearch}
                />
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              n8n Execution Dashboard
            </p>
            <p className="text-sm text-muted-foreground">
              Auto-synced every 60s
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
