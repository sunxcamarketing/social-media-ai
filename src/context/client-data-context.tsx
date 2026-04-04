"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Config } from "@/lib/types";

interface ClientDataContextType {
  getClient: (id: string) => Config | null;
  loadClient: (id: string, force?: boolean) => Promise<Config>;
  invalidateClient: (id: string) => void;
}

const ClientDataContext = createContext<ClientDataContextType | null>(null);

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Map<string, Config>>(new Map());
  const inflight = useRef<Map<string, Promise<Config>>>(new Map());

  const getClient = useCallback((id: string): Config | null => {
    return clients.get(id) ?? null;
  }, [clients]);

  const loadClient = useCallback(async (id: string, force = false): Promise<Config> => {
    // Return cached if available and not forced
    if (!force) {
      const cached = clients.get(id);
      if (cached) return cached;
    }

    // Deduplicate in-flight requests
    const existing = inflight.current.get(id);
    if (existing) return existing;

    const promise = fetch(`/api/configs/${id}`)
      .then(r => r.json() as Promise<Config>)
      .then(config => {
        setClients(prev => new Map(prev).set(id, config));
        inflight.current.delete(id);
        return config;
      })
      .catch(err => {
        inflight.current.delete(id);
        throw err;
      });

    inflight.current.set(id, promise);
    return promise;
  }, [clients]);

  const invalidateClient = useCallback((id: string) => {
    setClients(prev => { const n = new Map(prev); n.delete(id); return n; });
  }, []);

  return (
    <ClientDataContext.Provider value={{ getClient, loadClient, invalidateClient }}>
      {children}
    </ClientDataContext.Provider>
  );
}

export function useClientData() {
  const ctx = useContext(ClientDataContext);
  if (!ctx) throw new Error("useClientData must be used within ClientDataProvider");
  return ctx;
}
