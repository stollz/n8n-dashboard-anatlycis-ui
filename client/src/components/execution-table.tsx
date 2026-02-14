import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams, RowClickedEvent, themeQuartz } from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTheme } from "@/lib/theme-provider";
import type { ExecutionLog } from "@shared/schema";
import { format } from "date-fns";
import { AlertCircle, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";

interface ExecutionTableProps {
  data: ExecutionLog[];
  isLoading?: boolean;
  error?: string | null;
  n8nBaseUrl?: string;
  instanceId?: string;
}

const StatusCellRenderer = (params: ICellRendererParams) => {
  const status = params.value as string;

  const colors: Record<string, string> = {
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    error: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    waiting: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    canceled: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
};

const DateCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return <span className="text-muted-foreground">-</span>;
  try {
    return (
      <span className="text-sm font-mono">
        {format(new Date(params.value), "MMM dd, yyyy HH:mm:ss")}
      </span>
    );
  } catch {
    return <span className="text-muted-foreground">Invalid date</span>;
  }
};

const DurationCellRenderer = (params: ICellRendererParams) => {
  const ms = params.value as number | null;
  if (ms === null || ms === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }
  let text = `${ms}ms`;
  if (ms >= 60000) text = `${(ms / 60000).toFixed(1)}m`;
  else if (ms >= 1000) text = `${(ms / 1000).toFixed(1)}s`;
  return <span className="font-mono font-medium">{text}</span>;
};

const OpenCellRenderer = (params: ICellRendererParams<ExecutionLog>) => {
  const data = params.data;
  if (!data?.workflow_id || !data?.execution_id) {
    return <span className="text-muted-foreground">-</span>;
  }

  const baseUrl = params.context?.n8nBaseUrl || "http://localhost:5678";
  const url = `${baseUrl}/workflow/${data.workflow_id}/executions/${data.execution_id}`;

  return (
    <button
      className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-md px-2 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        window.open(url, "_blank");
      }}
      data-testid={`button-open-execution-${data.execution_id}`}
    >
      <ExternalLink className="h-3 w-3" />
      Open
    </button>
  );
};

const ErrorNodeCellRenderer = (params: ICellRendererParams<ExecutionLog>) => {
  const lastNode = params.data?.last_node_executed;
  if (!lastNode) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="text-sm font-medium text-destructive">{lastNode}</span>
  );
};

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return format(new Date(value), "MMM dd, yyyy HH:mm:ss");
  } catch {
    return "-";
  }
}

