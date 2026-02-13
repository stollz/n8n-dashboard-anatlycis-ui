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
                <Plus className="h-4 w-4 mr-1" strokeWidth={3} />
                Add Instance
              </Button>
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={3} />
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <div className="border-2 border-foreground bg-brutal-lavender p-4 shadow-brutal mb-4">
                <Server className="h-10 w-10 text-foreground" strokeWidth={2} />
              </div>
              <p className="font-heading font-bold uppercase tracking-wide">No instances configured</p>
              <p className="text-xs mt-1 font-medium">Add an n8n instance to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((inst) => (
                <div key={inst.id} className="border-2 border-foreground bg-card shadow-brutal-sm p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-bold uppercase tracking-wide truncate">{inst.name}</h3>
                      <div className="text-xs text-muted-foreground font-mono mt-2 space-y-1">
                        <p>SSH: {inst.sshUser}@{inst.sshHost}:{inst.sshPort}</p>
                        <p>DB: {inst.dbUser}@{inst.dbHost}:{inst.dbPort}/{inst.dbName}</p>
                        <p>n8n: {inst.n8nBaseUrl}</p>
                      </div>
                      {testResult?.id === inst.id && (
                        <div className="mt-2">
                          <Badge variant={testResult.success ? "default" : "destructive"}>
                            {testResult.success ? "Connected" : `Failed: ${testResult.error}`}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        className="h-9 w-9 border-2 border-foreground bg-brutal-mint shadow-brutal-sm brutal-press flex items-center justify-center disabled:opacity-50 hover:brightness-110 transition-all"
                        onClick={() => handleTestConnection(inst.id)}
                        disabled={testingId === inst.id}
                        title="Test connection"
                      >
                        {testingId === inst.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={3} />
                        ) : (
                          <Plug className="h-4 w-4" strokeWidth={2.5} />
                        )}
                      </button>
                      <button
                        className="h-9 w-9 border-2 border-foreground bg-brutal-yellow shadow-brutal-sm brutal-press flex items-center justify-center hover:brightness-110 transition-all"
                        onClick={() => handleEdit(inst)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                      <button
                        className="h-9 w-9 border-2 border-foreground bg-brutal-coral shadow-brutal-sm brutal-press flex items-center justify-center disabled:opacity-50 hover:brightness-110 transition-all"
                        onClick={() => handleDelete(inst.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.5} />
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
