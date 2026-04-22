"use client";

import { useState } from "react";
import { Calendar, Film, TrendingUp, Info, RefreshCw, Loader2 } from "lucide-react";
import { motion } from "motion/react";

type PostDate = { datePosted?: string };

interface LastWeekActivityProps {
  /** Client's own scraped posts (e.g. from performanceInsights.recentPosts). */
  posts: PostDate[];
  /** Optional scrape date — to tell the user how fresh the numbers are. */
  scrapedAt?: string | null;
  /** Admin-only: client id for the refresh button. If set, renders "Aktualisieren". */
  clientId?: string;
  /** Called after a successful refresh so the parent can re-fetch client data. */
  onRefreshed?: () => void;
}

const DAY_SHORT_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function mondayOffsetDay(d: Date): number {
  // 0 = Monday ... 6 = Sunday
  return (d.getDay() + 6) % 7;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Builds a 7-day window ending yesterday (so "last week" excludes today
 * which isn't complete yet). Returns an array of Date objects, oldest first.
 */
function last7Days(): Date[] {
  const today = startOfDay(new Date());
  const days: Date[] = [];
  for (let i = 7; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

function parseIsoDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : startOfDay(d);
}

const STALE_SCRAPE_DAYS = 10;

export function LastWeekActivity({ posts, scrapedAt, clientId, onRefreshed }: LastWeekActivityProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!clientId || refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch(`/api/configs/${clientId}/refresh-posts`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(data.error || "Refresh fehlgeschlagen");
      } else {
        onRefreshed?.();
      }
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Refresh fehlgeschlagen");
    } finally {
      setRefreshing(false);
    }
  };

  const days = last7Days();
  const postedDates = new Set<number>();
  for (const p of posts) {
    const d = parseIsoDate(p.datePosted);
    if (d) postedDates.add(d.getTime());
  }

  const hits = days.filter((d) => postedDates.has(d.getTime())).length;
  const ratio = hits / 7;

  // If the scrape is older than the display window, the "0 posts" reading
  // is almost certainly a data-freshness artifact, not a real signal. Flag
  // it so the user doesn't misread the widget as "client isn't posting".
  const scrapeDate = parseIsoDate(scrapedAt || undefined);
  const daysSinceScrape = scrapeDate
    ? Math.floor((startOfDay(new Date()).getTime() - scrapeDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = daysSinceScrape !== null && daysSinceScrape >= STALE_SCRAPE_DAYS;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Reels / Posts */}
      <div className="rounded-2xl bg-white border border-ocean/[0.06] p-4 sm:p-5 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blush-light/60 flex items-center justify-center">
              <Film className="h-4 w-4 text-blush-dark" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ocean/50 font-medium">Reel / Post</p>
              <p className="text-[11px] text-ocean/55">letzte 7 Tage</p>
            </div>
          </div>
          {posts.length > 0 && !isStale && (
            <span className={`text-[10px] border rounded-md px-1.5 py-0.5 font-medium ${
              ratio >= 0.71 ? "bg-green-50 text-green-700 border-green-200"
              : ratio >= 0.43 ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-red-50 text-red-600 border-red-200"
            }`}>
              {ratio >= 0.71 ? "Stark" : ratio >= 0.43 ? "Okay" : "Wenig"}
            </span>
          )}
          {isStale && (
            <span className="text-[10px] border rounded-md px-1.5 py-0.5 font-medium bg-ocean/[0.04] text-ocean/60 border-ocean/[0.08]">
              veraltet
            </span>
          )}
          {clientId && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Posts neu scrapen"
              className="text-[10px] flex items-center gap-1 rounded-md border border-ocean/[0.08] bg-white hover:bg-warm-white/60 px-1.5 py-0.5 text-ocean/60 hover:text-ocean transition-colors disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Aktualisieren
            </button>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl font-light text-ocean tabular-nums"
          >
            {hits}
          </motion.p>
          <p className="text-sm text-ocean/55">von 7 Tagen</p>
        </div>

        {/* Week heatmap */}
        <div className="grid grid-cols-7 gap-1.5 mt-4">
          {days.map((d, i) => {
            const posted = postedDates.has(d.getTime());
            return (
              <motion.div
                key={d.getTime()}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.03 * i, duration: 0.25 }}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className={`h-6 w-full rounded-md border transition-all ${
                    posted
                      ? "bg-green-500/90 border-green-500"
                      : "bg-ocean/[0.03] border-ocean/[0.06]"
                  }`}
                  title={d.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}
                />
                <span className="text-[9px] text-ocean/40 font-medium">{DAY_SHORT_DE[mondayOffsetDay(d)]}</span>
              </motion.div>
            );
          })}
        </div>

        {posts.length === 0 && (
          <p className="mt-3 text-[11px] text-ocean/40 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Keine Post-Daten verfügbar — wurde der Audit schon gemacht?
          </p>
        )}
        {isStale && posts.length > 0 && (
          <p className="mt-3 text-[11px] text-amber-700/80 bg-amber-50/80 border border-amber-200/50 rounded-lg px-2.5 py-2 flex items-start gap-1.5 leading-relaxed">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>Daten sind {daysSinceScrape} Tage alt — die Zahl der Posts stimmt wahrscheinlich nicht. Klick &quot;Aktualisieren&quot; für frische Werte.</span>
          </p>
        )}
        {refreshError && (
          <p className="mt-3 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 flex items-start gap-1.5 leading-relaxed">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{refreshError}</span>
          </p>
        )}
        {scrapedAt && posts.length > 0 && (
          <p className="mt-3 text-[10px] text-ocean/35 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            gescraped {scrapedAt}
          </p>
        )}
      </div>

      {/* Stories — placeholder until we have a tracking source */}
      <div className="rounded-2xl bg-warm-white/60 border border-dashed border-ocean/[0.1] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-ocean/[0.04] flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-ocean/50" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ocean/50 font-medium">Story</p>
              <p className="text-[11px] text-ocean/55">letzte 7 Tage</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-ocean/55 leading-relaxed">
          Stories-Tracking ist noch nicht automatisch verfügbar — Apify liefert keine Story-Historie.
        </p>
        <p className="mt-2 text-[11px] text-ocean/40 leading-relaxed">
          Kommt sobald wir eine saubere Datenquelle haben.
        </p>
      </div>
    </div>
  );
}
