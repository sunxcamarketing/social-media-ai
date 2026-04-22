"use client";

import { useState } from "react";
import { FileText, ChevronDown, Copy, Check, Lightbulb } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { usePortalData } from "@/hooks/use-portal-data";
import { PortalShell } from "@/components/portal-shell";
import { useI18n } from "@/lib/i18n";
import type { Script, Idea } from "@/lib/types";

const scriptsApi = (id: string) => `/api/scripts?clientId=${id}`;
const ideasApi = (id: string) => `/api/ideas?clientId=${id}`;

type Tab = "scripts" | "ideas";

export default function PortalScripts() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const { data: scripts, loading: scriptsLoading } = usePortalData<Script>(effectiveClientId, scriptsApi);
  const { data: ideas, loading: ideasLoading } = usePortalData<Idea>(effectiveClientId, ideasApi);
  const [tab, setTab] = useState<Tab>("scripts");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loading = authLoading || (tab === "scripts" ? scriptsLoading : ideasLoading);
  const items = tab === "scripts" ? scripts : ideas;
  const sortedIdeas = [...ideas].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

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
      subtitle={tab === "scripts" ? `${scripts.length} ${t("portal.dash.scripts")}` : `${ideas.length} Ideen`}
      loading={loading}
      isEmpty={items.length === 0}
      emptyMessage={tab === "scripts" ? t("portal.scripts.empty") : t("portal.ideas.empty")}
      header={
        <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1 w-fit">
          <button
            onClick={() => setTab("scripts")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "scripts" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> {t("portal.dash.scripts")}
          </button>
          <button
            onClick={() => setTab("ideas")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              tab === "ideas" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" /> Ideen
          </button>
        </div>
      }
    >
      {tab === "scripts" ? (
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
                    {script.hook && <ScriptSection label={t("portal.scripts.hook")} text={script.hook} />}
                    {script.body && <ScriptSection label={t("portal.scripts.body")} text={script.body} />}
                    {script.cta && <ScriptSection label={t("portal.scripts.cta")} text={script.cta} />}
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
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
          {sortedIdeas.map((idea) => (
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
      )}
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
