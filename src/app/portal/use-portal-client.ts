"use client";

import { useEffect, useState } from "react";

interface PortalUser {
  id: string;
  email: string;
  role: "admin" | "client";
  clientId: string | null;
  impersonatingClientId: string | null;
}

export function usePortalClient() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setUser(null);
        } else {
          setUser(data);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Effective client ID: for clients it's their clientId, for impersonating admins it's the impersonated one
  const effectiveClientId = user?.role === "client"
    ? user.clientId
    : user?.impersonatingClientId || null;

  return { user, loading, effectiveClientId };
}
