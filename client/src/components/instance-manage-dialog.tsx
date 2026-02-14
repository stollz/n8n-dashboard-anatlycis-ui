import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Plug, Loader2, Server } from "lucide-react";
import type { N8nInstancePublic } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { InstanceFormDialog } from "./instance-form-dialog";

interface InstanceManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstanceManageDialog({ open, onOpenChange }: InstanceManageDialogProps) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editInstance, setEditInstance] = useState<N8nInstancePublic | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; error?: string } | null>(null);

  const { data: instances = [], isLoading } = useQuery<N8nInstancePublic[]>({
    queryKey: ["/api/instances"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/instances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
    },
  });

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", `/api/instances/${id}/test-connection`);
      const data = await res.json();
      setTestResult({ id, ...data });
    } catch (err) {
      setTestResult({
        id,
        success: false,
        error: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleEdit = (inst: N8nInstancePublic) => {
    setEditInstance(inst);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditInstance(null);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this instance?")) {
      deleteMutation.mutate(id);
      if (testResult?.id === id) setTestResult(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Manage Instances</span>
              <Button size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1" />
                Add Instance
              </Button>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Server className="h-10 w-10 mb-3" />
              <p className="font-medium">No instances configured</p>
              <p className="text-sm mt-1">Add an n8n instance to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((inst) => (
                <div key={inst.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold truncate">{inst.name}</h3>
                      <div className="text-xs text-muted-foreground font-mono mt-2 space-y-1">
                        <p>SSH: {inst.sshUser}@{inst.sshHost}:{inst.sshPort}</p>
                        <p>DB: {inst.dbUser}@{inst.dbHost}:{inst.dbPort}/{inst.dbName}</p>
                        <p>n8n: {inst.n8nBaseUrl}</p>
                      </div>
                      {testResult?.id === inst.id && (
                        <div className="mt-2">
                          <Badge variant={testResult.success ? "success" : "destructive"}>
                            {testResult.success ? "Connected" : `Failed: ${testResult.error}`}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center disabled:opacity-50 hover:bg-accent transition-colors"
                        onClick={() => handleTestConnection(inst.id)}
                        disabled={testingId === inst.id}
                        title="Test connection"
                      >
                        {testingId === inst.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plug className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors"
                        onClick={() => handleEdit(inst)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="h-8 w-8 rounded-md border border-border bg-background flex items-center justify-center disabled:opacity-50 hover:bg-accent transition-colors text-rose-500"
                        onClick={() => handleDelete(inst.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <InstanceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editInstance={editInstance}
      />
    </>
  );
}
