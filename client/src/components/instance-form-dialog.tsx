import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { N8nInstancePublic } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  n8nBaseUrl: z.string().url("Must be a valid URL").default("http://localhost:5678"),
  sshHost: z.string().min(1, "SSH host is required"),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  sshUser: z.string().min(1, "SSH user is required"),
  sshPrivateKeyPath: z.string().min(1, "SSH key path is required"),
  dbHost: z.string().min(1, "DB host is required").default("127.0.0.1"),
  dbPort: z.coerce.number().int().min(1).max(65535).default(5432),
  dbName: z.string().min(1, "DB name is required"),
  dbUser: z.string().min(1, "DB user is required"),
  dbPassword: z.string().min(1, "DB password is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface InstanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editInstance: N8nInstancePublic | null;
}

export function InstanceFormDialog({ open, onOpenChange, editInstance }: InstanceFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editInstance;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      n8nBaseUrl: "http://localhost:5678",
      sshHost: "",
      sshPort: 22,
      sshUser: "",
      sshPrivateKeyPath: "",
      dbHost: "127.0.0.1",
      dbPort: 5432,
      dbName: "",
      dbUser: "",
      dbPassword: "",
    },
  });

  useEffect(() => {
    if (open && editInstance) {
      form.reset({
        name: editInstance.name,
        n8nBaseUrl: editInstance.n8nBaseUrl,
        sshHost: editInstance.sshHost,
        sshPort: editInstance.sshPort,
        sshUser: editInstance.sshUser,
        sshPrivateKeyPath: "",
        dbHost: editInstance.dbHost,
        dbPort: editInstance.dbPort,
        dbName: editInstance.dbName,
        dbUser: editInstance.dbUser,
        dbPassword: "",
      });
    } else if (open && !editInstance) {
      form.reset({
        name: "",
        n8nBaseUrl: "http://localhost:5678",
        sshHost: "",
        sshPort: 22,
        sshUser: "",
        sshPrivateKeyPath: "",
        dbHost: "127.0.0.1",
        dbPort: 5432,
        dbName: "",
        dbUser: "",
        dbPassword: "",
      });
    }
  }, [open, editInstance]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isEditing) {
        const body: Record<string, unknown> = { ...values };
        if (!values.dbPassword) delete body.dbPassword;
        if (!values.sshPrivateKeyPath) delete body.sshPrivateKeyPath;
        await apiRequest("PUT", `/api/instances/${editInstance.id}`, body);
      } else {
        await apiRequest("POST", "/api/instances", values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instances"] });
      onOpenChange(false);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Instance" : "Add Instance"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* General Section */}
            <div className="border-2 border-foreground p-4 bg-card">
              <h4 className="font-heading font-bold text-sm uppercase tracking-wide mb-3 bg-brutal-blue inline-block px-2 py-0.5 border-2 border-foreground shadow-brutal-sm">General</h4>
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Instance Name</FormLabel>
                      <FormControl>
                        <Input placeholder="My n8n Instance" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="n8nBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">n8n Web UI URL</FormLabel>
                      <FormControl>
                        <Input placeholder="http://localhost:5678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SSH Section */}
            <div className="border-2 border-foreground p-4 bg-card">
              <h4 className="font-heading font-bold text-sm uppercase tracking-wide mb-3 bg-brutal-mint inline-block px-2 py-0.5 border-2 border-foreground shadow-brutal-sm">SSH Connection</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="sshHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Host</FormLabel>
                          <FormControl>
                            <Input placeholder="ssh.example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="sshPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Port</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="sshUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Username</FormLabel>
                      <FormControl>
                        <Input placeholder="ubuntu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sshPrivateKeyPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">
                        Private Key Path {isEditing && "(leave blank to keep current)"}
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="/home/user/.ssh/id_rsa" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Database Section */}
            <div className="border-2 border-foreground p-4 bg-card">
              <h4 className="font-heading font-bold text-sm uppercase tracking-wide mb-3 bg-brutal-yellow inline-block px-2 py-0.5 border-2 border-foreground shadow-brutal-sm">Database</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="dbHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Host</FormLabel>
                          <FormControl>
                            <Input placeholder="127.0.0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="dbPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Port</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="dbName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Database Name</FormLabel>
                      <FormControl>
                        <Input placeholder="n8n" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dbUser"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">Username</FormLabel>
                      <FormControl>
                        <Input placeholder="postgres" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dbPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-heading font-bold text-xs uppercase tracking-wide">
                        Password {isEditing && "(leave blank to keep current)"}
                      </FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="***" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {mutation.error && (
              <div className="border-2 border-foreground bg-brutal-coral/20 p-3">
                <p className="text-sm font-bold text-destructive">
                  {mutation.error instanceof Error ? mutation.error.message : "Failed to save"}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
