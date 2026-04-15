"use client";

import { useEffect, useState } from "react";
import type { Config } from "@/lib/types";

// Module-level cache so navigation between pages doesn't refetch.
let cache: Config[] | null = null;
let inflight: Promise<Config[]> | null = null;
const subscribers = new Set<(c: Config[]) => void>();

async function load(): Promise<Config[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/configs")
    .then((r) => r.json())
    .then((d) => {
      cache = Array.isArray(d) ? d : [];
      inflight = null;
      subscribers.forEach((fn) => fn(cache!));
      return cache;
    })
    .catch(() => {
      inflight = null;
      return [];
    });
  return inflight;
}

export function invalidateClientsCache() {
  cache = null;
}

export function useClientsCache(): Config[] {
  const [clients, setClients] = useState<Config[]>(cache ?? []);

  useEffect(() => {
    subscribers.add(setClients);
    if (!cache) {
      load().then(setClients);
    }
    return () => { subscribers.delete(setClients); };
  }, []);

  return clients;
}

export function addClientToCache(client: Config) {
  cache = cache ? [...cache, client] : [client];
  subscribers.forEach((fn) => fn(cache!));
}
