"use client";

import { Search } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { usePortalData } from "@/hooks/use-portal-data";
import { PortalShell } from "@/components/portal-shell";
import { AuditReport, type ProfileData } from "@/components/audit-report";
import { useI18n } from "@/lib/i18n";
import type { Analysis } from "@/lib/types";

const analysesApi = (id: string) => `/api/analyses?clientId=${id}`;

export default function PortalAnalyse() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const { data: analyses, loading } = usePortalData<Analysis>(effectiveClientId, analysesApi);
  const latest = analyses[0];

  const profile: ProfileData | null = latest
    ? {
        username: latest.instagramHandle || "",
        followers: latest.profileFollowers || 0,
        reelsCount30d: latest.profileReels30d || 0,
        avgViews30d: latest.profileAvgViews30d || 0,
        profilePicUrl: latest.profilePicUrl || undefined,
      }
    : null;

  return (
    <PortalShell
      icon={Search}
      title={t("portal.dash.audit")}
      loading={authLoading || loading}
      isEmpty={!latest}
      emptyMessage={t("portal.audit.empty")}
    >
      {latest && (
        <AuditReport
          report={latest.report || ""}
          profile={profile}
        />
      )}
    </PortalShell>
  );
}
