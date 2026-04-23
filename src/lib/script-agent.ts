// ── Script Agent ───────────────────────────────────────────────────────────
// Multi-step agent that writes viral video scripts.
//
// Flow: Writer (agent loop) → Regex check → Reviewer (single call, only if needed)
//
// The Writer focuses on creative quality: angle, hooks, voice matching.
// The Reviewer focuses on language quality: AI detection, formatting, voice check.
// Regex catches obvious AI patterns (em-dashes, banned phrases) before the reviewer.

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";
import { buildPrompt } from "@prompts";
import { readConfig } from "./csv";
import {
  toolLoadClientContext,
  toolLoadVoiceProfile,
  toolCheckCompetitors,
  toolCheckPerformance,
  toolSearchWeb,
} from "./agent-tools";
import { buildPlatformContext, parseTargetPlatforms, DEFAULT_PLATFORM } from "./platforms";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ScriptAgentInput {
  title: string;
  description: string;
  pillar?: string;
  contentType?: string;
  format?: string;
  tone?: string;
  conversationContext?: string; // Creative context from chat conversation
}

export interface ScriptAgentResult {
  textHook: string;
  hookPattern: string;
  shortScript: string;
  longScript: string;
  angle: string;
  whyItWorks: string;
}

/** Callback for streaming progress updates back to the caller. */
export type ScriptAgentProgressFn = (event: {
  step: string;
  detail?: string;
}) => void;

// ── AI Pattern Detection (Regex) ─────────────────────────────────────────
// Catches the most common AI tells before invoking the reviewer LLM call.
// This is a fast, cheap pre-filter — not exhaustive.

const BANNED_PHRASES = [
  "Die meisten Menschen",
  "Viele Menschen",
  "Stell dir vor",
  "Das Schöne daran",
  "Am Ende des Tages",
  "Und genau das ist der Punkt",
  "Hier kommt der Clou",
  "Lass das mal sacken",
  "Nicht weil",
  "Die Frage ist nicht ob",
  "In der heutigen Zeit",
  "Hast du dich jemals gefragt",
  "Es ist kein Geheimnis",
  "Wusstest du, dass",
  "Das verändert alles",
  "Potenzial entfalten",
  "Aufs nächste Level",
  "nächstes Level",
  "Lass mich dir erzählen",
  "Hier ist die Wahrheit",
];

function detectAIPatterns(script: string): string[] {
  const issues: string[] = [];

  // Em-dashes and en-dashes used as style
  if (script.includes("—") || script.includes("–")) {
    issues.push("Bindestriche/Gedankenstriche gefunden (—, –)");
  }

  // Monotone formatting: >60% of non-empty lines are single sentences
  // (one sentence followed by a blank line = AI pattern)
  const lines = script.split("\n");
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  if (nonEmptyLines.length > 3) {
    let singleSentenceLines = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      // Check if this line is followed by a blank line (or end of text)
      const nextLine = lines[i + 1]?.trim() ?? "";
      if (nextLine.length === 0 && line.length > 0) {
        singleSentenceLines++;
      }
    }
    if (singleSentenceLines / nonEmptyLines.length > 0.6) {
      issues.push("Monotone Ein-Satz-pro-Zeile Formatierung");
    }
  }

  // Banned phrases (case-insensitive substring match)
  const lowerScript = script.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lowerScript.includes(phrase.toLowerCase())) {
      issues.push(`Verbotene Phrase: "${phrase}"`);
    }
  }

  // Rhetorical one-word questions (e.g. "Das Ergebnis?", "Der Clou?")
  const rhetoricalPattern = /^(Das|Der|Die) \w+\?$/m;
  if (rhetoricalPattern.test(script)) {
    issues.push("Rhetorische Einwort-Frage gefunden (z.B. 'Das Ergebnis?')");
  }

  return issues;
}

// ── Writer Agent Tools ───────────────────────────────────────────────────

const WRITER_TOOLS: Anthropic.Tool[] = [
  {
    name: "load_context",
    description: "Lade Client-Profil, Brand, Strategie, Zielgruppe. Einmal am Anfang aufrufen.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "load_voice",
    description: "Lade Stimmprofil und Skript-Struktur. PFLICHT vor dem Schreiben.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "check_competitors",
    description: "Top Competitor-Videos mit Views, Hooks und Konzepten.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" as const, description: "Anzahl Videos (default 8)" },
      },
      required: [],
    },
  },
  {
    name: "check_performance",
    description: "Performance-Daten des Clients: Top-Videos, Ø Views, Hook-Patterns.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "search_web",
    description: "Web-Suche für aktuelle Trends, Fakten oder virale Themen.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Suchbegriff" },
      },
      required: ["query"],
    },
  },
  {
    name: "think",
    description: "Denk laut nach. Nutze dieses Tool um über Winkel, Hooks oder den Review nachzudenken. Der Output ist nur für dich. Der User sieht ihn nicht.",
    input_schema: {
      type: "object" as const,
      properties: {
        thought: { type: "string" as const, description: "Dein Gedankengang" },
      },
      required: ["thought"],
    },
  },
  {
    name: "submit_script",
    description: "Reiche das fertige Skript ein.",
    input_schema: {
      type: "object" as const,
      properties: {
        text_hook: { type: "string" as const, description: "Text-Hook auf Screen (max 5 Wörter)" },
        hook_pattern: { type: "string" as const, description: "Verwendetes Hook-Muster" },
        short_script: { type: "string" as const, description: "Kurzversion (30-40 Sek)" },
        long_script: { type: "string" as const, description: "Langversion (60+ Sek)" },
        angle: { type: "string" as const, description: "Der kreative Winkel in einem Satz" },
        why_it_works: { type: "string" as const, description: "Warum es viral gehen kann (1-2 Sätze)" },
      },
      required: ["text_hook", "hook_pattern", "short_script", "long_script", "angle", "why_it_works"],
    },
  },
];

