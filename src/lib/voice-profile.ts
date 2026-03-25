// ── Voice & Script Structure Profile System ──────────────────────────────────
// Two separate profiles, both cached on the config:
// 1. Voice Profile — HOW the person speaks (tone, words, rhythm, examples)
// 2. Script Structure Profile — HOW scripts are built (dramaturgy, flow, patterns)
// Both use ALL training documents. Batched analysis for large document sets.

import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "./supabase";
import { readTrainingScripts, readConfigs } from "./csv";
import { buildPrompt, VOICE_PROFILE_TOOL, SCRIPT_STRUCTURE_TOOL } from "@prompts";
import type { VoiceProfile, ScriptStructureProfile } from "./types";

const BATCH_SIZE = 15; // docs per Claude call
const MODEL = "claude-sonnet-4-6";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTranscript(ts: { audioHook?: string; script?: string; cta?: string; format?: string }, index: number): string {
  const parts = [
    ts.audioHook && `Hook: ${ts.audioHook}`,
    ts.script && `Body: ${ts.script}`,
    ts.cta && `CTA: ${ts.cta}`,
  ].filter(Boolean).join("\n");
  return `--- Transkript ${index + 1}${ts.format ? ` (${ts.format})` : ""} ---\n${parts}`;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Voice Profile ───────────────────────────────────────────────────────────

/**
 * Read cached voice profile from config, or null if none exists.
 */
export async function getVoiceProfile(clientId: string): Promise<VoiceProfile | null> {
  const configs = await readConfigs();
  const config = configs.find(c => c.id === clientId);
  if (!config) return null;

  const raw = config.voiceProfile || (config as unknown as Record<string, unknown>).voice_profile;
  if (!raw) return null;

  try {
    return typeof raw === "string" ? JSON.parse(raw) as VoiceProfile : raw as VoiceProfile;
  } catch {
    return null;
  }
}

/**
 * Generate voice profile from ALL training scripts with batched analysis.
 * If ≤15 docs: single call. If >15: batch analysis + merge step.
 */
export async function generateVoiceProfile(
  clientId: string,
  clientName: string,
): Promise<VoiceProfile | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const trainingScripts = (await readTrainingScripts()).filter(ts => ts.clientId === clientId);
  if (trainingScripts.length === 0) return null;

  const client = new Anthropic({ apiKey });

  // Single batch — fits in one call
  if (trainingScripts.length <= BATCH_SIZE) {
    const transcriptBlock = trainingScripts.map((ts, i) => formatTranscript(ts, i)).join("\n\n");
    const profile = await extractVoiceProfileSingle(client, clientName, transcriptBlock);
    if (profile) await saveVoiceProfile(clientId, profile);
    return profile;
  }

  // Multiple batches — extract partial profiles, then merge
  const chunks = chunkArray(trainingScripts, BATCH_SIZE);
  const partialProfiles: VoiceProfile[] = [];

  for (const chunk of chunks) {
    const transcriptBlock = chunk.map((ts, i) => formatTranscript(ts, i)).join("\n\n");
    const partial = await extractVoiceProfileSingle(client, clientName, transcriptBlock);
    if (partial) partialProfiles.push(partial);
  }

  if (partialProfiles.length === 0) return null;
  if (partialProfiles.length === 1) {
    await saveVoiceProfile(clientId, partialProfiles[0]);
    return partialProfiles[0];
  }

  // Merge step — consolidate partial profiles into one
  const merged = await mergeVoiceProfiles(client, clientName, partialProfiles);
  if (merged) await saveVoiceProfile(clientId, merged);
  return merged;
}

async function extractVoiceProfileSingle(
  client: Anthropic,
  clientName: string,
  transcriptBlock: string,
): Promise<VoiceProfile | null> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: buildPrompt("voice-profile"),
    tools: [VOICE_PROFILE_TOOL],
    tool_choice: { type: "tool", name: "submit_voice_profile" },
    messages: [{
      role: "user",
      content: `Analysiere diese Transkripte von ${clientName} und erstelle ein Stimmprofil.\n\n${transcriptBlock}`,
    }],
  });

  const toolUse = message.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;
  return toolUse.input as VoiceProfile;
}

