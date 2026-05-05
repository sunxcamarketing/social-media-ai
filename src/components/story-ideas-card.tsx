"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film, Sparkles, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { StoryStrategyContent } from "@/components/story-strategy-detail";

interface StrategyRow {
  id: string;
  content: StoryStrategyContent;
  created_at: string;
}

interface StoryIdeasCardProps {
  clientId: string;
  /** "admin" links to /clients/[id]/stories, "portal" links to /portal/stories. */
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

  // Only count strategies in the new shape (have a stories array).
  const validStrategies = (strategies || []).filter(s => Array.isArray(s.content?.stories) && s.content.stories.length > 0);
  const latest = validStrategies[0];
  const previewTitles = validStrategies.slice(0, 3).map(s => s.content.title || "Strategie");
  const total = validStrategies.length;

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
        {total > 0 && (
          <span className="text-[10px] border rounded-md px-1.5 py-0.5 font-medium bg-ocean/[0.04] text-ocean/60 border-ocean/[0.08] tabular-nums">
            {total}
          </span>
        )}
      </div>

      {strategies === null ? (
        <p className="text-sm text-ocean/40">{t("storyIdeas.loading")}</p>
      ) : !latest ? (
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
            {previewTitles.map((title, i) => (
              <li key={i} className="text-[13px] text-ocean/80 leading-snug line-clamp-2">
                <span className="inline-block mr-1.5 text-ocean/35 tabular-nums text-[11px]">{i + 1}.</span>
                {title}
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
