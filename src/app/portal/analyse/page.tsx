"use client";

import { Search } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { usePortalData } from "@/hooks/use-portal-data";
import { PortalShell } from "@/components/portal-shell";
import type { Analysis } from "@/lib/types";

const analysesApi = (id: string) => `/api/analyses?clientId=${id}`;

export default function PortalAnalyse() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const { data: analyses, loading } = usePortalData<Analysis>(effectiveClientId, analysesApi);
  const latest = analyses[0];

  return (
    <PortalShell
      icon={Search}
      title="Audit"
      loading={authLoading || loading}
      isEmpty={!latest}
      emptyMessage="Noch kein Audit vorhanden."
    >
      {latest && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Stat value={latest.profileFollowers?.toLocaleString() || "-"} label="Follower" />
            <Stat value={latest.profileReels30d || "-"} label="Reels (30d)" />
            <Stat value={latest.profileAvgViews30d?.toLocaleString() || "-"} label="⌀ Views (30d)" />
          </div>

          {latest.report && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-semibold mb-4">Audit-Bericht</h2>
              <div className="prose prose-sm max-w-none text-ocean/80 leading-relaxed whitespace-pre-wrap">
                {latest.report}
              </div>
              {latest.createdAt && (
                <p className="text-[10px] text-ocean/40 mt-4">Erstellt: {latest.createdAt.slice(0, 10)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </PortalShell>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <p className="text-2xl font-light text-ocean">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-ocean/50 mt-1">{label}</p>
    </div>
  );
}
