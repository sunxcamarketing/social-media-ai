/**
 * Performance insight helpers — shared by generate-week-scripts, generate-strategy, and agent-tools.
 */

import { safeJsonParse } from "./safe-json";
import { fmt, fmtDuration } from "./format";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";

export type { PerformanceInsights, VideoInsight };

export function parseInsights(raw: string): PerformanceInsights | null {
  return safeJsonParse<PerformanceInsights | null>(raw, null);
}

/** Format a single video insight for AI prompt context. */
export function videoInsightBlock(v: VideoInsight, index: number): string {
  return [
    `[${index + 1}] ${fmt(v.views)} Views · ${fmt(v.likes)} Likes · ${v.datePosted}${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""}`,
    v.topic && `Thema: ${v.topic}`,
    v.audioHook && v.audioHook !== "none" && `Audio-Hook: "${v.audioHook}"`,
    v.textHook && v.textHook !== "none" && `Text-Hook: "${v.textHook}"`,
    v.scriptSummary && `Zusammenfassung: ${v.scriptSummary}`,
    v.whyItWorked && `Warum erfolgreich: ${v.whyItWorked}`,
    v.howToReplicate && `Wie replizieren: ${v.howToReplicate}`,
  ].filter(Boolean).join("\n");
}
