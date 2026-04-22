// ── Background Job: Voice-Profile Drift Detector ─────────────────────────
// When a new training script is added, diff the fresh sample against the
// cached VoiceProfile. Claude Haiku scores whether the client's voice has
// drifted. Three outcomes:
//   - "stable"      → profile still accurate, do nothing
//   - "shifted"     → drift detected, flag for review (UI notification)
//   - "re-extract"  → material drift, trigger voice-profile regeneration
//
// Cheap (Haiku), fast, fire-and-forget. Keeps the cached profile from
// silently drifting out of sync with how the client actually sounds now.

import Anthropic from "@anthropic-ai/sdk";
import { readConfig, readTrainingScriptsByClient } from "../csv";
import { getVoiceProfile, generateVoiceProfile } from "../voice-profile";
import { saveSnapshot } from "../intelligence";

const DRIFT_MODEL = "claude-haiku-4-5-20251001";
const DRIFT_TIMEOUT_MS = 20_000;
const RECENT_SAMPLE_WINDOW = 5; // last N training scripts to compare against cache

export type DriftVerdict = "stable" | "shifted" | "re-extract";

export interface VoiceDriftReport {
  checkedAt: string;
  clientId: string;
  verdict: DriftVerdict;
  reasoning: string;
  driftedDimensions: string[]; // e.g. ["tone", "energy", "sentencePatterns"]
  sampleCount: number;
  reExtracted: boolean;
}

export async function detectVoiceDrift(clientId: string): Promise<VoiceDriftReport | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[voice-drift] ANTHROPIC_API_KEY not set, skipping");
    return null;
  }

  const [config, cachedProfile, trainingScripts] = await Promise.all([
    readConfig(clientId),
    getVoiceProfile(clientId),
    readTrainingScriptsByClient(clientId),
  ]);

  if (!config || !cachedProfile) {
    // No cached profile → nothing to diff against. Profile is generated on next
    // pipeline run anyway; drift detection is only meaningful when a baseline exists.
    console.log(`[voice-drift] client ${clientId}: no cached profile, skipping drift check`);
    return null;
  }

  // Look at the most recent training samples — these are what might have shifted
  // the voice (new transcripts, voice-profile recorder sessions, etc).
  const recentSamples = trainingScripts
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, RECENT_SAMPLE_WINDOW);

  if (recentSamples.length < 2) {
    console.log(`[voice-drift] client ${clientId}: only ${recentSamples.length} recent sample(s), need ≥2 to detect drift`);
    return null;
  }

  const sampleText = recentSamples
    .map((s, i) => {
      const body = [s.audioHook && `Hook: ${s.audioHook}`, s.script && `Body: ${s.script}`].filter(Boolean).join("\n");
      return `--- Sample ${i + 1}${s.format ? ` (${s.format})` : ""} ---\n${body}`;
    })
    .join("\n\n");

  const profileSummary = `Tone: ${cachedProfile.tone}
Energy: ${cachedProfile.energy}
Sentence patterns: ${cachedProfile.sentencePatterns}
Favorite words: ${cachedProfile.favoriteWords.slice(0, 10).join(", ")}
Slang markers: ${cachedProfile.slangMarkers.slice(0, 10).join(", ")}
Example sentences: ${cachedProfile.exampleSentences.slice(0, 3).join(" | ")}`;

  const lang = config.language === "en" ? "en" : "de";
  const system = lang === "en"
    ? `You detect drift between a cached voice profile and recent samples of how a creator writes/speaks now. Be strict but fair. Drift ≠ natural variation — drift means the tone, energy, sentence rhythm, or vocabulary has MATERIALLY shifted. Return verdict + reasoning + which dimensions drifted (tone / energy / sentencePatterns / favoriteWords / slangMarkers).`
    : `Du erkennst Drift zwischen einem gecachten Voice-Profil und aktuellen Samples wie der Creator jetzt schreibt/spricht. Sei streng aber fair. Drift ≠ natürliche Variation — Drift heißt, Ton, Energie, Satzrhythmus oder Wortwahl haben sich MATERIELL verschoben. Gib Verdict + Reasoning + welche Dimensionen gedriftet sind (tone / energy / sentencePatterns / favoriteWords / slangMarkers).`;

  const userContent = `## Cached Voice Profile
${profileSummary}

## Recent Samples
${sampleText}`;

  const client = new Anthropic({ apiKey });
  try {
    const response = await Promise.race([
      client.messages.create({
        model: DRIFT_MODEL,
        max_tokens: 1000,
        system,
        tools: [{
          name: "submit_drift_verdict",
          description: "Submit drift detection result.",
          input_schema: {
            type: "object",
            properties: {
              verdict: {
                type: "string",
                enum: ["stable", "shifted", "re-extract"],
                description: "stable=profile still accurate, shifted=notable drift flag for review, re-extract=material drift regenerate profile",
              },
              reasoning: { type: "string", description: "1-2 sentences explaining the verdict" },
              drifted_dimensions: {
                type: "array",
                items: { type: "string", enum: ["tone", "energy", "sentencePatterns", "favoriteWords", "slangMarkers"] },
                description: "Which profile dimensions actually drifted",
              },
            },
            required: ["verdict", "reasoning", "drifted_dimensions"],
          },
        }],
        tool_choice: { type: "tool", name: "submit_drift_verdict" },
        messages: [{ role: "user", content: userContent }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`voice-drift timeout after ${DRIFT_TIMEOUT_MS}ms`)), DRIFT_TIMEOUT_MS),
      ),
    ]);

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUse) return null;

    const raw = toolUse.input as {
      verdict: DriftVerdict;
      reasoning: string;
      drifted_dimensions: string[];
    };

    let reExtracted = false;
    // On "re-extract" verdict: regenerate the voice profile now so next
    // pipeline run already sees the updated version.
    if (raw.verdict === "re-extract") {
      try {
        const clientName = config.name || config.configName || "Client";
        await generateVoiceProfile(clientId, clientName, lang);
        reExtracted = true;
        console.log(`[voice-drift] client ${clientId}: re-extracted voice profile due to material drift`);
      } catch (err) {
        console.error(`[voice-drift] re-extraction failed for ${clientId}:`, err);
      }
    }

    const report: VoiceDriftReport = {
      checkedAt: new Date().toISOString(),
      clientId,
      verdict: raw.verdict,
      reasoning: raw.reasoning || "",
      driftedDimensions: Array.isArray(raw.drifted_dimensions) ? raw.drifted_dimensions : [],
      sampleCount: recentSamples.length,
      reExtracted,
    };

    await saveSnapshot(clientId, "voice_drift", report as unknown as Record<string, unknown>, { expiryDays: 60 });
    console.log(`[voice-drift] ${clientId}: verdict=${report.verdict}, drifted=[${report.driftedDimensions.join(",")}], reExtracted=${reExtracted}`);

    return report;
  } catch (err) {
    console.error("[voice-drift] failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
