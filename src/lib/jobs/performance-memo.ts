// ── Background Job: Performance Memo ──────────────────────────────────────
// Nightly/weekly job that turns the raw `client_learnings` table into a
// human-readable "what worked, what didn't" narrative memo. The memo feeds
// the next weekly-ideas pipeline so the model sees CONTEXT, not just numbers.
//
// Runs AFTER performance-feedback (which extracts the learnings). Claude
// Haiku is sufficient here — the memo is a summary of already-scored data.

import Anthropic from "@anthropic-ai/sdk";
import { readConfig, readScriptsByClient } from "../csv";
import { saveSnapshot } from "../intelligence";
import { getHighConfidenceLearnings } from "../client-learnings";
import { parseInsights } from "../performance-helpers";

const CLAUDE_TIMEOUT_MS = 30_000;
const MEMO_MODEL = "claude-haiku-4-5-20251001";

export interface PerformanceMemo {
  generatedAt: string;
  clientId: string;
  summary: string; // Full memo text (3-5 paragraphs)
  winningPatterns: string[]; // Short one-line "do more of X"
  losingPatterns: string[]; // Short one-line "do less of X"
  recommendations: string[]; // Forward-looking suggestions
}

export async function generatePerformanceMemo(clientId: string): Promise<PerformanceMemo | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[performance-memo] ANTHROPIC_API_KEY not set, skipping");
    return null;
  }

  const [config, learnings, scripts] = await Promise.all([
    readConfig(clientId),
    getHighConfidenceLearnings(clientId),
    readScriptsByClient(clientId),
  ]);

  if (!config) return null;
  if (learnings.length === 0) {
    console.log(`[performance-memo] client ${clientId}: no high-confidence learnings yet, skipping memo`);
    return null;
  }

  // Build the narrative input
  const learningsList = learnings
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20)
    .map(l => {
      const conf = Math.round(l.confidence * 100);
      return `- [${conf}% confidence · N=${l.dataPoints}] ${l.category}="${l.value}" — ${l.insight}`;
    })
    .join("\n");

  const insights = parseInsights(config.performanceInsights || "");
  const topVideos = [...(insights?.top30Days || []).slice(0, 5), ...(insights?.topAllTime || []).slice(0, 3)];
  const topBlock = topVideos.length > 0
    ? topVideos.map(v => `- ${v.views} views · "${v.topic || "(no topic)"}"`).join("\n")
    : "(no performance data available)";

  const recentScripts = scripts.slice(-20).map(s => `- "${s.title}" [${s.hookPattern || "?"}/${s.contentType || "?"}/${s.format || "?"}]`).join("\n");

  const lang = config.language === "en" ? "en" : "de";
  const system = lang === "en"
    ? `You are a senior content strategist. Given confidence-scored learnings about what works/doesn't for this client, write a sharp "what worked, what didn't, what next" memo (3-5 short paragraphs) plus three bullet lists:
- winning_patterns: 2-5 short lines ("do more of X because Y")
- losing_patterns: 2-5 short lines ("stop doing X because Y")
- recommendations: 2-4 forward-looking lines

Be direct, use concrete numbers from the data. Never invent. If data is thin, say so. Write in English.`
    : `Du bist ein erfahrener Content-Stratege. Gegeben die confidence-gescorten Learnings über diesen Client, schreibe ein scharfes "was hat funktioniert, was nicht, was als nächstes" Memo (3-5 kurze Absätze) plus drei Stichpunkt-Listen:
- winning_patterns: 2-5 kurze Zeilen ("mehr X weil Y")
- losing_patterns: 2-5 kurze Zeilen ("weniger X weil Y")
- recommendations: 2-4 vorausschauende Zeilen

Sei direkt, nutze konkrete Zahlen aus den Daten. Erfinde NIE. Wenn Daten dünn sind, sag das. Schreibe auf Deutsch.`;

  const userContent = `## Client
${config.configName || config.name} (${config.instagram || "no Instagram"})

## High-Confidence Learnings (from performance data)
${learningsList}

## Recent Top Videos
${topBlock}

## Recent Scripts Generated
${recentScripts || "(no recent scripts)"}`;

  const client = new Anthropic({ apiKey });
  try {
    const response = await Promise.race([
      client.messages.create({
        model: MEMO_MODEL,
        max_tokens: 2000,
        system,
        tools: [{
          name: "submit_memo",
          description: "Submit the performance memo.",
          input_schema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "3-5 short paragraphs: what worked, what didn't, what next" },
              winning_patterns: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
              losing_patterns: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
              recommendations: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 4 },
            },
            required: ["summary", "winning_patterns", "losing_patterns", "recommendations"],
          },
        }],
        tool_choice: { type: "tool", name: "submit_memo" },
        messages: [{ role: "user", content: userContent }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`performance-memo timeout after ${CLAUDE_TIMEOUT_MS}ms`)), CLAUDE_TIMEOUT_MS),
      ),
    ]);

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) {
      console.log("[performance-memo] Claude returned no tool use");
      return null;
    }

    const raw = toolUse.input as {
      summary: string;
      winning_patterns: string[];
      losing_patterns: string[];
      recommendations: string[];
    };

    const memo: PerformanceMemo = {
      generatedAt: new Date().toISOString(),
      clientId,
      summary: raw.summary || "",
      winningPatterns: Array.isArray(raw.winning_patterns) ? raw.winning_patterns : [],
      losingPatterns: Array.isArray(raw.losing_patterns) ? raw.losing_patterns : [],
      recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
    };

    // Persist via intelligence_snapshots — 30 day freshness
    await saveSnapshot(clientId, "performance_memo", memo as unknown as Record<string, unknown>, { expiryDays: 30 });
    console.log(`[performance-memo] saved for ${clientId} (summary: ${memo.summary.length} chars, ${memo.winningPatterns.length} wins, ${memo.losingPatterns.length} losses)`);

    return memo;
  } catch (err) {
    console.error("[performance-memo] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Format the memo as a prompt block for use in weekly-oneshot pipeline. */
export function buildPerformanceMemoBlock(memo: PerformanceMemo | null): string {
  if (!memo) return "";
  const parts: string[] = [`<performance_memo generated="${memo.generatedAt.slice(0, 10)}">`];
  if (memo.summary) parts.push(memo.summary);
  if (memo.winningPatterns.length > 0) {
    parts.push("\nWINNING PATTERNS:");
    memo.winningPatterns.forEach(p => parts.push(`↑ ${p}`));
  }
  if (memo.losingPatterns.length > 0) {
    parts.push("\nLOSING PATTERNS:");
    memo.losingPatterns.forEach(p => parts.push(`↓ ${p}`));
  }
  if (memo.recommendations.length > 0) {
    parts.push("\nRECOMMENDATIONS:");
    memo.recommendations.forEach(r => parts.push(`→ ${r}`));
  }
  parts.push("</performance_memo>");
  return parts.join("\n");
}
