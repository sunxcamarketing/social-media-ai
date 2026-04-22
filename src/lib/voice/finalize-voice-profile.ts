// ── Voice-Profile Session Finalizer ─────────────────────────────────────
// Post-session work for `voice-profile` mode: persist the user's spoken lines
// as a training sample (feeds voice-profile extraction pipeline), write the
// voice-session record, and emit the browser summary event.

import crypto from "crypto";
import type { WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";
import type { TranscriptEntry } from "../gemini-live";
import type { VoiceProfileStep } from "../voice-profile-scenarios";

const MIN_SAMPLE_CHARS = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function saveVoiceSessionRecord(
  clientId: string,
  transcript: TranscriptEntry[],
  durationSeconds: number,
): Promise<void> {
  const id = crypto.randomUUID();
  await supabase.from("voice_sessions").insert({
    id,
    client_id: clientId,
    transcript,
    ideas_generated: 0,
    duration_seconds: durationSeconds,
    created_at: new Date().toISOString().split("T")[0],
  });
}

export interface FinalizeVoiceProfileArgs {
  ws: WebSocket;
  clientId: string;
  transcript: TranscriptEntry[];
  durationSeconds: number;
  step: VoiceProfileStep;
}

/**
 * Finalize a voice-profile recording step. Saves the transcript as a
 * `training_scripts` row with a `voice-profile-{step_id}` format tag so the
 * voice-profile extractor (src/lib/voice-profile.ts) can distinguish spoken
 * interview samples from broadcast scripts.
 */
export async function finalizeVoiceProfileSession(args: FinalizeVoiceProfileArgs): Promise<void> {
  const { ws, clientId, transcript, durationSeconds, step } = args;

  // Extract only the user's spoken lines — this is the actual voice sample.
  // Model prompts (topic-mode questions) are useful context for extraction
  // elsewhere but shouldn't pollute the sample text itself.
  const userLines = transcript
    .filter((t) => t.role === "user")
    .map((t) => t.text.trim())
    .filter(Boolean);
  const combined = userLines.join("\n\n");

  if (combined.length < MIN_SAMPLE_CHARS) {
    console.warn(`[voice-profile] step ${step.id}: sample too short (${combined.length} chars), skipping save`);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: "voice_profile_summary",
        stepId: step.id,
        saved: false,
        durationSeconds,
        reason: "Sample zu kurz",
      }));
    }
    return;
  }

  // Persist as training sample — feeds voice-profile extraction.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("training_scripts").insert({
    id,
    client_id: clientId,
    format: `voice-profile-${step.id}`,
    text_hook: "",
    visual_hook: "",
    audio_hook: "",
    script: combined,
    cta: "",
    source_id: `voice-profile-${step.id}`,
    created_at: new Date().toISOString().split("T")[0],
  });
  if (error) {
    console.error("[voice-profile] save failed:", error.message);
  } else {
    console.log(`[voice-profile] saved sample for step ${step.id} (${combined.length} chars)`);
  }

  // Save voice session record for replay/debug (best-effort).
  saveVoiceSessionRecord(clientId, transcript, durationSeconds).catch((err) => {
    console.error("[voice-profile] saveVoiceSessionRecord failed:", err);
  });

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: "voice_profile_summary",
      stepId: step.id,
      saved: !error,
      durationSeconds,
      transcriptLength: transcript.length,
      sampleChars: combined.length,
    }));
  }
  console.log(`[voice-profile] step ${step.id} finalized: ${durationSeconds}s, ${combined.length} chars sample`);
}