// ── Reviewer Tool ────────────────────────────────────────────────────────

const REVIEWER_TOOL: Anthropic.Tool = {
  name: "review_script",
  description: "Gib dein Review-Ergebnis ab: approved oder rewritten.",
  input_schema: {
    type: "object" as const,
    properties: {
      approved: { type: "boolean" as const, description: "true wenn das Skript sauber ist" },
      issues: { type: "string" as const, description: "Was geändert wurde (leer wenn approved)" },
      short_script: { type: "string" as const, description: "Überarbeitete Kurzversion (leer wenn approved)" },
      long_script: { type: "string" as const, description: "Überarbeitete Langversion (leer wenn approved)" },
    },
    required: ["approved"],
  },
};

// ── Tool Execution ────────────────────────────────────────────────────────
// Delegates to existing agent-tools implementations to avoid duplication.

async function executeWriterTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  clientId: string,
): Promise<string> {
  switch (toolName) {
    case "load_context":
      return toolLoadClientContext(clientId);

    case "load_voice":
      return toolLoadVoiceProfile(clientId);

    case "check_competitors":
      return toolCheckCompetitors(clientId, { limit: (toolInput.limit as number) || 8 });

    case "check_performance":
      return toolCheckPerformance(clientId);

    case "search_web":
      return toolSearchWeb({ query: toolInput.query as string });

    case "think":
      // Think tool just acknowledges — the thought itself is in the message
      return "Gedanke notiert. Weiter.";

    default:
      return `Unbekanntes Tool: ${toolName}`;
  }
}

// ── Reviewer ─────────────────────────────────────────────────────────────
// Single Claude call that checks script quality and optionally rewrites.

async function runReviewer(
  client: Anthropic,
  shortScript: string,
  longScript: string,
  voiceProfile: string | null,
  regexIssues: string[],
  lang: "de" | "en" = "de",
): Promise<{ approved: boolean; shortScript?: string; longScript?: string; issues?: string }> {
  const reviewerPrompt = buildPrompt("script-reviewer", {}, lang);

  let userMessage = lang === "en"
    ? `Review this script for AI language, formatting, and voice match.\n\n── SHORT (30-40s) ──\n${shortScript}\n\n── LONG (60+s) ──\n${longScript}`
    : `Prüfe dieses Skript auf AI-Sprache, Formatierung und Voice Match.\n\n── KURZ (30-40 Sek) ──\n${shortScript}\n\n── LANG (60+ Sek) ──\n${longScript}`;

  if (regexIssues.length > 0) {
    userMessage += lang === "en"
      ? `\n\nALREADY DETECTED ISSUES (auto-found):\n${regexIssues.map(i => `- ${i}`).join("\n")}`
      : `\n\nBEREITS ERKANNTE PROBLEME (automatisch gefunden):\n${regexIssues.map(i => `- ${i}`).join("\n")}`;
  }

  if (voiceProfile) {
    userMessage += `\n\nVOICE PROFILE:\n${voiceProfile}`;
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: reviewerPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: [REVIEWER_TOOL],
    tool_choice: { type: "tool", name: "review_script" },
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "review_script",
  );

  if (!toolBlock) {
    // Fallback: if reviewer didn't use the tool, return approved (don't block)
    return { approved: true };
  }

  const result = toolBlock.input as Record<string, unknown>;
  return {
    approved: result.approved as boolean,
    shortScript: (result.short_script as string) || undefined,
    longScript: (result.long_script as string) || undefined,
    issues: (result.issues as string) || undefined,
  };
}

// ── Main Agent Loop ───────────────────────────────────────────────────────

const MAX_ITERATIONS = 15;

