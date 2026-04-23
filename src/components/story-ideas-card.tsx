"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film, Sparkles, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface StoryConcept {
  hook?: string;
  value_or_proof?: string;
  cta?: string;
}

interface StrategyRow {
  id: string;
  content: {
    campaign_plan?: {
      story_concepts?: StoryConcept[];
    };
  };
  created_at: string;
}

interface StoryIdeasCardProps {
  clientId: string;
  /** "admin" links to /clients/[id]/stories, "portal" links to /portal/stories (future). */
  mode: "admin" | "portal";
}

export function StoryIdeasCard({ clientId, mode }: StoryIdeasCardProps) {
  const { t } = useI18n();
  const [strategies, setStrategies] = useState<StrategyRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/configs/${clientId}/story-strategies`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: StrategyRow[]) => { if (alive) setStrategies(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setStrategies([]); });
    return () => { alive = false; };
  }, [clientId]);

  const latest = strategies?.[0];
  const concepts = latest?.content?.campaign_plan?.story_concepts || [];
  const preview = concepts.slice(0, 3);
  const totalConcepts = strategies?.reduce((sum, s) => sum + (s.content?.campaign_plan?.story_concepts?.length || 0), 0) || 0;

  const href = mode === "admin" ? `/clients/${clientId}/stories` : "/portal/stories";

  return (
    <div className="rounded-2xl bg-white border border-ocean/[0.06] p-4 sm:p-5 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blush-light/60 flex items-center justify-center">
            <Film className="h-4 w-4 text-blush-dark" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ocean/50 font-medium">{t("storyIdeas.title")}</p>
            <p className="text-[11px] text-ocean/55">{t("storyIdeas.subtitle")}</p>
          </div>
        </div>
        {totalConcepts > 0 && (
          <span className="text-[10px] border rounded-md px-1.5 py-0.5 font-medium bg-ocean/[0.04] text-ocean/60 border-ocean/[0.08] tabular-nums">
            {totalConcepts}
          </span>
        )}
      </div>

      {strategies === null ? (
        <p className="text-sm text-ocean/40">{t("storyIdeas.loading")}</p>
      ) : preview.length === 0 ? (
        <div>
          <p className="text-sm text-ocean/55 leading-relaxed">{t("storyIdeas.empty")}</p>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-blush-dark hover:text-blush transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            {t("storyIdeas.generateCta")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div>
          <ul className="space-y-2.5">
            {preview.map((c, i) => (
              <li key={i} className="text-[13px] text-ocean/80 leading-snug line-clamp-2">
                <span className="inline-block mr-1.5 text-ocean/35 tabular-nums text-[11px]">{i + 1}.</span>
                {c.hook || "—"}
              </li>
            ))}
          </ul>
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-ocean/60 hover:text-ocean transition-colors"
          >
            {t("storyIdeas.viewAll")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
