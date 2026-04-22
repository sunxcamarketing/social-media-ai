// ── Background Job: Competitor Refresh ─────────────────────────────────────
// Scrapes top competitors via Apify and saves results as snapshot.

import { readConfig } from "../csv";
import { scrapeReels } from "../apify";
import { saveSnapshot } from "../intelligence";
import { supabase } from "../supabase";
import { trackApifyCost } from "../cost-tracking";

export async function refreshCompetitors(clientId: string): Promise<{ totalVideos: number }> {
  const config = await readConfig(clientId);
  if (!config) throw new Error(`Config not found: ${clientId}`);

  const configName = config.configName || config.name || "";

  // Load creators for this config's category
  const { data: creators } = await supabase
    .from("creators")
    .select("*")
    .eq("category", config.creatorsCategory || configName)
    .order("followers", { ascending: false })
    .limit(5);

  if (!creators || creators.length === 0) {
    await saveSnapshot(clientId, "competitor_refresh", {
      creators: [],
      totalVideos: 0,
      scrapedAt: new Date().toISOString(),
    }, { expiryDays: 14 });
    return { totalVideos: 0 };
  }

  const results = [];
  for (const creator of creators) {
    try {
      const reels = await scrapeReels(creator.username, 5, 7);
      trackApifyCost({ clientId, operation: "competitor_refresh_job", initiator: "admin", itemCount: reels.length });
      results.push({
        creator: creator.username,
        videos: reels.map(r => ({
          views: r.videoPlayCount || 0,
          likes: r.likesCount || 0,
          link: r.url || "",
          durationSeconds: r.videoDuration || 0,
        })),
      });
    } catch {
      results.push({ creator: creator.username, videos: [], error: true });
    }
  }

  const totalVideos = results.reduce((sum, r) => sum + r.videos.length, 0);

  await saveSnapshot(clientId, "competitor_refresh", {
    creators: results,
    totalVideos,
    scrapedAt: new Date().toISOString(),
  }, { expiryDays: 14 });

  return { totalVideos };
}
