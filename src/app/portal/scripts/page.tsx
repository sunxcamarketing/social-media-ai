"use client";

import { useEffect, useState } from "react";
import { FileText, ChevronDown, Copy, Check } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import type { Script } from "@/lib/types";

export default function PortalScripts() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveClientId) return;
    fetch(`/api/scripts?clientId=${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setScripts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveClientId]);

  const copyScript = (script: Script) => {
    const text = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (authLoading || loading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-light text-ocean flex items-center gap-2">
          <FileText className="h-5 w-5" /> Skripte
        </h1>
        <p className="text-xs text-ocean/50 mt-1">{scripts.length} Skripte</p>
      </div>

      {scripts.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-ocean/50">Noch keine Skripte vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map(script => {
            const isExpanded = expandedId === script.id;
            return (
              <div key={script.id} className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : script.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <div>
                    <h3 className="text-sm font-medium text-ocean">{script.title || "Ohne Titel"}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {script.pillar && (
                        <span className="text-[10px] bg-ocean/5 text-ocean/60 px-2 py-0.5 rounded">{script.pillar}</span>
                      )}
                      {script.format && (
                        <span className="text-[10px] bg-blush-light/60 text-ocean/60 px-2 py-0.5 rounded">{script.format}</span>
                      )}
                      {script.createdAt && (
                        <span className="text-[10px] text-ocean/40">{script.createdAt.slice(0, 10)}</span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-ocean/40 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-ocean/[0.06] pt-4">
                    {script.hook && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ocean/50 mb-1">Hook</p>
                        <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap">{script.hook}</p>
                      </div>
                    )}
                    {script.body && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ocean/50 mb-1">Body</p>
                        <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap">{script.body}</p>
                      </div>
                    )}
                    {script.cta && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ocean/50 mb-1">CTA</p>
                        <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap">{script.cta}</p>
                      </div>
                    )}
                    <button
                      onClick={() => copyScript(script)}
                      className="flex items-center gap-1.5 text-xs text-ocean/50 hover:text-ocean transition-colors"
                    >
                      {copiedId === script.id ? (
                        <><Check className="h-3 w-3 text-green-500" /> Kopiert</>
                      ) : (
                        <><Copy className="h-3 w-3" /> Skript kopieren</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
