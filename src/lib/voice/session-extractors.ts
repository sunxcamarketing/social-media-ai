// ── Shared post-session Claude extractors ────────────────────────────────
// Helpers used by all three voice-session finalizers to mine the transcript:
//   - generateSessionSummary  → content ideas from free-form interview
//   - extractOnboardingBlocks → per-block summaries + quotes (onboarding)
//   - extractProfileSuggestions → profile field suggestions (onboarding)
//
// Each is a single Claude call with a 45s timeout. Returns `null`/empty array
// on any failure — callers treat that as "extraction produced nothing".

import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { TranscriptEntry } from "../gemini-live";
import { VOICE_BLOCK_ORDER, type VoiceBlockId, type Config } from "../types";

const CLAUDE_EXTRACTION_TIMEOUT_MS = 45_000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Transcript + shared helpers ──────────────────────────────────────────

export function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((t) => `${t.role === "user" ? "Client" : "Agent"}: ${t.text}`)
    .join("\n");
}

interface ToolExtractionOptions {
  label: string;
  systemPrompt: string;
  userContent: string;
  tool: Anthropic.Messages.Tool;
  maxTokens?: number;
}

async function runToolExtraction<TInput>(opts: ToolExtractionOptions): Promise<TInput | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(`[${opts.label}] ANTHROPIC_API_KEY not set, skipping`);
    return null;
  }
  try {
    const client = new Anthropic({ apiKey });
    const response = await Promise.race([
      client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: opts.maxTokens ?? 3000,
        system: opts.systemPrompt,
        tools: [opts.tool],
        messages: [{ role: "user", content: opts.userContent }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${opts.label} timeout after ${CLAUDE_EXTRACTION_TIMEOUT_MS}ms`)), CLAUDE_EXTRACTION_TIMEOUT_MS),
      ),
    ]);
    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) {
      console.log(`[${opts.label}] Claude returned no tool use`);
      return null;
    }
    return toolUse.input as TInput;
  } catch (err) {
    console.error(`[${opts.label}] extraction failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Save the raw voice-session row ───────────────────────────────────────

export async function saveVoiceSession(
  clientId: string,
  transcript: TranscriptEntry[],
  ideasGenerated: number,
  durationSeconds: number,
): Promise<void> {
  const id = crypto.randomUUID();
  await supabase.from("voice_sessions").insert({
    id,
    client_id: clientId,
    // voice_sessions.transcript is JSONB — pass the array directly. Legacy rows
    // written with JSON.stringify are stored as strings and must be parsed on
    // read (see /api/configs/[id]/voice-sessions for the compat logic).
    transcript,
    ideas_generated: ideasGenerated,
    duration_seconds: durationSeconds,
    created_at: new Date().toISOString().split("T")[0],
  });
}

// ── Session summary: Convert transcript to content ideas ─────────────────

export async function generateSessionSummary(
  clientId: string,
  transcript: TranscriptEntry[],
  lang: "de" | "en" = "de",
): Promise<Array<{ title: string; description: string; contentType: string }>> {
  // Require real back-and-forth before asking Claude to extract ideas — otherwise
  // Claude invents placeholder ("<UNKNOWN>") entries just to satisfy the schema.
  const userEntries = transcript.filter((t) => t.role === "user" && t.text.trim().length > 15);
  const modelEntries = transcript.filter((t) => t.role === "model" && t.text.trim().length > 15);
  if (userEntries.length < 2 || modelEntries.length < 1) {
    console.log(`[summary] transcript too thin (user=${userEntries.length}, model=${modelEntries.length}), skipping`);
    return [];
  }

  const contentTypeEnum = lang === "en"
    ? ["Storytelling", "Opinion", "Tip", "Experience", "Education"]
    : ["Storytelling", "Meinung", "Tipp", "Erfahrung", "Aufklärung"];

  const input = await runToolExtraction<{ ideas?: Array<{ title: string; description: string; contentType: string }> }>({
    label: "summary",
    systemPrompt: lang === "en"
      ? "You are a content strategist. Extract ONLY video ideas from the interview that are based on concrete things the client actually said (story, opinion, experience, tip). If the client hasn't said anything substantive, do NOT call the tool. Invent NOTHING. No placeholders, no <UNKNOWN> values."
      : "Du bist ein Content-Stratege. Extrahiere aus dem Interview NUR Video-Ideen, die auf konkreten Aussagen des Clients basieren (Story, Meinung, Erfahrung, Tipp). Wenn der Client nichts Substantielles gesagt hat, rufe das Tool NICHT auf. Erfinde NICHTS. Keine Platzhalter, keine <UNKNOWN>-Werte.",
    userContent: formatTranscript(transcript),
    maxTokens: 2048,
    tool: {
      name: "save_ideas",
      description: lang === "en"
        ? "Save 1-5 concrete video ideas from the interview. ONLY call when at least one real idea based on client statements exists."
        : "Speichere 1-5 konkrete Video-Ideen aus dem Interview. NUR aufrufen wenn mindestens eine echte, auf Client-Aussagen basierende Idee existiert.",
      input_schema: {
        type: "object",
        properties: {
          ideas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: lang === "en" ? "Max 10 words, specific, based on a real statement" : "Max 10 Wörter, spezifisch, basiert auf echter Aussage" },
                description: { type: "string", description: lang === "en" ? "1-2 sentences capturing the core of the story/opinion" : "1-2 Sätze mit dem Kern der Geschichte/Meinung" },
                contentType: { type: "string", enum: contentTypeEnum },
              },
              required: ["title", "description", "contentType"],
            },
            minItems: 1,
            maxItems: 5,
          },
        },
        required: ["ideas"],
      },
    },
  });

  const raw = input?.ideas || [];
  const isPlaceholder = (s: string) => /^<?unknown>?$/i.test(s.trim()) || s.trim().length < 5;
  const cleaned = raw.filter((i) => !isPlaceholder(i.title) && !isPlaceholder(i.description));
  if (cleaned.length < raw.length) console.warn(`[summary] dropped ${raw.length - cleaned.length} placeholder idea(s)`);
  if (cleaned.length > 0) console.log(`[summary] extracted ${cleaned.length} idea(s)`);
  void clientId; // kept in signature for future per-client context
  return cleaned;
}

