"use client";

import { usePortalClient } from "./use-portal-client";
import { ClientDashboardView } from "@/components/client-dashboard-view";

export default function PortalDashboard() {
  const { effectiveClientId, loading } = usePortalClient();

  if (loading || !effectiveClientId) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl bg-ocean/[0.04] animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-ocean/[0.04] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return <ClientDashboardView clientId={effectiveClientId} mode="portal" />;
}
