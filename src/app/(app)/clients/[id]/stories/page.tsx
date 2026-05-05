"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Film, MessageCircle } from "lucide-react";
import {
  StoryStrategyDetail,
  StoryStrategyListCard,
  type StoryStrategyContent,
} from "@/components/story-strategy-detail";

interface StrategyRow {
  id: string;
  content: StoryStrategyContent;
  created_at: string;
}

export default function StoriesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/configs/${clientId}/story-strategies`);
      const data = await res.json();
      const rows: StrategyRow[] = Array.isArray(data) ? data : [];
      setStrategies(rows);
      if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [clientId]);

  const handleDelete = async (strategyId: string) => {
    const res = await fetch(`/api/configs/${clientId}/story-strategies?strategyId=${strategyId}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedId === strategyId) setSelectedId(null);
      await load();
    }
  };

  // Filter out legacy rows that don't match the new shape — they'd render empty.
  const validStrategies = strategies.filter(s => s.content && Array.isArray(s.content.stories) && s.content.stories.length > 0);
  const selected = validStrategies.find(s => s.id === selectedId) || validStrategies[0];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {loading ? (
        <p className="text-sm text-ocean/50">Lädt…</p>
      ) : validStrategies.length === 0 ? (
        <div className="rounded-3xl border border-ocean/10 bg-white p-10 text-center max-w-2xl mx-auto">
          <Film className="h-8 w-8 text-ocean/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-ocean mb-1">Noch keine Story-Strategie</h3>
          <p className="text-sm text-ocean/60 mb-1">
            Story-Strategien werden im Content-Agent designed.
          </p>
          <p className="text-xs text-ocean/45 inline-flex items-center gap-1.5 mt-3">
            <MessageCircle className="h-3.5 w-3.5" />
            Sag dem Content-Agent z.B. „Bau Anna eine Story-Strategie für den Pitch der Authority Engine."
          </p>
        </div>
      ) : (
        <>
          {/* Strategien-Liste — horizontal scroll, kompakt oben */}
          <div>
            <p className="text-[10px] font-medium text-ocean/40 uppercase tracking-wider mb-2 px-1">
              Strategien · {validStrategies.length}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
              {validStrategies.map((s) => (
                <div key={s.id} className="shrink-0 w-[260px]">
                  <StoryStrategyListCard
                    content={s.content}
                    active={selected?.id === s.id}
                    onClick={() => setSelectedId(s.id)}
                    onDelete={() => handleDelete(s.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Detail — volle Breite, Tiles können richtig atmen */}
          <div>
            {selected ? (
              <StoryStrategyDetail
                content={selected.content}
                strategyId={selected.id}
                clientId={clientId}
                onContentUpdated={(next) => {
                  setStrategies((prev) =>
                    prev.map((s) => (s.id === selected.id ? { ...s, content: next } : s)),
                  );
                }}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
