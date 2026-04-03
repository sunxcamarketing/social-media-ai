"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import type { Analysis } from "@/lib/types";

export default function PortalAnalyse() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveClientId) return;
    fetch(`/api/analyses?clientId=${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setAnalyses(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveClientId]);

  if (authLoading || loading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  const latest = analyses[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-light text-ocean flex items-center gap-2">
          <Search className="h-5 w-5" /> Audit
        </h1>
      </div>

      {!latest ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-ocean/50">Noch kein Audit vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-light text-ocean">{latest.profileFollowers?.toLocaleString() || "-"}</p>
              <p className="text-[10px] uppercase tracking-wider text-ocean/50 mt-1">Follower</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-light text-ocean">{latest.profileReels30d || "-"}</p>
              <p className="text-[10px] uppercase tracking-wider text-ocean/50 mt-1">Reels (30d)</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-light text-ocean">{latest.profileAvgViews30d?.toLocaleString() || "-"}</p>
              <p className="text-[10px] uppercase tracking-wider text-ocean/50 mt-1">&Oslash; Views (30d)</p>
            </div>
          </div>

          {/* Report */}
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
    </div>
  );
}
