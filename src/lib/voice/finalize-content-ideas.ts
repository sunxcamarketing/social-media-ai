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
}

export async function finalizeContentIdeasSession({
  ws, clientId, lang, transcript, durationSeconds,
}: FinalizeContentIdeasArgs): Promise<void> {
  const ideas = await generateSessionSummary(clientId, transcript, lang);
  for (const idea of ideas) {
    await executeAgentTool(clientId, "save_idea", {
      title: idea.title,
      description: idea.description,
      content_type: idea.contentType,
    });
  }
  await saveVoiceSession(clientId, transcript, ideas.length, durationSeconds);

  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({
      type: "summary",
      ideas,
      durationSeconds,
      transcriptLength: transcript.length,
    }));
  }
  console.log(`Voice session ended: ${durationSeconds}s, ${ideas.length} ideas saved`);
}
