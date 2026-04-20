"use client";

import { Search } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { usePortalData } from "@/hooks/use-portal-data";
import { PortalShell } from "@/components/portal-shell";
import { useI18n } from "@/lib/i18n";
import type { Analysis } from "@/lib/types";

const analysesApi = (id: string) => `/api/analyses?clientId=${id}`;

export default function PortalAnalyse() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const { data: analyses, loading } = usePortalData<Analysis>(effectiveClientId, analysesApi);
  const latest = analyses[0];

  return (
    <PortalShell
      icon={Search}
      title={t("portal.dash.audit")}
      loading={authLoading || loading}
      isEmpty={!latest}
      emptyMessage={t("portal.audit.empty")}
    >
      {latest && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Stat value={latest.profileFollowers?.toLocaleString() || "-"} label={t("portal.audit.followers")} />
            <Stat value={latest.profileReels30d || "-"} label={t("portal.audit.reels30d")} />
            <Stat value={latest.profileAvgViews30d?.toLocaleString() || "-"} label={t("portal.audit.avgViews30d")} />
          </div>

          {latest.report && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-semibold mb-4">{t("portal.audit.report")}</h2>
              <div className="prose prose-sm max-w-none text-ocean/80 leading-relaxed whitespace-pre-wrap">
                {latest.report}
              </div>
              {latest.createdAt && (
                <p className="text-[10px] text-ocean/40 mt-4">{t("portal.audit.createdAt", { date: latest.createdAt.slice(0, 10) })}</p>
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
