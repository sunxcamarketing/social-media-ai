// ── Client Learnings — Confidence-Scored Insights ─────────────────────────
// Extracts patterns from performance data with statistical rigor.
// Only insights with N≥8 data points and confidence ≥ threshold are used.

import { supabase } from "./supabase";

const MIN_DATA_POINTS = 8;
const DECAY_HALF_LIFE_DAYS = 60;
export const CONFIDENCE_THRESHOLD = 0.4;

export interface ClientLearning {
  id: string;
  clientId: string;
  category: string;
  value: string;
  insight: string;
  direction: "positive" | "negative";
  dataPoints: number;
  supportingPoints: number;
  metricName: string;
  metricAvg: number | null;
  metricBaseline: number | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastDataAt: string | null;
}

/**
 * Calculate confidence score with minimum threshold and time decay.
 */
export function calculateConfidence(
  dataPoints: number,
  supportingPoints: number,
  daysSinceLastData: number,
): number {
  if (dataPoints < MIN_DATA_POINTS) return 0;

  // 1. Consistency: how consistent is the pattern?
  const consistency = supportingPoints / dataPoints;

  // 2. Sample size: more data = more trust (diminishing returns after N=30)
  const sampleFactor = Math.min(1, Math.log2(dataPoints) / Math.log2(30));

  // 3. Decay: old insights lose weight (half-life = 60 days)
  const decay = Math.pow(0.5, daysSinceLastData / DECAY_HALF_LIFE_DAYS);

  return Math.round(consistency * sampleFactor * decay * 100) / 100;
}

/**
 * Get all learnings for a client with recalculated confidence.
 */
export async function getHighConfidenceLearnings(
  clientId: string,
  threshold = CONFIDENCE_THRESHOLD,
): Promise<ClientLearning[]> {
  const { data, error } = await supabase
    .from("client_learnings")
    .select("*")
    .eq("client_id", clientId);

  if (error || !data) return [];

  const now = Date.now();

  return data
    .map(row => {
      const daysSinceLastData = row.last_data_at
        ? (now - new Date(row.last_data_at).getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      return {
        id: row.id,
        clientId: row.client_id,
        category: row.category,
        value: row.value,
        insight: row.insight,
        direction: row.direction as "positive" | "negative",
        dataPoints: row.data_points,
        supportingPoints: row.supporting_points,
        metricName: row.metric_name,
        metricAvg: row.metric_avg,
        metricBaseline: row.metric_baseline,
        confidence: calculateConfidence(row.data_points, row.supporting_points, daysSinceLastData),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastDataAt: row.last_data_at,
      };
    })
    .filter(l => l.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Upsert a learning (update if exists, create if new).
 */
async function upsertLearning(params: {
  clientId: string;
  category: string;
  value: string;
  insight: string;
  direction: "positive" | "negative";
  dataPoints: number;
  supportingPoints: number;
  metricName: string;
  metricAvg: number;
  metricBaseline: number;
}): Promise<void> {
  const daysSinceLastData = 0; // just created
  const confidence = calculateConfidence(params.dataPoints, params.supportingPoints, daysSinceLastData);

  await supabase.from("client_learnings").upsert(
    {
      client_id: params.clientId,
      category: params.category,
      value: params.value,
      insight: params.insight,
      direction: params.direction,
      data_points: params.dataPoints,
      supporting_points: params.supportingPoints,
      metric_name: params.metricName,
      metric_avg: params.metricAvg,
      metric_baseline: params.metricBaseline,
      confidence,
      updated_at: new Date().toISOString(),
      last_data_at: new Date().toISOString(),
    },
    { onConflict: "client_id,category,value,metric_name" },
  );
}

// ── Learning Extraction ───────────────────────────────────────────────────

interface ScriptPerformance {
  title: string;
  hookPattern: string;
  contentType: string;
  format: string;
  pillar: string;
  views: number;
  likes: number;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

/**
 * Extract learnings from script performance data.
 * Returns number of learnings created/updated.
 */
export async function extractLearnings(
  clientId: string,
  matched: ScriptPerformance[],
): Promise<number> {
  if (matched.length < MIN_DATA_POINTS) return 0;

  const baseline = avg(matched.map(s => s.views));
  if (baseline === 0) return 0;

  let count = 0;

  const categories: Array<{ key: keyof ScriptPerformance; category: string }> = [
    { key: "hookPattern", category: "hook_pattern" },
    { key: "contentType", category: "content_type" },
    { key: "format", category: "format" },
    { key: "pillar", category: "pillar" },
  ];

  for (const { key, category } of categories) {
    const groups = groupBy(matched, s => s[key] as string);

    for (const [value, group] of Object.entries(groups)) {
      if (group.length < 3) continue;

      const groupAvg = avg(group.map(s => s.views));
      const ratio = groupAvg / baseline;

      // Only significant differences (>1.5x better or <0.5x worse)
      if (ratio > 1.5 || ratio < 0.5) {
        const direction: "positive" | "negative" = ratio > 1 ? "positive" : "negative";
        const multiplier = ratio > 1 ? ratio : 1 / ratio;

        await upsertLearning({
          clientId,
          category,
          value,
          insight: direction === "positive"
            ? `${value} performt ${multiplier.toFixed(1)}x besser als Durchschnitt`
            : `${value} performt ${multiplier.toFixed(1)}x schlechter als Durchschnitt`,
          direction,
          dataPoints: matched.length,
          supportingPoints: group.length,
          metricName: "views",
          metricAvg: groupAvg,
          metricBaseline: baseline,
        });
        count++;
      }
    }
  }

  return count;
}

/**
 * Build learnings prompt block for use in pipelines.
 */
export function buildLearningsBlock(learnings: ClientLearning[]): string {
  if (learnings.length === 0) return "";

  return `<client_learnings>
DATENGESTÜTZTE ERKENNTNISSE (nur statistisch verifiziert):
${learnings.map(l => {
    const conf = Math.round(l.confidence * 100);
    const arrow = l.direction === "positive" ? "\u2191" : "\u2193";
    return `${arrow} [${conf}% \u00b7 N=${l.dataPoints}] ${l.insight}`;
  }).join("\n")}

ANWENDUNG:
- Learnings mit \u226570% Confidence: Aktiv bevorzugen/vermeiden
- Learnings mit 40-70%: Als Tendenz behandeln, nicht als Regel
- TROTZDEM Abwechslung: Nicht NUR das machen was funktioniert hat
</client_learnings>`;
}
