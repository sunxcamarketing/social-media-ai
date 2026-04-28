"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Clock, Trash2, Film } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StoryStrategyDetail, type StoryStrategyContent } from "@/components/story-strategy-detail";

interface StrategyRow {
  id: string;
  content: StoryStrategyContent;
  created_at: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

// ── Page ──────────────────────────────────────────────────────────────────

export default function StoriesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/configs/${clientId}/story-strategies`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStrategies(data);
        if (data.length > 0) setSelectedId(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/configs/${clientId}/story-strategies`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unbekannter Fehler" }));
        setError(err.error || "Generierung fehlgeschlagen");
        return;
      }
      const saved = await res.json();
      await load();
      if (saved?.id) setSelectedId(saved.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerkfehler");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (strategyId: string) => {
    if (!confirm("Diese Strategie wirklich löschen?")) return;
    const res = await fetch(`/api/configs/${clientId}/story-strategies?strategyId=${strategyId}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      if (selectedId === strategyId) setSelectedId(null);
    }
  };

  const selected = strategies.find(s => s.id === selectedId);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={Film}
        eyebrow="Content"
        title="Stories"
        subtitle="Strategische Instagram Story Kampagnen"
        actions={
          strategies.length > 0 ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-ocean text-white px-4 py-2 text-sm font-medium hover:bg-ocean-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? "Generiere…" : "Neue Strategie"}
            </button>
          ) : null
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ocean/50">Lädt…</p>
      ) : strategies.length === 0 ? (
        <div className="rounded-2xl border border-ocean/10 bg-white p-8 text-center">
          <Film className="h-8 w-8 text-ocean/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-ocean mb-1">Noch keine Story-Strategie</h3>
          <p className="text-sm text-ocean/60 mb-4">Generiere die erste strategische Story-Kampagne für diesen Client.</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-ocean text-white px-4 py-2 text-sm font-medium hover:bg-ocean-light disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Generiere…" : "Jetzt generieren"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* History sidebar */}
          <aside className="space-y-1.5 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto pr-1">
            <p className="text-[10px] font-medium text-ocean/40 uppercase tracking-wider mb-2 px-1">
              Historie · {strategies.length}
            </p>
            {strategies.map(s => {
              const active = selectedId === s.id;
              return (
                <div key={s.id} className="group relative">
                  <button
                    onClick={() => setSelectedId(s.id)}
                    type="button"
                    className={`w-full text-left rounded-xl p-3 transition-all ${
                      active
                        ? "bg-blush-light/60 ring-1 ring-blush-dark/20"
                        : "bg-white border border-ocean/[0.06] hover:border-blush/30 hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-ocean/50 mb-1.5">
                      <Clock className="h-2.5 w-2.5" />
                      {fmtDate(s.created_at)}
                    </div>
                    <p className={`text-sm leading-snug line-clamp-2 pr-6 ${active ? "text-ocean font-medium" : "text-ocean/80"}`}>
                      {s.content.campaign_plan?.objective || "Story-Strategie"}
                    </p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    className="absolute top-2.5 right-2.5 h-6 w-6 rounded-md flex items-center justify-center text-ocean/30 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all"
                    title="Löschen"
                    type="button"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </aside>

          {/* Detail view */}
          <div>
            {selected ? (
              <StoryStrategyDetail content={selected.content} />
            ) : (
              <div className="rounded-2xl border border-ocean/[0.06] bg-white/60 p-10 text-center">
                <p className="text-sm text-ocean/50">Wähle eine Strategie aus der Liste.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

