"use client";

import { useState } from "react";
import { FileText, ChevronDown, Copy, Check } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { usePortalData } from "@/hooks/use-portal-data";
import { PortalShell } from "@/components/portal-shell";
import { useI18n } from "@/lib/i18n";
import type { Script } from "@/lib/types";

const scriptsApi = (id: string) => `/api/scripts?clientId=${id}`;

export default function PortalScripts() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const { data: scripts, loading } = usePortalData<Script>(effectiveClientId, scriptsApi);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyScript = (script: Script) => {
    const text = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <PortalShell
      icon={FileText}
      title={t("portal.dash.scripts")}
      subtitle={`${scripts.length} ${t("portal.dash.scripts")}`}
      loading={authLoading || loading}
      isEmpty={scripts.length === 0}
      emptyMessage={t("portal.scripts.empty")}
    >
      <div className="space-y-3 stagger">
        {scripts.map(script => {
          const isExpanded = expandedId === script.id;
          return (
            <div key={script.id} className="glass rounded-2xl overflow-hidden card-hover">
              <button
                onClick={() => setExpandedId(isExpanded ? null : script.id)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-ocean break-words">{script.title || t("portal.scripts.untitled")}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {script.pillar && (
                      <span className="text-[10px] bg-ocean/[0.04] text-ocean/60 px-2 py-0.5 rounded-md font-medium">{script.pillar}</span>
                    )}
                    {script.format && (
                      <span className="text-[10px] bg-blush-light/50 text-ocean/60 px-2 py-0.5 rounded-md font-medium">{script.format}</span>
                    )}
                    {script.createdAt && (
                      <span className="text-[10px] text-ocean/35">{script.createdAt.slice(0, 10)}</span>
                    )}
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-ocean/30 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {isExpanded && (
                <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-ocean/[0.06] pt-4 animate-fade">
                  {script.hook && (
                    <ScriptSection label={t("portal.scripts.hook")} text={script.hook} />
                  )}
                  {script.body && (
                    <ScriptSection label={t("portal.scripts.body")} text={script.body} />
                  )}
                  {script.cta && (
                    <ScriptSection label={t("portal.scripts.cta")} text={script.cta} />
                  )}
                  <button
                    onClick={() => copyScript(script)}
                    className="flex items-center gap-1.5 text-xs text-ocean/50 hover:text-ocean transition-all btn-press rounded-lg px-2 py-1 -ml-2 hover:bg-ocean/[0.03]"
                  >
                    {copiedId === script.id ? (
                      <><Check className="h-3 w-3 text-green-500" /> {t("portal.scripts.copied")}</>
                    ) : (
                      <><Copy className="h-3 w-3" /> {t("portal.scripts.copy")}</>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PortalShell>
  );
}

function ScriptSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ocean/40 mb-1.5 font-medium">{label}</p>
      <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}