async function mergeVoiceProfiles(
  client: Anthropic,
  clientName: string,
  profiles: VoiceProfile[],
): Promise<VoiceProfile | null> {
  const profileSummaries = profiles.map((p, i) =>
    `--- Batch ${i + 1} ---
Summary: ${p.summary}
Satzlänge: ${p.avgSentenceLength} Wörter
Ton: ${p.tone}
Energie: ${p.energy}
Satzbau: ${p.sentencePatterns}
Lieblingswörter: ${p.favoriteWords.join(", ")}
Slang: ${p.slangMarkers.join(", ")}
Vermeidet: ${p.avoidedPatterns.join(", ")}
Beispielsätze: ${p.exampleSentences.map(s => `"${s}"`).join(" | ")}`
  ).join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `${buildPrompt("voice-profile")}

ZUSÄTZLICHE AUFGABE: Du bekommst mehrere Teilanalysen aus verschiedenen Batches von Transkripten. Konsolidiere sie zu EINEM finalen Stimmprofil. Behalte die besten und charakteristischsten Beispiele. Fasse Muster zusammen die in mehreren Batches vorkommen.`,
    tools: [VOICE_PROFILE_TOOL],
    tool_choice: { type: "tool", name: "submit_voice_profile" },
    messages: [{
      role: "user",
      content: `Konsolidiere diese ${profiles.length} Teilanalysen von ${clientName} zu einem finalen Stimmprofil:\n\n${profileSummaries}`,
    }],
  });

  const toolUse = message.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;
  return toolUse.input as VoiceProfile;
}

async function saveVoiceProfile(clientId: string, profile: VoiceProfile) {
  await supabase
    .from("configs")
    .update({ voice_profile: JSON.stringify(profile) })
    .eq("id", clientId);
}

// ── Script Structure Profile ────────────────────────────────────────────────

/**
 * Read cached script structure from config, or null if none exists.
 */
export async function getScriptStructure(clientId: string): Promise<ScriptStructureProfile | null> {
  const configs = await readConfigs();
  const config = configs.find(c => c.id === clientId);
  if (!config) return null;

  const raw = config.scriptStructure || (config as unknown as Record<string, unknown>).script_structure;
  if (!raw) return null;

  try {
    return typeof raw === "string" ? JSON.parse(raw) as ScriptStructureProfile : raw as ScriptStructureProfile;
  } catch {
    return null;
  }
}

/**
 * Generate script structure profile from ALL training scripts.
 * Batched analysis for large document sets, same as voice profile.
 */
export async function generateScriptStructure(
  clientId: string,
  clientName: string,
): Promise<ScriptStructureProfile | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const trainingScripts = (await readTrainingScripts()).filter(ts => ts.clientId === clientId);
  if (trainingScripts.length === 0) return null;

  const client = new Anthropic({ apiKey });

  if (trainingScripts.length <= BATCH_SIZE) {
    const transcriptBlock = trainingScripts.map((ts, i) => formatTranscript(ts, i)).join("\n\n");
    const structure = await extractScriptStructureSingle(client, clientName, transcriptBlock);
    if (structure) await saveScriptStructure(clientId, structure);
    return structure;
  }

  // Multiple batches
  const chunks = chunkArray(trainingScripts, BATCH_SIZE);
  const partials: ScriptStructureProfile[] = [];

  for (const chunk of chunks) {
    const transcriptBlock = chunk.map((ts, i) => formatTranscript(ts, i)).join("\n\n");
    const partial = await extractScriptStructureSingle(client, clientName, transcriptBlock);
    if (partial) partials.push(partial);
  }

  if (partials.length === 0) return null;
  if (partials.length === 1) {
    await saveScriptStructure(clientId, partials[0]);
    return partials[0];
  }

  const merged = await mergeScriptStructures(client, clientName, partials);
  if (merged) await saveScriptStructure(clientId, merged);
  return merged;
}

async function extractScriptStructureSingle(
  client: Anthropic,
  clientName: string,
  transcriptBlock: string,
): Promise<ScriptStructureProfile | null> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: buildPrompt("script-structure"),
    tools: [SCRIPT_STRUCTURE_TOOL],
    tool_choice: { type: "tool", name: "submit_script_structure" },
    messages: [{
      role: "user",
      content: `Analysiere den AUFBAU und die STRUKTUR dieser Skripte von ${clientName}. Wie sind sie aufgebaut? Welche Muster wiederholen sich?\n\n${transcriptBlock}`,
    }],
  });

  const toolUse = message.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;
  return toolUse.input as ScriptStructureProfile;
}

