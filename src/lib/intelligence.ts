// ── Intelligence Snapshots ─────────────────────────────────────────────────
// CRUD for background research results stored in Supabase.
// Snapshots are pre-computed and ready when the pipeline runs.

import { supabase } from "./supabase";

export type SnapshotType = "competitor_refresh" | "web_trends" | "performance_feedback";

export interface IntelligenceSnapshot {
  id: string;
  clientId: string;
  type: SnapshotType;
  platform: string;
  data: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

// Default expiry: 7 days
const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Save a snapshot (upserts by replacing the latest of same type/platform).
 */
export async function saveSnapshot(
  clientId: string,
  type: SnapshotType,
  data: Record<string, unknown>,
  options?: { platform?: string; expiryDays?: number },
): Promise<void> {
  const platform = options?.platform || "instagram";
  const expiryDays = options?.expiryDays || DEFAULT_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("intelligence_snapshots").insert({
    client_id: clientId,
    type,
    platform,
    data,
    expires_at: expiresAt,
  });
}

/**
 * Get the latest snapshot of a given type for a client.
 */
export async function getLatestSnapshot(
  clientId: string,
  type: SnapshotType,
  platform = "instagram",
): Promise<IntelligenceSnapshot | null> {
  const { data, error } = await supabase
    .from("intelligence_snapshots")
    .select("*")
    .eq("client_id", clientId)
    .eq("type", type)
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    clientId: data.client_id,
    type: data.type,
    platform: data.platform,
    data: data.data as Record<string, unknown>,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

/**
 * Get freshness info for all snapshot types for a client.
 */
export async function getSnapshotFreshness(clientId: string, platform = "instagram"): Promise<
  Record<SnapshotType, { createdAt: string; fresh: boolean } | null>
> {
  const types: SnapshotType[] = ["competitor_refresh", "web_trends", "performance_feedback"];
  const freshnessDays: Record<SnapshotType, number> = {
    competitor_refresh: 5,
    web_trends: 3,
    performance_feedback: 7,
  };

  const results = await Promise.all(
    types.map(async (type) => {
      const snap = await getLatestSnapshot(clientId, type, platform);
      if (!snap) return [type, null] as const;
      const ageDays = (Date.now() - new Date(snap.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      return [type, { createdAt: snap.createdAt, fresh: ageDays < freshnessDays[type] }] as const;
    }),
  );

  return Object.fromEntries(results) as Record<SnapshotType, { createdAt: string; fresh: boolean } | null>;
}

/**
 * Check if a date is older than N days.
 */
export function isOlderThan(dateStr: string, days: number): boolean {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) > days;
}

/**
 * Clean up expired snapshots.
 */
export async function cleanupExpiredSnapshots(): Promise<number> {
  const { data } = await supabase
    .from("intelligence_snapshots")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");

  return data?.length || 0;
}

/**
 * Build a trend block from a web_trends snapshot for use in prompts.
 */
export function buildTrendBlockFromSnapshot(data: Record<string, unknown>): string {
  const searches = data.searches as Array<{ category?: string; query: string; results: Array<{ title: string; description: string; age?: string; url?: string }> }> | undefined;
  if (!searches || searches.length === 0) return "";

  const allResults = searches.flatMap(s => s.results);
  if (allResults.length === 0) return "";

  // New category-organized format from searchTrendsDeep
  const hasCategories = searches.some(s => s.category);
  if (hasCategories) {
    const categoryLabels: Record<string, string> = {
      search_intent: "SEARCH INTENT — Was Leute wirklich suchen",
      viral: "VIRAL — Was gerade auf Social Media abgeht",
      news: "NEWS — Aktuelle Ereignisse in der Nische",
      pain_point: "PAIN POINTS — Probleme der Zielgruppe",
      pillar: "PILLAR-SPEZIFISCH",
      seasonal: "SAISONAL — Zeitbezogene Themen",
    };
    const grouped: Record<string, typeof searches> = {};
    for (const s of searches) {
      if (s.results.length === 0) continue;
      const cat = s.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    }
    const sections = Object.entries(grouped).map(([cat, items]) => {
      const label = categoryLabels[cat] || cat;
      const content = items.map(item =>
        `Suche "${item.query}":\n${item.results.map((r, i) =>
          `  ${i + 1}. ${r.title}${r.age ? ` (${r.age})` : ""}\n     ${r.description}${r.url ? `\n     ${r.url}` : ""}`
        ).join("\n")}`
      ).join("\n\n");
      return `## ${label}\n${content}`;
    });
    return `<live_web_trends>\n${sections.join("\n\n")}\n</live_web_trends>`;
  }

  // Legacy flat format
  return `<live_web_trends>
Aktuelle Web-Ergebnisse (vorrecherchiert):
${searches.map(s => {
    if (s.results.length === 0) return "";
    return `Suche "${s.query}":
${s.results.map((r, i) => `  ${i + 1}. ${r.title}${r.age ? ` (${r.age})` : ""}\n     ${r.description}`).join("\n")}`;
  }).filter(Boolean).join("\n\n")}
</live_web_trends>`;
}

/**
 * Build a competitor block from a competitor_refresh snapshot.
 */
export function buildCompetitorBlockFromSnapshot(data: Record<string, unknown>): string {
  const creators = data.creators as Array<{
    creator: string;
    videos: Array<{ views?: number; likes?: number; link?: string; durationSeconds?: number }>;
  }> | undefined;
  if (!creators || creators.length === 0) return "";

  const allVideos = creators.flatMap(c =>
    c.videos.map(v => ({ ...v, creator: c.creator }))
  ).filter(v => v.views && v.views > 0)
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10);

  if (allVideos.length === 0) return "";

  return `<fresh_competitor_data>
Frisch gescrapte Competitor-Videos:
${allVideos.map((v, i) => `  ${i + 1}. @${v.creator} · ${(v.views || 0).toLocaleString()} Views`).join("\n")}
</fresh_competitor_data>`;
}
