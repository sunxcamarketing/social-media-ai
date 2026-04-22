// ── Background Job: Lightweight Post Refresh ─────────────────────────────
// Scrapes Instagram post metadata (URL + date + views + likes) for a client.
// No Gemini video analysis — this is the cheap call, meant to run daily/weekly
// to keep the "last 7 days" activity widgets accurate without paying for
// full performance audits every time.
//
// Updates `performanceInsights.recentPosts` and `performanceInsights.scrapedAt`
// while PRESERVING the existing top30Days/topAllTime analyses (those are
// refreshed by the full performance route, which includes Gemini).

import { readConfig, updateConfig } from "../csv";
import { scrapeReels } from "../apify";
import { safeJsonParse } from "../safe-json";
import type { PerformanceInsights, RecentPost } from "@/app/api/configs/[id]/performance/route";

const SCRAPE_WINDOW_DAYS = 60; // enough history for weekly + monthly widgets
const MAX_POSTS = 50;

export interface RefreshPostsResult {
  clientId: string;
  handle: string;
  posts: number;
  status: "refreshed" | "no-handle" | "scrape-failed" | "skipped";
  reason?: string;
}

export async function refreshClientPosts(clientId: string): Promise<RefreshPostsResult> {
  const config = await readConfig(clientId);
  if (!config) {
    return { clientId, handle: "", posts: 0, status: "skipped", reason: "config not found" };
  }

  const rawHandle = config.instagram || "";
  const handle = rawHandle
    .replace(/^@/, "")
    .replace(/.*instagram\.com\/([^/?]+).*/, "$1")
    .replace(/\/$/, "")
    .trim();

  if (!handle) {
    return { clientId, handle: "", posts: 0, status: "no-handle" };
  }

  let reels;
  try {
    reels = await scrapeReels(handle, MAX_POSTS, SCRAPE_WINDOW_DAYS);
  } catch (err) {
    return {
      clientId,
      handle,
      posts: 0,
      status: "scrape-failed",
      reason: err instanceof Error ? err.message : "scrape error",
    };
  }

  const recentPosts: RecentPost[] = reels
    .filter((r) => r.timestamp && r.url)
    .map((r) => ({
      url: r.url,
      datePosted: r.timestamp.split("T")[0],
      views: r.videoPlayCount || 0,
      likes: r.likesCount || 0,
    }))
    .sort((a, b) => b.datePosted.localeCompare(a.datePosted));

  // Merge: keep the existing analyzed top30Days/topAllTime (expensive to
  // regenerate — Gemini calls) but overwrite scrapedAt + recentPosts.
  const existing = safeJsonParse<PerformanceInsights | null>(config.performanceInsights || "", null);
  const merged: PerformanceInsights = {
    scrapedAt: new Date().toISOString().slice(0, 10),
    scrapeWindowDays: SCRAPE_WINDOW_DAYS,
    top30Days: existing?.top30Days || [],
    topAllTime: existing?.topAllTime || [],
    recentPosts,
  };

  await updateConfig(clientId, { performanceInsights: JSON.stringify(merged) });

  return { clientId, handle, posts: recentPosts.length, status: "refreshed" };
}