function formatDuration(ms: number | null) {
  if (ms === null || ms === undefined) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

interface NodeRunResult {
  name: string;
  status: string;
  executionTime: number;
  executionIndex: number;
  outputItemCount: number;
  rawRun: Record<string, unknown>;
  source: string | null;
  subExecution?: { workflowId: string; executionId: string };
}

function parseRunData(execData: Record<string, unknown>): NodeRunResult[] {
  const runData = execData.runData as Record<string, Array<Record<string, unknown>>> | undefined;
  if (!runData) return [];

  const nodes: NodeRunResult[] = [];
  for (const [nodeName, runs] of Object.entries(runData)) {
    const run = runs[0];
    if (!run) continue;

    // Count output items without extracting full data
    let outputItemCount = 0;
    const mainOutputs = (run.data as Record<string, unknown>)?.main as unknown[][] | undefined;
    if (mainOutputs) {
      for (const branch of mainOutputs) {
        if (Array.isArray(branch)) {
          for (const item of branch) {
            const json = (item as Record<string, unknown>)?.json;
            if (json && Object.keys(json as object).length > 0) {
              outputItemCount++;
            }
          }
        }
      }
    }

    const sourceArr = run.source as Array<Record<string, unknown>> | undefined;
    const metadata = run.metadata as Record<string, unknown> | undefined;

    nodes.push({
      name: nodeName,
      status: (run.executionStatus as string) || "unknown",
      executionTime: (run.executionTime as number) || 0,
      executionIndex: (run.executionIndex as number) ?? 999,
      outputItemCount,
      rawRun: run,
      source: sourceArr?.[0]?.previousNode as string | null ?? null,
      subExecution: metadata?.subExecution as { workflowId: string; executionId: string } | undefined,
    });
  }

  return nodes.sort((a, b) => a.executionIndex - b.executionIndex);
}

function extractOutputData(run: Record<string, unknown>): unknown[] {
  const mainOutputs = (run.data as Record<string, unknown>)?.main as unknown[][] | undefined;
  if (!mainOutputs) return [];
  const items: unknown[] = [];
  for (const branch of mainOutputs) {
    if (Array.isArray(branch)) {
      for (const item of branch) {
        const json = (item as Record<string, unknown>)?.json;
        if (json && Object.keys(json as object).length > 0) {
          items.push(json);
        }
      }
    }
  }
  return items;
}

function CollapsibleJson({ data, label }: { data: unknown; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const jsonStr = JSON.stringify(data, null, 2);
  const lineCount = jsonStr.split("\n").length;

  if (lineCount <= 3) {
    return (
      <pre className="bg-muted rounded-md p-2 text-xs whitespace-pre-wrap break-words font-mono">
        {jsonStr}
      </pre>
    );
  }

  return (
    <div>
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label} ({lineCount} lines)
      </button>
      {expanded && (
        <pre className="bg-muted rounded-md p-2 text-xs whitespace-pre-wrap break-words font-mono max-h-[300px] overflow-auto">
          {jsonStr}
        </pre>
      )}
    </div>
  );
}

function NodeRow({ node, n8nBaseUrl }: { node: NodeRunResult; n8nBaseUrl?: string }) {
  const [expanded, setExpanded] = useState(false);
  // Lazy: only extract output data when expanded
  const outputData = useMemo(
    () => (expanded ? extractOutputData(node.rawRun) : []),
    [expanded, node.rawRun]
  );
  const hasOutput = node.outputItemCount > 0;
  const statusColor =
    node.status === "success"
      ? "bg-emerald-500"
      : node.status === "error"
        ? "bg-rose-500"
        : "bg-amber-500";

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`h-2 w-2 rounded-full shrink-0 ${statusColor}`} />
        <span className="text-sm font-medium flex-1 truncate">{node.name}</span>
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {formatDuration(node.executionTime)}
        </span>
        {hasOutput && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {node.outputItemCount} item{node.outputItemCount !== 1 ? "s" : ""}
          </Badge>
        )}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-border bg-muted/20">
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
            <span>Status: <span className="text-foreground font-medium">{node.status}</span></span>
            {node.source && <span>From: <span className="text-foreground font-medium">{node.source}</span></span>}
            {node.subExecution && (
              <span>
                Sub-workflow:{" "}
                {n8nBaseUrl ? (
                  <a
                    href={`${n8nBaseUrl}/workflow/${node.subExecution.workflowId}/executions/${node.subExecution.executionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    #{node.subExecution.executionId}
                  </a>
                ) : (
                  <span className="text-foreground font-medium">#{node.subExecution.executionId}</span>
                )}
              </span>
            )}
          </div>

          {outputData.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Output</span>
              {outputData.map((item, i) => (
                <CollapsibleJson key={i} data={item} label={`Item ${i + 1}`} />
              ))}
            </div>
          )}

          {!hasOutput && (
            <p className="text-xs text-muted-foreground italic pt-1">No output data</p>
          )}
        </div>
      )}
    </div>
  );
}

function NodeExecutionTimeline({ nodes, n8nBaseUrl }: { nodes: NodeRunResult[]; n8nBaseUrl?: string }) {
  return (
    <div className="space-y-1">
      {nodes.map((node, idx) => (
        <NodeRow key={idx} node={node} n8nBaseUrl={n8nBaseUrl} />
      ))}
    </div>
  );
}

function ExecutionDetailModal({
  execution,
  open,
  onOpenChange,
  n8nBaseUrl,
  instanceId,
}: {
  execution: ExecutionLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  n8nBaseUrl?: string;
  instanceId?: string;
}) {
  const [showRawData, setShowRawData] = useState(false);
  // Lazy-load full execution detail (with JSONB data) only when modal opens
  const { data: detail, isLoading: detailLoading, error: detailError } = useQuery<ExecutionLog>({
    queryKey: [`/api/executions/${execution?.id}/detail?instanceId=${instanceId}`],
    enabled: open && !!execution?.id && !!instanceId,
  });

  if (!execution) return null;

  const execData = detail?.execution_data as Record<string, unknown> | null;
  const lastNode = execution.last_node_executed;
  const n8nUrl = n8nBaseUrl
    ? `${n8nBaseUrl}/workflow/${execution.workflow_id}/executions/${execution.execution_id}`
    : null;

  const nodeResults = execData ? parseRunData(execData) : [];
  const workflowData = detail?.workflow_data as Record<string, unknown> | null;
  const workflowNodes = (workflowData?.nodes as Array<Record<string, unknown>>) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] !flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="pr-6">
            {execution.workflow_name}
            {n8nUrl && (
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => window.open(n8nUrl, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in n8n
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Execution #{execution.execution_id}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 min-h-0">
          <div className="space-y-4 pb-4">
            {/* Summary grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <div className="mt-1">
                  <Badge
                    variant={execution.status === "error" ? "destructive" : execution.status === "success" ? "success" : "default"}
                    className="capitalize"
                  >
                    {execution.status}
                  </Badge>
                </div>
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Mode</span>
                <p className="mt-1 font-medium">{execution.mode || "-"}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Started</span>
                <p className="mt-1 font-mono text-sm">{formatDate(execution.started_at)}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Finished</span>
                <p className="mt-1 font-mono text-sm">{formatDate(execution.finished_at)}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Duration</span>
                <p className="mt-1 font-mono font-semibold text-lg">{formatDuration(execution.duration_ms)}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Nodes</span>
                <p className="mt-1 font-mono font-semibold text-lg">{execution.node_count ?? "-"}</p>
              </div>
            </div>

            {/* Error info */}
            {execution.status === "error" && lastNode && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Error Node</span>
                <p className="mt-1 font-medium text-destructive">{lastNode}</p>
              </div>
            )}

            {execution.error_message && (
              <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-md p-3">
                <span className="text-xs font-medium text-muted-foreground">Error Message</span>
                <pre className="mt-1 bg-muted rounded-md p-3 text-sm text-destructive whitespace-pre-wrap break-words font-mono">
                  {execution.error_message}
                </pre>
              </div>
            )}

            {/* Node execution detail section */}
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Node Execution {nodeResults.length > 0 ? `(${nodeResults.length} nodes)` : ""}
              </span>

              {detailLoading && (
                <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/30 p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading node execution data...</span>
                </div>
              )}

              {detailError && (
                <div className="mt-2 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-3">
                  <p className="text-sm text-destructive">
                    Failed to load execution details: {detailError instanceof Error ? detailError.message : "Unknown error"}
                  </p>
                </div>
              )}

              {!detailLoading && !detailError && detail && nodeResults.length === 0 && (
                <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-sm text-muted-foreground">No node execution data available</p>
                  {execData && (
                    <pre className="mt-2 bg-muted rounded-md p-3 text-xs whitespace-pre-wrap break-words font-mono max-h-[400px] overflow-auto">
                      {JSON.stringify(execData, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {nodeResults.length > 0 && (
                <div className="mt-2">
                  <NodeExecutionTimeline nodes={nodeResults} n8nBaseUrl={n8nBaseUrl} />
                </div>
              )}
            </div>

            {/* Workflow nodes summary */}
            {workflowNodes.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">Workflow Nodes</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {workflowNodes.map((wn, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                    >
                      <span className="font-medium">{wn.name as string}</span>
                      <span className="text-muted-foreground">{(wn.type as string)?.replace("n8n-nodes-base.", "")}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Raw JSON toggle */}
            {(execData || workflowData) && (
              <div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                  onClick={() => setShowRawData(!showRawData)}
                >
                  {showRawData ? "Hide" : "Show"} raw JSON
                </button>

                {showRawData && (
                  <div className="mt-2 space-y-3">
                    {execData && (
                      <CollapsibleJson data={execData} label="Execution Data" />
                    )}
                    {workflowData && (
                      <CollapsibleJson data={workflowData} label="Workflow Data" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const lightTheme = themeQuartz.withParams({
  backgroundColor: "#FFFFFF",
  headerBackgroundColor: "#F4F4F5",
  headerTextColor: "#18181B",
  oddRowBackgroundColor: "#FFFFFF",
  rowHoverColor: "#F4F4F550",
  borderColor: "#E4E4E7",
  textColor: "#18181B",
  fontSize: 13,
  headerHeight: 44,
  rowHeight: 44,
  fontFamily: "Inter, system-ui, sans-serif",
});

const darkTheme = themeQuartz.withParams({
  backgroundColor: "#0C0F1A",
  headerBackgroundColor: "#1A1F36",
  headerTextColor: "#E4E4E7",
  oddRowBackgroundColor: "#0C0F1A",
  rowHoverColor: "#1A1F3650",
  borderColor: "#27273A",
  textColor: "#E4E4E7",
  fontSize: 13,
  headerHeight: 44,
  rowHeight: 44,
  fontFamily: "Inter, system-ui, sans-serif",
});

export function ExecutionTable({ data, isLoading, error, n8nBaseUrl, instanceId }: ExecutionTableProps) {
  const { resolvedTheme } = useTheme();
  const [selectedExecution, setSelectedExecution] = useState<ExecutionLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "Open",
        field: "execution_id",
        cellRenderer: OpenCellRenderer,
        width: 100,
        minWidth: 100,
        maxWidth: 100,
        sortable: false,
        filter: false,
        resizable: false,
      },
      {
        field: "workflow_name",
        headerName: "Workflow",
        flex: 2,
        minWidth: 200,
        filter: true,
        sortable: true,
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        minWidth: 130,
        cellRenderer: StatusCellRenderer,
        filter: true,
        sortable: true,
      },
      {
        field: "started_at",
        headerName: "Started",
        flex: 1.5,
        minWidth: 180,
        cellRenderer: DateCellRenderer,
        sortable: true,
      },
      {
        field: "duration_ms",
        headerName: "Duration",
        flex: 1,
        minWidth: 100,
        cellRenderer: DurationCellRenderer,
        sortable: true,
      },
      {
        field: "mode",
        headerName: "Mode",
        flex: 1,
        minWidth: 100,
        filter: true,
        sortable: true,
        valueFormatter: (params) => params.value || "-",
      },
      {
        headerName: "Error node",
        field: "last_node_executed",
        flex: 1.2,
        minWidth: 130,
        cellRenderer: ErrorNodeCellRenderer,
        sortable: true,
        filter: true,
      },
      {
        field: "error_message",
        headerName: "Error",
        flex: 2,
        minWidth: 200,
        tooltipField: "error_message",
        valueFormatter: (params) => params.value || "-",
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
    }),
    []
  );

  const getRowClass = useCallback((params: { data: ExecutionLog | undefined }) => {
    if (params.data?.status === "error") {
      return "bg-red-500/5";
    }
    return "";
  }, []);

  const onRowClicked = useCallback((event: RowClickedEvent<ExecutionLog>) => {
    if (event.data) {
      setSelectedExecution(event.data);
      setModalOpen(true);
    }
  }, []);

  const gridTheme = resolvedTheme === "dark" ? darkTheme : lightTheme;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Execution Logs
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[500px] flex items-center justify-center">
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
            Execution Logs
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[500px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <AlertCircle className="h-6 w-6" />
            <span className="text-sm font-medium">Unable to load execution logs</span>
            <span className="text-xs max-w-md text-center">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Execution Logs
          </h3>
          <span className="text-xs text-muted-foreground">
            {data.length} records
          </span>
        </div>
        <div className="h-[500px] w-full cursor-pointer" data-testid="execution-table">
          <AgGridReact
            rowData={data}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowClass={getRowClass}
            context={{ n8nBaseUrl }}
            animateRows={true}
            pagination={true}
            paginationPageSize={10}
            paginationPageSizeSelector={[10, 25, 50, 100]}
            domLayout="normal"
            suppressMovableColumns={true}
            theme={gridTheme}
            onRowClicked={onRowClicked}
          />
        </div>
      </div>

      <ExecutionDetailModal
        execution={selectedExecution}
        open={modalOpen}
        onOpenChange={setModalOpen}
        n8nBaseUrl={n8nBaseUrl}
        instanceId={instanceId}
      />
    </>
  );
}
