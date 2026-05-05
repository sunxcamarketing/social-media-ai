"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
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
        const rows: StrategyRow[] = Array.isArray(data) ? data : [];
        setStrategies(rows);
        if (rows.length > 0) setSelectedId(rows[0].id);
      })
      .finally(() => setLoading(false));
  }, [effectiveClientId, authLoading]);

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
          <p className="text-sm text-ocean/60">
            Sobald dein Team eine Story-Strategie erstellt hat, erscheint sie hier.
          </p>
        </div>
      ) : (
        <>
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
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            {selected ? <StoryStrategyDetail content={selected.content} /> : null}
          </div>
        </>
      )}
    </div>
  );
}