// ── Onboarding: extract per-block summaries + quotes ────────────────────

export interface ExtractedBlock {
  block_id: VoiceBlockId;
  summary: string;
  quotes: string[];
}

const VALID_BLOCK_IDS = new Set<VoiceBlockId>(VOICE_BLOCK_ORDER);
function isVoiceBlockId(v: unknown): v is VoiceBlockId {
  return typeof v === "string" && VALID_BLOCK_IDS.has(v as VoiceBlockId);
}

export async function extractOnboardingBlocks(
  transcript: TranscriptEntry[],
  lang: "de" | "en",
): Promise<ExtractedBlock[]> {
  if (transcript.length < 4) {
    console.log("[onboarding-extract] transcript too thin, skipping");
    return [];
  }

  const input = await runToolExtraction<{ blocks?: Array<{ block_id: string; summary: string; quotes: string[] }> }>({
    label: "onboarding-extract",
    maxTokens: 4096,
    systemPrompt: lang === "en"
      ? `You analyze a voice interview transcript between a content strategist agent and a creator. Extract per-block summaries for the 8 blocks the agent was working through: identity, positioning, audience, beliefs, offer, feel, vision, resources. For EACH block that was covered with real substance, provide: a 1-3 sentence summary + 1-5 verbatim quotes from the CLIENT (not the agent). Only include blocks where the client said something concrete. Skip blocks with only platitudes or nothing said. Invent nothing.`
      : `Du analysierst das Transcript eines Voice-Interviews zwischen einem Content-Strategen-Agent und einem Creator. Extrahiere pro-Block Zusammenfassungen für die 8 Blöcke die der Agent durchging: identity, positioning, audience, beliefs, offer, feel, vision, resources. Für JEDEN Block der mit echter Substanz abgedeckt wurde, gib an: eine 1-3-Satz-Zusammenfassung + 1-5 wörtliche Zitate vom CLIENT (nicht vom Agent). Nimm nur Blöcke auf bei denen der Client etwas Konkretes gesagt hat. Überspring Blöcke mit nur Plattitüden oder nichts Gesagtem. Erfinde nichts.`,
    userContent: formatTranscript(transcript),
    tool: {
      name: "save_blocks",
      description: "Save per-block summaries extracted from the interview.",
      input_schema: {
        type: "object",
        properties: {
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                block_id: { type: "string", enum: [...VOICE_BLOCK_ORDER] },
                summary: { type: "string", description: "1-3 sentence summary in the interview language" },
                quotes: {
                  type: "array",
                  items: { type: "string" },
                  description: "1-5 verbatim client quotes",
                  minItems: 1,
                  maxItems: 5,
                },
              },
              required: ["block_id", "summary", "quotes"],
            },
          },
        },
        required: ["blocks"],
      },
    },
  });

  const raw = Array.isArray(input?.blocks) ? input!.blocks : [];
  const blocks: ExtractedBlock[] = raw
    .filter((b) => isVoiceBlockId(b.block_id))
    .map((b) => ({
      block_id: b.block_id as VoiceBlockId,
      summary: b.summary,
      quotes: Array.isArray(b.quotes) ? b.quotes : [],
    }));
  if (blocks.length < raw.length) console.warn(`[onboarding-extract] dropped ${raw.length - blocks.length} invalid block(s)`);
  console.log(`[onboarding-extract] ${blocks.length} block(s) extracted`);
  return blocks;
}