export async function runScriptAgent(
  clientId: string,
  input: ScriptAgentInput,
  onProgress?: ScriptAgentProgressFn,
): Promise<ScriptAgentResult> {
  const config = await readConfig(clientId);
  if (!config) throw new Error("Client nicht gefunden.");

  const client = getAnthropicClient();

  // Build platform context + language
  const platforms = parseTargetPlatforms(config.targetPlatforms);
  const platformContext = buildPlatformContext(platforms[0] || DEFAULT_PLATFORM);
  const lang: "de" | "en" = config.language === "en" ? "en" : "de";

  // Build system prompt — now uses script-writer (creative focus)
  const systemPrompt = buildPrompt("script-writer", { platform_context: platformContext }, lang);

  // Build the user message with task + optional conversation context
  const metaLine = [
    input.pillar && `Pillar: ${input.pillar}`,
    input.contentType && `Content-Typ: ${input.contentType}`,
    input.format && `Format: ${input.format}`,
    input.tone && `Tonalität: ${input.tone}`,
  ].filter(Boolean).join(" | ");

  let userMessage = `Schreibe ein Skript zu diesem Thema:\n\nTITEL: ${input.title}\nBESCHREIBUNG: ${input.description}`;
  if (metaLine) userMessage += `\n${metaLine}`;

  // If the chat agent already had creative context (ideas, angles), pass it along
  if (input.conversationContext) {
    userMessage += `\n\nKONTEXT AUS DEM GESPRÄCH (nutze diese kreativen Ideen als Ausgangspunkt, nicht als Template):\n${input.conversationContext}`;
  }

  userMessage += `\n\nClient-ID: ${clientId} (für Tool-Calls)`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  // Track voice profile for the reviewer
  let cachedVoiceProfile: string | null = null;

  // ── Writer agent loop ──────────────────────────────────────────────────

  let writerResult: ScriptAgentResult | null = null;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: WRITER_TOOLS,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // No tool calls — shouldn't happen (agent should always submit_script)
    if (toolUseBlocks.length === 0) {
      throw new Error("Script Agent hat kein Skript eingereicht. Bitte nochmal versuchen.");
    }

    // Check if submit_script is among the tool calls
    const submitBlock = toolUseBlocks.find(b => b.name === "submit_script");
    if (submitBlock) {
      onProgress?.({ step: "submit_script", detail: "Skript geschrieben, prüfe Qualität…" });
      const raw = submitBlock.input as Record<string, string>;
      writerResult = {
        textHook: raw.text_hook || "",
        hookPattern: raw.hook_pattern || "",
        shortScript: raw.short_script || "",
        longScript: raw.long_script || "",
        angle: raw.angle || "",
        whyItWorks: raw.why_it_works || "",
      };
      break;
    }

    // Execute all tool calls in parallel
    const STEP_LABELS: Record<string, string> = {
      load_context: "Lade Client-Profil…",
      load_voice: "Lade Stimmprofil…",
      check_competitors: "Prüfe Competitor-Videos…",
      check_performance: "Prüfe Performance-Daten…",
      search_web: "Web-Recherche…",
      think: "Denkt nach…",
    };

    for (const toolBlock of toolUseBlocks) {
      onProgress?.({
        step: toolBlock.name,
        detail: STEP_LABELS[toolBlock.name] || toolBlock.name,
      });
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolBlock) => {
        const result = await executeWriterTool(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          clientId,
        );

        // Cache voice profile for the reviewer
        if (toolBlock.name === "load_voice") {
          cachedVoiceProfile = result;
        }

        return {
          type: "tool_result" as const,
          tool_use_id: toolBlock.id,
          content: result,
        };
      }),
    );

    // Append assistant response + tool results for next iteration
    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    );
  }

  if (!writerResult) {
    throw new Error("Script Agent hat nach 15 Iterationen kein Skript eingereicht.");
  }

  // ── Regex check ────────────────────────────────────────────────────────

  const allScriptText = writerResult.shortScript + "\n" + writerResult.longScript;
  const regexIssues = detectAIPatterns(allScriptText);

  if (regexIssues.length === 0) {
    // Script is clean — skip reviewer, save tokens
    onProgress?.({ step: "quality_check", detail: "Qualitäts-Check bestanden" });
    return writerResult;
  }

  // ── Reviewer call (only when regex finds issues) ───────────────────────

  onProgress?.({
    step: "reviewer",
    detail: `AI-Patterns erkannt (${regexIssues.length}), Reviewer prüft…`,
  });

  const reviewResult = await runReviewer(
    client,
    writerResult.shortScript,
    writerResult.longScript,
    cachedVoiceProfile,
    regexIssues,
    lang,
  );

  if (reviewResult.approved || !reviewResult.shortScript || !reviewResult.longScript) {
    // Reviewer approved or didn't provide rewrites — use writer's version
    onProgress?.({ step: "quality_check", detail: "Reviewer: approved" });
    return writerResult;
  }

  // Use reviewer's rewritten scripts
  onProgress?.({ step: "quality_check", detail: `Reviewer: umgeschrieben (${reviewResult.issues || "Sprache poliert"})` });
  return {
    ...writerResult,
    shortScript: reviewResult.shortScript,
    longScript: reviewResult.longScript,
  };
}
