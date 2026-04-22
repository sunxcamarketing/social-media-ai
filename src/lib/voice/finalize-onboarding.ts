// ── Onboarding Session Finalizer ────────────────────────────────────────
// Post-session work for `onboarding` mode (structured 8-block interview):
//   1. FAST PATH: save transcript + send summary event so the browser unblocks
//   2. SLOW PATH: background Claude enrichment — per-block extraction,
//      voice-DNA synthesis (when all 8 blocks done), profile field suggestions

import type { WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";
import type { TranscriptEntry } from "../gemini-live";
import { VOICE_BLOCK_ORDER, type Config } from "../types";
import { loadVoiceOnboarding, saveVoiceOnboarding, synthesizeVoiceOnboarding } from "../voice-onboarding";
import {
  saveVoiceSession,
  extractOnboardingBlocks,
  extractProfileSuggestions,
  type FieldSuggestion,
} from "./session-extractors";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface FinalizeOnboardingArgs {
  ws: WebSocket;
  clientId: string;
  lang: "de" | "en";
  transcript: TranscriptEntry[];
  durationSeconds: number;
}

export async function finalizeOnboardingSession({
  ws, clientId, lang, transcript, durationSeconds,
}: FinalizeOnboardingArgs): Promise<void> {
  // FAST PATH: persist the baseline data and send the summary event IMMEDIATELY.
  // Provisional block marks from the live signal-phrase parser are already in DB,
  // so a resumable state exists even if all Claude extractions fail.
  const onboarding = await loadVoiceOnboarding(clientId);
  const doneCount = onboarding.blocks.filter((b) => b.status === "done").length;

  // Best-effort: persist transcript. Don't let a DB hiccup block the UI summary.
  saveVoiceSession(clientId, transcript, doneCount, durationSeconds).catch((err) => {
    console.error("[onboarding] saveVoiceSession failed:", err);
  });

  console.log(`[onboarding] session ended: ${durationSeconds}s, ${doneCount}/8 blocks done (summary sent, Claude extraction backgrounded)`);

  // Send summary NOW — browser unblocks. Flag tells UI that Claude enrichment
  // is still running and suggestions may arrive later via onboarding_enriched.
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: "onboarding_summary",
      doneCount,
      total: VOICE_BLOCK_ORDER.length,
      durationSeconds,
      transcriptLength: transcript.length,
      synthesisGenerated: false,
      fieldSuggestions: [],
      backgroundProcessing: true,
    }));
  }

  // SLOW PATH: fire-and-forget. Runs Claude passes with per-call 45s timeouts.
  enrichOnboardingInBackground({ ws, clientId, lang, transcript }).catch((err) => {
    console.error("[onboarding-bg] background enrichment crashed:", err);
  });
}

async function enrichOnboardingInBackground(args: {
  ws: WebSocket;
  clientId: string;
  lang: "de" | "en";
  transcript: TranscriptEntry[];
}): Promise<void> {
  const { ws, clientId, lang, transcript } = args;

  // 1. Authoritative per-block extraction — overwrites provisional marks
  //    (which have empty summary/quotes).
  const extracted = await extractOnboardingBlocks(transcript, lang);
  const onboarding = await loadVoiceOnboarding(clientId);
  for (const eb of extracted) {
    const block = onboarding.blocks.find((b) => b.id === eb.block_id);
    if (!block) continue;
    block.status = "done";
    block.summary = (eb.summary || "").trim();
    block.quotes = Array.isArray(eb.quotes) ? eb.quotes.map((q) => String(q).trim()).filter(Boolean).slice(0, 5) : [];
    block.completedAt = new Date().toISOString();
  }
  const nextOpen = onboarding.blocks.find((b) => b.status === "pending");
  onboarding.currentBlockId = nextOpen?.id || "resources";
  onboarding.updatedAt = new Date().toISOString();
  await saveVoiceOnboarding(clientId, onboarding);
  const doneCount = onboarding.blocks.filter((b) => b.status === "done").length;
  console.log(`[onboarding-bg] ${extracted.length} block(s) enriched from transcript`);

  // 2. Synthesis (only when all 8 done)
  let synthesis = "";
  if (doneCount >= VOICE_BLOCK_ORDER.length) {
    try {
      synthesis = await synthesizeVoiceOnboarding(clientId, lang);
      console.log(`[onboarding-bg] synthesis: ${synthesis.length} chars`);
    } catch (err) {
      console.error("[onboarding-bg] synthesis failed:", err);
    }
  }

  // 3. Profile field suggestions
  let fieldSuggestions: FieldSuggestion[] = [];
  try {
    const { data: fullConfig } = await supabase.from("configs").select("*").eq("id", clientId).single();
    if (fullConfig) {
      fieldSuggestions = await extractProfileSuggestions(transcript, fullConfig as Partial<Config>, lang);
    }
  } catch (err) {
    console.error("[onboarding-bg] profile-suggestions failed:", err);
  }

  // 4. Notify browser if still connected — it may have moved on already.
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: "onboarding_enriched",
      doneCount,
      synthesisGenerated: !!synthesis,
      fieldSuggestions,
    }));
    console.log("[onboarding-bg] enrichment event sent to browser");
  } else {
    console.log("[onboarding-bg] browser already disconnected — enrichment saved to DB only");
  }
}
