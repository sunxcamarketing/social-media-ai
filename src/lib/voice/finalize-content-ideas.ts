// ── Content-Ideas Session Finalizer ─────────────────────────────────────
// Post-session work for `content-ideas` mode (default free-form interview):
//   - Extract 1-5 video ideas from the transcript via Claude
//   - Save each as a client Idea (via the agent-tool flow)
//   - Persist the session record + emit the browser summary event

import type { WebSocket } from "ws";
import type { TranscriptEntry } from "../gemini-live";
import { executeAgentTool } from "../agent-tools";
import { generateSessionSummary, saveVoiceSession } from "./session-extractors";

export interface FinalizeContentIdeasArgs {
  ws: WebSocket;
  clientId: string;
  lang: "de" | "en";
  transcript: TranscriptEntry[];
  durationSeconds: number;
  sessionId?: string;
}

export async function finalizeContentIdeasSession({
  ws, clientId, lang, transcript, durationSeconds, sessionId,
}: FinalizeContentIdeasArgs): Promise<void> {
  // Persist the transcript first so it survives any extractor failure —
  // we can always reprocess later via scripts/reprocess-voice-sessions.ts
  // if Claude's tool-use response was malformed.
  let ideas: Awaited<ReturnType<typeof generateSessionSummary>> = [];
  try {
    // Save the voice_sessions row FIRST so source_session_id has something
    // to reference. Idea inserts that follow link back to this row, which
    // lets the script-generation pipeline pull the original transcript and
    // write scripts from the client's actual spoken words.
    await saveVoiceSession(clientId, transcript, 0, durationSeconds, sessionId);

    ideas = await generateSessionSummary(clientId, transcript, lang);
    for (const idea of ideas) {
      await executeAgentTool(clientId, "save_idea", {
        title: idea.title,
        description: idea.description,
        content_type: idea.contentType,
        source_session_id: sessionId,
      });
    }
    // Update idea count on the session row now that we know it.
    if (ideas.length > 0) {
      await saveVoiceSession(clientId, transcript, ideas.length, durationSeconds, sessionId);
    }
  } catch (err) {
    console.error(`[finalize] idea extraction failed:`, err instanceof Error ? err.message : err);
    // Best-effort fallback save in case the upfront save failed too.
    await saveVoiceSession(clientId, transcript, 0, durationSeconds, sessionId).catch(() => {});
  }

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: "summary",
      sessionId,
      ideas,
      durationSeconds,
      transcriptLength: transcript.length,
    }));
  }
  console.log(`Voice session ended: ${durationSeconds}s, ${ideas.length} ideas saved`);
}
