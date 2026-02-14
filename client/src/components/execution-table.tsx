import { useCallback, useMemo, useState } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/lib/theme-provider";
import type { ExecutionLog } from "@shared/schema";
import { format } from "date-fns";
import { AlertCircle, ExternalLink, Loader2 } from "lucide-react";

interface ExecutionTableProps {
  data: ExecutionLog[];
  isLoading?: boolean;
  error?: string | null;
  n8nBaseUrl?: string;
}

const StatusCellRenderer = (params: ICellRendererParams) => {
  const status = params.value as string;

  const colors: Record<string, string> = {
    success: "bg-brutal-mint border-foreground text-foreground",
    error: "bg-brutal-coral border-foreground text-foreground",
    running: "bg-brutal-blue border-foreground text-foreground",
    waiting: "bg-brutal-yellow border-foreground text-foreground",
    canceled: "bg-muted border-foreground text-foreground",
  };

  return (
    <span className={`inline-flex items-center border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${colors[status] || "bg-muted border-foreground"}`}>
      {status}
    </span>
  );
};

const DateCellRenderer = (params: ICellRendererParams) => {
  if (!params.value) return <span className="text-muted-foreground font-medium">-</span>;
  try {
    return (
      <span className="text-sm font-medium font-mono">
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
    return <span className="text-muted-foreground font-medium">-</span>;
  }
  let text = `${ms}ms`;
  if (ms >= 60000) text = `${(ms / 60000).toFixed(1)}m`;
  else if (ms >= 1000) text = `${(ms / 1000).toFixed(1)}s`;
  return <span className="font-mono font-bold">{text}</span>;
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
      className="inline-flex items-center gap-1 border-2 border-foreground bg-brutal-cyan px-2 py-1 text-xs font-bold uppercase tracking-wide shadow-brutal-sm brutal-press"
      onClick={(e) => {
        e.stopPropagation();
        window.open(url, "_blank");
      }}
      data-testid={`button-open-execution-${data.execution_id}`}
    >
      <ExternalLink className="h-3 w-3" strokeWidth={3} />
      Open
    </button>
  );
};

