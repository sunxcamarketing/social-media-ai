"use client";

import { useEffect, useState } from "react";

/**
 * Standard fetch pattern used by every read-only portal page:
 * wait for clientId, fetch from API, normalize to array, handle loading/error.
 *
 * Replaces the useEffect + useState + try/catch + setLoading boilerplate
 * that was duplicated across scripts, videos, analyses, and strategy pages.
 */
export function usePortalData<T>(
  clientId: string | null | undefined,
  apiPath: (id: string) => string,
): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetch(apiPath(clientId))
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [clientId, apiPath]);

  return { data, loading };
}
