import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInstance } from "@/lib/instance-context";
import { useState } from "react";
import { InstanceManageDialog } from "./instance-manage-dialog";

export function InstanceSelector() {
  const { instances, selectedInstanceId, setSelectedInstanceId, isLoading } = useInstance();
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedInstanceId ?? ""}
        onValueChange={setSelectedInstanceId}
        disabled={isLoading || instances.length === 0}
      >
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder={isLoading ? "Loading..." : "Select instance"} />
        </SelectTrigger>
        <SelectContent>
          {instances.map((inst) => (
            <SelectItem key={inst.id} value={inst.id}>
              {inst.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setManageOpen(true)}
        title="Manage instances"
      >
        <Settings className="h-4 w-4" />
      </Button>

      <InstanceManageDialog open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}
