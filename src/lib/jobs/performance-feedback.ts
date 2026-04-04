// ── Background Job: Performance Feedback ──────────────────────────────────
// Analyzes recent scripts against performance data and extracts learnings.

import { readConfig, readScriptsByClient } from "../csv";
import { saveSnapshot } from "../intelligence";
import { extractLearnings } from "../client-learnings";
import { safeJsonParse } from "../safe-json";
import type { PerformanceInsights, VideoInsight } from "../performance-helpers";

interface ScriptWithPerformance {
  title: string;
  hookPattern: string;
  contentType: string;
  format: string;
  pillar: string;
  views: number;
  likes: number;
  createdAt: string;
}

/**
 * Match scripts to performance data by finding videos that correspond to scripts.
 */
function matchScriptsToPerformance(
  scripts: Array<{ title: string; hookPattern: string; contentType: string; format: string; pillar: string; createdAt: string }>,
  insights: PerformanceInsights,
): ScriptWithPerformance[] {
  const topVideos: VideoInsight[] = [
    ...(insights.top30Days || []),
    ...(insights.topAllTime || []),
  ];

  if (topVideos.length === 0) return [];

  // Only return scripts that have a real performance match — never fake data
  const matched: ScriptWithPerformance[] = [];

  for (const s of scripts) {
    const titleLower = s.title.toLowerCase();
    const matchedVideo = topVideos.find(v =>
      v.topic && titleLower.includes(v.topic.toLowerCase().slice(0, 15))
    );

    if (matchedVideo) {
      matched.push({
        ...s,
        views: matchedVideo.views,
        likes: matchedVideo.likes,
      });
    }
  }

  return matched;
}

export async function analyzePerformanceFeedback(clientId: string): Promise<{ matchedCount: number; learningsExtracted: number }> {
  const config = await readConfig(clientId);
  if (!config) throw new Error(`Config not found: ${clientId}`);

  const scripts = await readScriptsByClient(clientId);
  const insights = safeJsonParse<PerformanceInsights | null>(config.performanceInsights || "", null);

  if (!insights) {
    await saveSnapshot(clientId, "performance_feedback", {
      status: "no_performance_data",
      scriptCount: scripts.length,
    }, { expiryDays: 7 });
    return { matchedCount: 0, learningsExtracted: 0 };
  }

  const matched = matchScriptsToPerformance(
    scripts.map(s => ({
      title: s.title || "",
      hookPattern: s.hookPattern || "",
      contentType: s.contentType || "",
      format: s.format || "",
      pillar: s.pillar || "",
      createdAt: s.createdAt || "",
    })),
    insights,
  );

  // Save snapshot with summary
  const sorted = [...matched].sort((a, b) => b.views - a.views);
  await saveSnapshot(clientId, "performance_feedback", {
    status: matched.length >= 8 ? "sufficient_data" : "insufficient_data",
    matchedCount: matched.length,
    topPerformers: sorted.slice(0, 3).map(s => ({ title: s.title, views: s.views, hookPattern: s.hookPattern })),
    worstPerformers: sorted.slice(-3).map(s => ({ title: s.title, views: s.views, hookPattern: s.hookPattern })),
  }, { expiryDays: 7 });

  // Extract learnings if enough data
  let learningsExtracted = 0;
  if (matched.length >= 8) {
    learningsExtracted = await extractLearnings(clientId, matched);
  }

  return { matchedCount: matched.length, learningsExtracted };
}
