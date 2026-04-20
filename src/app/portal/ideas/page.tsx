"use client";

import { Lightbulb } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { usePortalData } from "@/hooks/use-portal-data";
import { PortalShell } from "@/components/portal-shell";
import { useI18n } from "@/lib/i18n";
import type { Idea } from "@/lib/types";

const ideasApi = (id: string) => `/api/ideas?clientId=${id}`;

export default function PortalIdeas() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const { data: ideas, loading } = usePortalData<Idea>(effectiveClientId, ideasApi);

  const sorted = [...ideas].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return (
    <PortalShell
      icon={Lightbulb}
      title="Ideen"
      subtitle={`${ideas.length} Content-Ideen`}
      loading={authLoading || loading}
      isEmpty={ideas.length === 0}
      emptyMessage={t("portal.ideas.empty")}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
        {sorted.map((idea) => (
          <div key={idea.id} className="glass rounded-2xl p-5 space-y-3 card-hover">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-xl bg-blush-light/50 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb className="h-4 w-4 text-blush-dark" />
              </div>
              <p className="text-sm font-semibold text-ocean leading-snug">{idea.title}</p>
            </div>

            {idea.description && (
              <p className="text-xs text-ocean/60 leading-relaxed line-clamp-4">{idea.description}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {idea.contentType && (
                <span className="rounded-md text-[10px] px-2 py-0.5 bg-ocean/[0.04] text-ocean/55 border border-ocean/[0.06]">
                  {idea.contentType}
                </span>
              )}
              {idea.createdAt && (
                <span className="text-[10px] text-ocean/40 ml-auto">{idea.createdAt}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
