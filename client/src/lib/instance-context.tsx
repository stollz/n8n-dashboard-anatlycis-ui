import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { N8nInstancePublic } from "@shared/schema";

interface InstanceContextValue {
  instances: N8nInstancePublic[];
  selectedInstanceId: string | null;
  selectedInstance: N8nInstancePublic | null;
  setSelectedInstanceId: (id: string | null) => void;
  isLoading: boolean;
}

const InstanceContext = createContext<InstanceContextValue | null>(null);

const STORAGE_KEY = "n8n-dashboard-selected-instance";

export function InstanceProvider({ children }: { children: ReactNode }) {
  const [selectedInstanceId, setSelectedInstanceIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const { data: instances = [], isLoading } = useQuery<N8nInstancePublic[]>({
    queryKey: ["/api/instances"],
  });

  // Auto-select first instance if none selected
  useEffect(() => {
    if (!isLoading && instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
    // Clear selection if the selected instance was deleted
    if (!isLoading && selectedInstanceId && instances.length > 0) {
      const exists = instances.some((i) => i.id === selectedInstanceId);
      if (!exists) {
        setSelectedInstanceId(instances[0].id);
      }
    }
  }, [instances, isLoading, selectedInstanceId]);

  function setSelectedInstanceId(id: string | null) {
    setSelectedInstanceIdState(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId) ?? null;

  return (
    <InstanceContext.Provider
      value={{
        instances,
        selectedInstanceId,
        selectedInstance,
        setSelectedInstanceId,
        isLoading,
      }}
    >
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstance() {
  const ctx = useContext(InstanceContext);
  if (!ctx) throw new Error("useInstance must be used within InstanceProvider");
  return ctx;
}
