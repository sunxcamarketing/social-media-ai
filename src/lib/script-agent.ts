// ── Script Agent ───────────────────────────────────────────────────────────
// Multi-step agent that writes viral video scripts.
// Replaces the old single-call generate_script pipeline.
//
// Flow: load data → find angle (think) → craft hooks → write script → self-review
// The agent decides which tools to call and when, guided by script-agent.md.

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

// ── Agent Tools (internal to the script agent) ────────────────────────────

const AGENT_TOOLS: Anthropic.Tool[] = [
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
    description: "Denk laut nach. Nutze dieses Tool um über Winkel, Hooks oder den Review nachzudenken. Der Output ist nur für dich — der User sieht ihn nicht.",
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
    description: "Reiche das fertige Skript ein. Erst aufrufen wenn du mit dem Review zufrieden bist.",
    input_schema: {
      type: "object" as const,
      properties: {
        text_hook: { type: "string" as const, description: "Text-Hook auf Screen (max 6 Wörter)" },
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

// ── Tool Execution ────────────────────────────────────────────────────────
// Delegates to existing agent-tools implementations to avoid duplication.

async function executeScriptAgentTool(
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

  // Build platform context
  const platforms = parseTargetPlatforms(config.targetPlatforms);
  const platformContext = buildPlatformContext(platforms[0] || DEFAULT_PLATFORM);

  // Build system prompt
  const systemPrompt = buildPrompt("script-agent", { platform_context: platformContext });

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

  // Agent loop
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: AGENT_TOOLS,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // No tool calls — shouldn't happen (agent should always submit_script), but handle gracefully
    if (toolUseBlocks.length === 0) {
      throw new Error("Script Agent hat kein Skript eingereicht. Bitte nochmal versuchen.");
    }

    // Check if submit_script is among the tool calls
    const submitBlock = toolUseBlocks.find(b => b.name === "submit_script");
    if (submitBlock) {
      onProgress?.({ step: "submit_script", detail: "Skript fertig" });
      const result = submitBlock.input as Record<string, string>;
      return {
        textHook: result.text_hook || "",
        hookPattern: result.hook_pattern || "",
        shortScript: result.short_script || "",
        longScript: result.long_script || "",
        angle: result.angle || "",
        whyItWorks: result.why_it_works || "",
      };
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
        const result = await executeScriptAgentTool(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          clientId,
        );
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

  throw new Error("Script Agent hat nach 15 Iterationen kein Skript eingereicht.");
}
