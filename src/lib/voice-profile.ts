// ── Voice Profile System ─────────────────────────────────────────────────────
// Extracts and caches a structured voice profile from training transcripts.
// Stored as JSON string in configs.voiceProfile (via Supabase jsonb or text column).

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";
import { readTrainingScripts, readConfigs } from "./csv";
import { VOICE_PROFILE_SYSTEM, VOICE_PROFILE_TOOL } from "./prompts/voice-profile";
import type { VoiceProfile } from "./types";

/**
 * Read cached voice profile from config, or null if none exists.
 */
export async function getVoiceProfile(clientId: string): Promise<VoiceProfile | null> {
  const configs = await readConfigs();
  const config = configs.find(c => c.id === clientId);
  if (!config) return null;

  // Supabase returns snake_case, Config type uses camelCase
  const raw = config.voiceProfile || (config as unknown as Record<string, unknown>).voice_profile;
  if (!raw) return null;

  try {
    return typeof raw === "string" ? JSON.parse(raw) as VoiceProfile : raw as VoiceProfile;
  } catch {
    return null;
  }
}

/**
 * Generate a voice profile from training scripts and save it to the config.
 * Returns the generated profile, or null if no training scripts exist.
 */
export async function generateVoiceProfile(
  clientId: string,
  clientName: string,
): Promise<VoiceProfile | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const trainingScripts = (await readTrainingScripts()).filter(ts => ts.clientId === clientId);
  if (trainingScripts.length === 0) return null;

  const transcriptBlock = trainingScripts.slice(0, 10).map((ts, i) => {
    const parts = [
      ts.audioHook && `Hook: ${ts.audioHook}`,
      ts.script && `Body: ${ts.script}`,
      ts.cta && `CTA: ${ts.cta}`,
    ].filter(Boolean).join("\n");
    return `--- Transkript ${i + 1}${ts.format ? ` (${ts.format})` : ""} ---\n${parts}`;
  }).join("\n\n");

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: VOICE_PROFILE_SYSTEM,
    tools: [VOICE_PROFILE_TOOL],
    tool_choice: { type: "tool", name: "submit_voice_profile" },
    messages: [{
      role: "user",
      content: `Analysiere diese Transkripte von ${clientName} und erstelle ein Stimmprofil.\n\n${transcriptBlock}`,
    }],
  });

  const toolUse = message.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;

  const profile = toolUse.input as VoiceProfile;

  // Save to config
  await supabase
    .from("configs")
    .update({ voice_profile: JSON.stringify(profile) })
    .eq("id", clientId);

  return profile;
}

/**
 * Format voice profile as a concise prompt block for script generation.
 */
export function voiceProfileToPromptBlock(profile: VoiceProfile, clientName: string): string {
  return `<voice_profile>
STIMMPROFIL von ${clientName}:
${profile.summary}

Durchschnittliche Satzlänge: ${profile.avgSentenceLength} Wörter
Tonalität: ${profile.tone}
Energie: ${profile.energy}
Satzbau-Muster: ${profile.sentencePatterns}

Lieblingswörter/-phrasen: ${profile.favoriteWords.join(", ")}
Slang/Dialekt: ${profile.slangMarkers.join(", ")}
Vermeidet: ${profile.avoidedPatterns.join(", ")}

Charakteristische Original-Sätze:
${profile.exampleSentences.map((s, i) => `${i + 1}. "${s}"`).join("\n")}

ANWEISUNG: Schreibe so dass es klingt als hätte ${clientName} es selbst geschrieben. Übernimm Wortwahl, Satzlänge, Energie und Rhythmus exakt.
</voice_profile>`;
}