async function mergeScriptStructures(
  client: Anthropic,
  clientName: string,
  structures: ScriptStructureProfile[],
): Promise<ScriptStructureProfile | null> {
  const summaries = structures.map((s, i) =>
    `--- Batch ${i + 1} ---
Summary: ${s.summary}
Dramaturgischer Bogen: ${s.dramaturgicFlow}
Ø Absätze: ${s.avgParagraphs}
Hook-Muster: ${s.hookPatterns.map(h => `${h.pattern} (${h.frequency}): "${h.example}"`).join(" | ")}
Body-Strukturen: ${s.bodyStructures.map(b => `${b.name}: ${b.steps.join(" → ")}`).join(" | ")}
Übergänge: ${s.transitionPatterns.join(", ")}
CTA-Muster: ${s.ctaPatterns.map(c => `${c.pattern}: "${c.example}"`).join(" | ")}
Regeln: ${s.keyRules.join(" | ")}`
  ).join("\n\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `${buildPrompt("script-structure")}

ZUSÄTZLICHE AUFGABE: Du bekommst mehrere Teilanalysen aus verschiedenen Batches. Konsolidiere sie zu EINEM finalen Struktur-Profil. Priorisiere Muster die in mehreren Batches vorkommen — die sind die echten Gewohnheiten.`,
    tools: [SCRIPT_STRUCTURE_TOOL],
    tool_choice: { type: "tool", name: "submit_script_structure" },
    messages: [{
      role: "user",
      content: `Konsolidiere diese ${structures.length} Teilanalysen der Skript-Struktur von ${clientName} zu einem finalen Profil:\n\n${summaries}`,
    }],
  });

  const toolUse = message.content.find(b => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") return null;
  return toolUse.input as ScriptStructureProfile;
}

async function saveScriptStructure(clientId: string, structure: ScriptStructureProfile) {
  await supabase
    .from("configs")
    .update({ script_structure: JSON.stringify(structure) })
    .eq("id", clientId);
}

// ── Prompt Formatters ───────────────────────────────────────────────────────

/**
 * Format voice profile as a prompt block for script generation.
 * Focus: HOW the person speaks.
 */
export function voiceProfileToPromptBlock(profile: VoiceProfile, clientName: string): string {
  return `<voice_profile>
STIMMPROFIL von ${clientName} — SO SPRICHT DIESE PERSON:
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

/**
 * Format script structure as a prompt block for script generation.
 * Focus: HOW scripts are built (dramaturgy, not voice).
 */
export function scriptStructureToPromptBlock(structure: ScriptStructureProfile): string {
  const hookSection = structure.hookPatterns
    .map(h => `- ${h.pattern} (${h.frequency}): ${h.description}\n  Beispiel: "${h.example}"`)
    .join("\n");

  const bodySection = structure.bodyStructures
    .map(b => `- ${b.name}: ${b.steps.join(" → ")}\n  Beispiel: ${b.example}`)
    .join("\n");

  const ctaSection = structure.ctaPatterns
    .map(c => `- ${c.pattern}: "${c.example}"`)
    .join("\n");

  return `<script_structure>
SKRIPT-AUFBAU — SO WERDEN SKRIPTE STRUKTURIERT:
${structure.summary}

DRAMATURGISCHER BOGEN: ${structure.dramaturgicFlow}
DURCHSCHNITTLICHE ABSÄTZE (Body): ${structure.avgParagraphs}

HOOK-EINSTIEGSMUSTER:
${hookSection}

BODY-AUFBAU-MUSTER:
${bodySection}

ÜBERGANGSTECHNIKEN: ${structure.transitionPatterns.join(", ")}

CTA-MUSTER:
${ctaSection}

STRUKTURREGELN:
${structure.keyRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

ANWEISUNG: Folge diesen Strukturmustern beim Aufbau des Skripts. Hook, Body-Dramaturgie und CTA müssen diesen Mustern entsprechen.
</script_structure>`;
}
