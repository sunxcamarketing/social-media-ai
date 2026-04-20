"use client";

import { useEffect, useState } from "react";

interface CurrentUser {
  id: string;
  email: string;
  role: "admin" | "client";
  clientId: string | null;
  impersonating: { clientId: string; clientName: string } | null;
}

let cached: CurrentUser | null = null;
let inflight: Promise<CurrentUser | null> | null = null;

function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch("/api/auth/me")
    .then((r) => r.json())
    .then((data) => {
      if (data.error) return null;
      cached = data as CurrentUser;
      return cached;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

/**
 * Returns the current user once resolved. `null` while loading or on error.
 * Response is cached in-module so multiple components don't re-fetch.
 */
export function useCurrentUser(): { user: CurrentUser | null; loading: boolean; isAdmin: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [loading, setLoading] = useState<boolean>(!cached);

  useEffect(() => {
    if (cached) return;
    let mounted = true;
    fetchCurrentUser().then((u) => {
      if (!mounted) return;
      setUser(u);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  return { user, loading, isAdmin: user?.role === "admin" };
}