// ── Profile field suggestions (onboarding) ───────────────────────────────

export type SuggestableField =
  | "company" | "role" | "location" | "businessContext" | "professionalBackground" | "keyAchievements"
  | "brandFeeling" | "brandProblem" | "brandingStatement" | "humanDifferentiation"
  | "dreamCustomer" | "customerProblems"
  | "providerRole" | "providerBeliefs" | "providerStrengths" | "authenticityZone"
  | "coreOffer" | "mainGoal";

const SUGGESTABLE_FIELDS: SuggestableField[] = [
  "company", "role", "location", "businessContext", "professionalBackground", "keyAchievements",
  "brandFeeling", "brandProblem", "brandingStatement", "humanDifferentiation",
  "dreamCustomer", "customerProblems",
  "providerRole", "providerBeliefs", "providerStrengths", "authenticityZone",
  "coreOffer", "mainGoal",
];

export interface FieldSuggestion {
  field: SuggestableField;
  value: string;
  sourceQuote: string;
}

export async function extractProfileSuggestions(
  transcript: TranscriptEntry[],
  existingConfig: Partial<Config>,
  lang: "de" | "en",
): Promise<FieldSuggestion[]> {
  if (transcript.length < 4) return [];

  const existingFields = SUGGESTABLE_FIELDS
    .map((f) => `- ${f}: ${(existingConfig[f] as string) || "(empty)"}`)
    .join("\n");

  const userContent = `${lang === "en" ? "## Existing profile fields" : "## Existierende Profil-Felder"}\n${existingFields}\n\n${lang === "en" ? "## Transcript" : "## Transcript"}\n${formatTranscript(transcript)}`;

  const input = await runToolExtraction<{ suggestions?: Array<{ field: string; value: string; sourceQuote: string }> }>({
    label: "profile-suggestions",
    maxTokens: 3000,
    systemPrompt: lang === "en"
      ? `You extract profile field suggestions from a voice interview transcript. Only propose updates when the client actually said something concrete that belongs in that field. Rules:
(1) If an existing field already has substantive content, only propose an update if the voice content is MEANINGFULLY better/richer — otherwise skip.
(2) If an existing field is empty and the voice has content for it, propose it.
(3) NEVER invent values. If the client never mentioned anything that maps to a field, skip it.
(4) Keep values concise and in the same language as the transcript.
(5) The sourceQuote must be a verbatim quote from the CLIENT (not the agent).`
      : `Du extrahierst Profil-Feld-Vorschläge aus einem Voice-Interview-Transcript. Schlag nur Updates vor wenn der Client wirklich etwas Konkretes gesagt hat das in das Feld gehört. Regeln:
(1) Wenn ein existierendes Feld bereits substanziellen Inhalt hat, schlag nur ein Update vor wenn der Voice-Inhalt WESENTLICH besser/reichhaltiger ist — sonst auslassen.
(2) Wenn ein Feld leer ist und das Voice-Gespräch Inhalt dafür hat, schlag es vor.
(3) Erfinde NIEMALS Werte. Wenn der Client nichts zu einem Feld gesagt hat, lass es weg.
(4) Halte Werte knapp und in der gleichen Sprache wie das Transcript.
(5) Das sourceQuote muss ein wörtliches Zitat vom CLIENT sein (nicht vom Agent).`,
    userContent,
    tool: {
      name: "suggest_profile_fields",
      description: "Propose 0-N profile field updates based on voice interview content.",
      input_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string", enum: [...SUGGESTABLE_FIELDS] },
                value: { type: "string", description: "The proposed value for this field" },
                sourceQuote: { type: "string", description: "Verbatim quote from the client that justifies this suggestion" },
              },
              required: ["field", "value", "sourceQuote"],
            },
          },
        },
        required: ["suggestions"],
      },
    },
  });

  const raw = Array.isArray(input?.suggestions) ? input!.suggestions : [];
  const validFieldSet = new Set<string>(SUGGESTABLE_FIELDS);
  const cleaned: FieldSuggestion[] = raw
    .filter((s) => validFieldSet.has(s.field))
    .filter((s) => s.value && s.value.trim().length > 2 && s.sourceQuote && s.sourceQuote.trim().length > 0)
    .map((s) => ({ field: s.field as SuggestableField, value: s.value, sourceQuote: s.sourceQuote }));
  if (cleaned.length < raw.length) console.warn(`[profile-suggestions] dropped ${raw.length - cleaned.length} invalid suggestion(s)`);
  console.log(`[profile-suggestions] ${cleaned.length} field suggestion(s) extracted`);
  return cleaned;
}