const ErrorNodeCellRenderer = (params: ICellRendererParams<ExecutionLog>) => {
  const execData = params.data?.execution_data as Record<string, unknown> | null;
  const lastNode = execData?.lastNodeExecuted as string | undefined;
  if (!lastNode) return <span className="text-muted-foreground font-medium">-</span>;
  return (
    <span className="text-sm font-bold text-destructive">{lastNode}</span>
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

function ExecutionDetailModal({
  execution,
  open,
  onOpenChange,
  n8nBaseUrl,
}: {
  execution: ExecutionLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  n8nBaseUrl?: string;
}) {
  if (!execution) return null;

  const execData = execution.execution_data as Record<string, unknown> | null;
  const lastNode = execData?.lastNodeExecuted as string | undefined;
  const n8nUrl = n8nBaseUrl
    ? `${n8nBaseUrl}/workflow/${execution.workflow_id}/executions/${execution.execution_id}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
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

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border-2 border-foreground p-3 bg-card">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Status</span>
                <div className="mt-1">
                  <Badge
                    variant={execution.status === "error" ? "destructive" : "default"}
                    className="capitalize"
                  >
                    {execution.status}
                  </Badge>
                </div>
              </div>
              <div className="border-2 border-foreground p-3 bg-card">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Mode</span>
                <p className="mt-1 font-bold">{execution.mode || "-"}</p>
              </div>
              <div className="border-2 border-foreground p-3 bg-card">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Started</span>
                <p className="mt-1 font-mono font-medium text-sm">{formatDate(execution.started_at)}</p>
              </div>
              <div className="border-2 border-foreground p-3 bg-card">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Finished</span>
                <p className="mt-1 font-mono font-medium text-sm">{formatDate(execution.finished_at)}</p>
              </div>
              <div className="border-2 border-foreground p-3 bg-card">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Duration</span>
                <p className="mt-1 font-heading font-bold text-lg">{formatDuration(execution.duration_ms)}</p>
              </div>
              <div className="border-2 border-foreground p-3 bg-card">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Nodes</span>
                <p className="mt-1 font-heading font-bold text-lg">{execution.node_count ?? "-"}</p>
              </div>
            </div>

            {lastNode && (
              <div className="border-2 border-foreground p-3 bg-brutal-coral/20">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Error Node</span>
                <p className="mt-1 font-bold text-destructive">
                  {lastNode}
                </p>
              </div>
            )}

            {execution.error_message && (
              <div className="border-2 border-foreground p-3 bg-brutal-coral/10">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Error Message</span>
                <pre className="mt-1 bg-foreground/5 border-2 border-foreground p-3 text-sm text-destructive whitespace-pre-wrap break-words font-mono">
                  {execution.error_message}
                </pre>
              </div>
            )}

            {execData && (
              <div>
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Execution Data</span>
                <pre className="mt-1 border-2 border-foreground bg-foreground/5 p-3 text-xs whitespace-pre-wrap break-words font-mono">
                  {JSON.stringify(execData, null, 2)}
                </pre>
              </div>
            )}

            {execution.workflow_data && (
              <div>
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Workflow Data</span>
                <pre className="mt-1 border-2 border-foreground bg-foreground/5 p-3 text-xs whitespace-pre-wrap break-words font-mono">
                  {JSON.stringify(execution.workflow_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

const lightTheme = themeQuartz.withParams({
  backgroundColor: "#FFFFFF",
  headerBackgroundColor: "#FF5C8A",
  headerTextColor: "#1A1A2E",
  oddRowBackgroundColor: "#FFFFFF",
  rowHoverColor: "#FFD43B40",
  borderColor: "#1A1A2E",
  textColor: "#1A1A2E",
  fontSize: 14,
  headerHeight: 52,
  rowHeight: 52,
  fontFamily: "Outfit, system-ui, sans-serif",
});

const darkTheme = themeQuartz.withParams({
  backgroundColor: "#1E1E38",
  headerBackgroundColor: "#FF7EB3",
  headerTextColor: "#1E1E38",
  oddRowBackgroundColor: "#1E1E38",
  rowHoverColor: "#FFE06640",
  borderColor: "#3D3D6B",
  textColor: "#F5EDD8",
  fontSize: 14,
  headerHeight: 52,
  rowHeight: 52,
  fontFamily: "Outfit, system-ui, sans-serif",
});

export function ExecutionTable({ data, isLoading, error, n8nBaseUrl }: ExecutionTableProps) {
  const { resolvedTheme } = useTheme();
  const [selectedExecution, setSelectedExecution] = useState<ExecutionLog | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const columnDefs = useMemo<ColDef[]>(
    () => [
      {
        headerName: "OPEN",
        field: "execution_id",
        cellRenderer: OpenCellRenderer,
        width: 110,
        minWidth: 110,
        maxWidth: 110,
        sortable: false,
        filter: false,
        resizable: false,
      },
      {
        field: "workflow_name",
        headerName: "WORKFLOW",
        flex: 2,
        minWidth: 200,
        filter: true,
        sortable: true,
      },
      {
        field: "status",
        headerName: "STATUS",
        flex: 1,
        minWidth: 130,
        cellRenderer: StatusCellRenderer,
        filter: true,
        sortable: true,
      },
      {
        field: "started_at",
        headerName: "STARTED",
        flex: 1.5,
        minWidth: 180,
        cellRenderer: DateCellRenderer,
        sortable: true,
      },
      {
        field: "duration_ms",
        headerName: "DURATION",
        flex: 1,
        minWidth: 100,
        cellRenderer: DurationCellRenderer,
        sortable: true,
      },
      {
        field: "mode",
        headerName: "MODE",
        flex: 1,
        minWidth: 100,
        filter: true,
        sortable: true,
        valueFormatter: (params) => params.value || "-",
      },
      {
        headerName: "ERROR NODE",
        field: "execution_data",
        flex: 1.2,
        minWidth: 130,
        cellRenderer: ErrorNodeCellRenderer,
        sortable: false,
        valueGetter: (params) => {
          const ed = params.data?.execution_data as Record<string, unknown> | null;
          return ed?.lastNodeExecuted ?? "";
        },
        filter: true,
      },
      {
        field: "error_message",
        headerName: "ERROR",
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
      <div className="border-2 border-foreground bg-card shadow-brutal">
        <div className="bg-primary border-b-2 border-foreground px-6 py-3">
          <h3 className="font-heading font-bold uppercase tracking-wide text-primary-foreground">
            Execution Logs
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[500px] flex items-center justify-center">
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
            Execution Logs
          </h3>
        </div>
        <div className="p-6">
          <div className="h-[500px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="border-2 border-foreground bg-brutal-yellow p-3 shadow-brutal-sm">
              <AlertCircle className="h-8 w-8 text-foreground" strokeWidth={2.5} />
            </div>
            <span className="font-bold uppercase">Unable to load execution logs</span>
            <span className="text-xs max-w-md text-center">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-2 border-foreground bg-card shadow-brutal">
        <div className="bg-primary border-b-2 border-foreground px-6 py-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold uppercase tracking-wide text-primary-foreground">
              Execution Logs
            </h3>
            <span className="text-xs font-heading font-bold uppercase tracking-wide text-primary-foreground/70">
              {data.length} records
            </span>
          </div>
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
      />
    </>
  );
}
