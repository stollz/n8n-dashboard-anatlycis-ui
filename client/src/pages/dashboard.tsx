import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  Server,
  Search,
  CalendarIcon,
  X,
  Info,
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
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

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
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
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

  const hasActiveFilters = !!selectedWorkflow || !!selectedStatus || !!dateRange?.from || !!debouncedSearch;

  const clearFilters = () => {
    setSelectedWorkflow("");
    setSelectedStatus("");
    setDateRange(undefined);
    setSearchTerm("");
    setDebouncedSearch("");
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: [executionsQueryKey] });
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
    <div className="min-h-screen bg-background bg-dots">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b-3 border-foreground bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border-2 border-foreground bg-primary shadow-brutal-sm">
                <Activity className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="font-heading text-lg font-bold uppercase tracking-wide">
                  n8n Dashboard
                </h1>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                  Workflow Analytics
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
                  className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`}
                  strokeWidth={2.5}
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
          {/* No Instances */}
          {noInstances && (
            <div className="border-2 border-foreground bg-brutal-cyan shadow-brutal p-8 text-center">
              <div className="inline-block border-2 border-foreground bg-card p-4 shadow-brutal-sm mb-4">
                <Server className="h-10 w-10 text-foreground" strokeWidth={2} />
              </div>
              <h3 className="font-heading font-bold uppercase tracking-wide text-lg mb-1">No instances configured</h3>
              <p className="text-sm font-medium text-foreground/70">
                Click the gear icon above to add your first n8n instance.
              </p>
            </div>
          )}

          {/* Connection Error */}
          {hasError && !noInstances && (
            <div className="border-2 border-foreground bg-brutal-yellow shadow-brutal p-4">
              <div className="flex items-center gap-3">
                <div className="border-2 border-foreground bg-brutal-coral p-2 shadow-brutal-sm">
                  <Activity className="h-5 w-5 text-foreground" strokeWidth={2.5} />
                </div>
                <div>
                  <span className="font-heading font-bold uppercase tracking-wide">Connection Issue</span>
                  <p className="text-sm font-medium mt-0.5">
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
                          "h-10 w-52 flex items-center justify-between border-2 border-foreground bg-card px-3 text-sm font-medium shadow-brutal-sm disabled:opacity-50",
                          !selectedWorkflow && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {selectedWorkflow || "All workflows"}
                        </span>
                        <Search className="ml-2 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0 border-2 border-foreground shadow-brutal" align="start">
                      <Command filter={(value, search) =>
                        value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                      }>
                        <CommandInput placeholder="Search workflows..." className="font-medium" />
                        <CommandList>
                          <CommandEmpty className="py-4 text-center text-sm font-bold uppercase">No workflows found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="__all__"
                              onSelect={() => {
                                setSelectedWorkflow("");
                                setWorkflowOpen(false);
                              }}
                              className="font-medium"
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
                                className="font-medium"
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
                    <SelectTrigger className="h-10 w-40 text-sm">
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
                          "h-10 flex items-center border-2 border-foreground bg-card px-3 text-sm font-medium shadow-brutal-sm disabled:opacity-50",
                          !dateRange?.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" strokeWidth={2.5} />
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
                    <PopoverContent className="w-auto p-0 border-2 border-foreground shadow-brutal" align="start">
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
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={2.5} />
                    <Input
                      type="text"
                      placeholder="Search payloads..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={!selectedInstanceId}
                      className="h-10 w-52 pl-9 text-sm"
                    />
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="h-10 px-3 border-2 border-foreground bg-brutal-coral text-foreground font-bold text-xs uppercase tracking-wide shadow-brutal-sm brutal-press flex items-center gap-1"
                    >
                      <X className="h-4 w-4" strokeWidth={3} />
                      Clear
                    </button>
                  )}
                </div>
              </section>

              {/* Stats */}
              <section>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
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
                <div className="flex items-center gap-2 border-2 border-foreground bg-card px-4 py-2 shadow-brutal-sm">
                  <Info className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                  <span className="text-xs font-bold">
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
                />
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-3 border-foreground bg-card py-5 mt-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="font-heading font-bold uppercase tracking-wide text-sm">
              n8n Execution Dashboard
            </p>
            <div className="flex items-center gap-2">
              <div className="border-2 border-foreground bg-brutal-mint px-3 py-1 shadow-brutal-sm flex items-center gap-1.5">
                <Zap className="h-4 w-4" strokeWidth={2.5} />
                <span className="text-xs font-bold uppercase tracking-wide">Real-time monitoring</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
