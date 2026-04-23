"use client";

import { useEffect, useState } from "react";
import { Clock, Film } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { usePortalClient } from "../use-portal-client";
import { StoryStrategyDetail, type StoryStrategyContent } from "@/components/story-strategy-detail";

interface StrategyRow {
  id: string;
  content: StoryStrategyContent;
  created_at: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export default function PortalStoriesPage() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!effectiveClientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/configs/${effectiveClientId}/story-strategies`)
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStrategies(data);
          if (data.length > 0) setSelectedId(data[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [effectiveClientId, authLoading]);

  const selected = strategies.find(s => s.id === selectedId);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={Film}
        eyebrow="Content"
        title="Stories"
        subtitle="Deine Instagram Story Strategien"
      />

      {loading ? (
        <p className="text-sm text-ocean/50">Lädt…</p>
      ) : strategies.length === 0 ? (
        <div className="rounded-2xl border border-ocean/10 bg-white p-8 text-center">
          <Film className="h-8 w-8 text-ocean/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-ocean mb-1">Noch keine Story-Strategie</h3>
          <p className="text-sm text-ocean/60">Sobald dein Team eine Story-Strategie erstellt hat, erscheint sie hier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          <aside className="space-y-2">
            <p className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Historie</p>
            {strategies.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                type="button"
                className={`w-full text-left rounded-lg border p-3 transition ${
                  selectedId === s.id
                    ? "border-ocean/30 bg-ocean/[0.03]"
                    : "border-ocean/10 bg-white hover:border-ocean/20"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs text-ocean/60">
                  <Clock className="h-3 w-3" />
                  {fmtDate(s.created_at)}
                </div>
                <p className="text-sm text-ocean mt-1 line-clamp-2">
                  {s.content.campaign_plan?.objective || "Story-Strategie"}
                </p>
              </button>
            ))}
          </aside>

          <div className="space-y-6">
            {selected ? <StoryStrategyDetail content={selected.content} /> : (
              <p className="text-sm text-ocean/50">Wähle eine Strategie aus der Liste.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
