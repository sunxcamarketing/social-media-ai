"use client";

import { useEffect, useState } from "react";
import { BarChart2, Target } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { PortalShell } from "@/components/portal-shell";
import { safeJsonParse } from "@/lib/safe-json";
import { useI18n } from "@/lib/i18n";
import type { Config } from "@/lib/types";

interface Pillar { name: string; subtopics?: string[]; videoIdeas?: { title: string }[]; }
interface WeeklyEntry { day: string; pillar?: string; contentType?: string; format?: string; title?: string; }

export default function PortalStrategy() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [client, setClient] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveClientId) return;
    fetch(`/api/configs/${effectiveClientId}`)
      .then(r => r.json())
      .then(setClient)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveClientId]);

  const hasStrategy = Boolean(client?.strategyGoal || client?.strategyPillars);
  const pillars = safeJsonParse<Pillar[]>(client?.strategyPillars, []);
  const weekly = safeJsonParse<WeeklyEntry[]>(client?.strategyWeekly, []);

  return (
    <PortalShell
      icon={BarChart2}
      title={t("portal.dash.strategy")}
      loading={authLoading || loading}
      isEmpty={!hasStrategy}
      emptyMessage={t("portal.strategy.empty")}
    >
      <div className="space-y-6">
        {client?.strategyGoal && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-blush-dark" /> {t("portal.strategy.goal")}
            </h2>
            <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap">{client.strategyGoal}</p>
          </div>
        )}

        {pillars.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4">{t("portal.strategy.pillars")}</h2>
            <div className="space-y-4">
              {pillars.map((p, i) => (
                <div key={i} className="border border-ocean/[0.06] rounded-xl p-4">
                  <h3 className="text-sm font-medium text-ocean mb-2">{p.name}</h3>
                  {p.subtopics && p.subtopics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.subtopics.map((st, j) => (
                        <span key={j} className="text-[11px] bg-ocean/5 text-ocean/70 px-2 py-0.5 rounded">{st}</span>
                      ))}
                    </div>
                  )}
                  {p.videoIdeas && p.videoIdeas.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {p.videoIdeas.map((vi, j) => (
                        <p key={j} className="text-xs text-ocean/60">- {vi.title}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {weekly.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold mb-4">{t("portal.strategy.weeklyPlan")}</h2>
            <div className="space-y-2">
              {weekly.map((w, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-ocean/[0.04] last:border-0">
                  <span className="text-xs font-medium text-ocean/50 w-20">{w.day}</span>
                  <span className="text-ocean flex-1">{w.title || w.contentType || "-"}</span>
                  {w.pillar && <span className="text-[10px] bg-ocean/5 text-ocean/60 px-2 py-0.5 rounded">{w.pillar}</span>}
                  {w.format && <span className="text-[10px] bg-blush-light/60 text-ocean/60 px-2 py-0.5 rounded">{w.format}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
