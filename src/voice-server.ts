// ── Voice Agent WebSocket Server ────────────────────────────────────────────
// Standalone WS server on port 4001 that proxies audio between browser and
// Gemini Live API. Runs separately from Next.js:  npm run voice-server
//
// Flow:
//   Browser (mic audio) → WS → this server → Gemini Live API
//   Gemini (audio response) → this server → WS → Browser (speakers)

import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";
import { GeminiLiveSession, type TranscriptEntry } from "./lib/gemini-live";
import { buildPrompt } from "../prompts";
import {
  executeAgentTool,
  toolLoadClientContext,
  toolLoadAudit,
  toolCheckPerformance,
  toolCheckLearnings,
} from "./lib/agent-tools";
import Anthropic from "@anthropic-ai/sdk";

// dotenv is loaded via --require dotenv/config in the npm script

const PORT = Number(process.env.VOICE_SERVER_PORT) || 4001;

// Supabase service client for auth verification
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Auth: Verify access token and return clientId ────────────────────────

async function verifyToken(token: string): Promise<{ clientId: string; userId: string } | null> {
  // Verify the Supabase access token
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  // Look up client_users to get clientId
  const { data: clientUser } = await supabase
    .from("client_users")
    .select("role, client_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!clientUser) return null;

  // Only clients can use voice agent (not admins — they don't have a clientId)
  if (clientUser.role === "client" && clientUser.client_id) {
    return { clientId: clientUser.client_id, userId: user.id };
  }

  // Admin with impersonate cookie? Check for client_id in token metadata
  // For now, admins can also test by passing ?clientId= in the URL
  if (clientUser.role === "admin") {
    return { clientId: "", userId: user.id }; // Will be overridden by query param
  }

  return null;
}

// ── Session summary: Convert transcript to content ideas ─────────────────

async function generateSessionSummary(
  clientId: string,
  transcript: TranscriptEntry[],
): Promise<Array<{ title: string; description: string; contentType: string }>> {
  // Require real back-and-forth before asking Claude to extract ideas — otherwise
  // Claude invents placeholder ("<UNKNOWN>") entries just to satisfy the schema.
  const userEntries = transcript.filter((t) => t.role === "user" && t.text.trim().length > 15);
  const modelEntries = transcript.filter((t) => t.role === "model" && t.text.trim().length > 15);
  if (userEntries.length < 2 || modelEntries.length < 1) {
    console.log(`[summary] transcript too thin (user=${userEntries.length}, model=${modelEntries.length}), skipping`);
    return [];
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn("[summary] ANTHROPIC_API_KEY not set, skipping idea extraction");
    return [];
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  const transcriptText = transcript
    .map((t) => `${t.role === "user" ? "Client" : "Agent"}: ${t.text}`)
    .join("\n");

  console.log(`[summary] extracting ideas from ${transcript.length}-entry transcript (${transcriptText.length} chars)`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system:
      "Du bist ein Content-Stratege. Extrahiere aus dem Interview NUR Video-Ideen, die auf konkreten Aussagen des Clients basieren (Story, Meinung, Erfahrung, Tipp). Wenn der Client nichts Substantielles gesagt hat, rufe das Tool NICHT auf. Erfinde NICHTS. Keine Platzhalter, keine <UNKNOWN>-Werte.",
    tools: [
      {
        name: "save_ideas",
        description:
          "Speichere 1-5 konkrete Video-Ideen aus dem Interview. NUR aufrufen wenn mindestens eine echte, auf Client-Aussagen basierende Idee existiert.",
        input_schema: {
          type: "object",
          properties: {
            ideas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Max 10 Wörter, spezifisch, basiert auf echter Aussage" },
                  description: { type: "string", description: "1-2 Sätze mit dem Kern der Geschichte/Meinung" },
                  contentType: { type: "string", enum: ["Storytelling", "Meinung", "Tipp", "Erfahrung", "Aufklärung"] },
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
    ],
    messages: [{ role: "user", content: transcriptText }],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) {
    console.log("[summary] Claude found no substantive ideas — nothing saved");
    return [];
  }

  const input = toolUse.input as { ideas: Array<{ title: string; description: string; contentType: string }> };
  const raw = input.ideas || [];

  const isPlaceholder = (s: string) => /^<?unknown>?$/i.test(s.trim()) || s.trim().length < 5;
  const cleaned = raw.filter((i) => !isPlaceholder(i.title) && !isPlaceholder(i.description));

  if (cleaned.length < raw.length) {
    console.warn(`[summary] dropped ${raw.length - cleaned.length} placeholder idea(s)`);
  }
  console.log(`[summary] extracted ${cleaned.length} idea(s)`);
  return cleaned;
}

// ── Save session to Supabase ─────────────────────────────────────────────

async function saveVoiceSession(
  clientId: string,
  transcript: TranscriptEntry[],
  ideasGenerated: number,
  durationSeconds: number,
): Promise<void> {
  const id = crypto.randomUUID();
  await supabase.from("voice_sessions").insert({
    id,
    client_id: clientId,
    transcript: JSON.stringify(transcript),
    ideas_generated: ideasGenerated,
    duration_seconds: durationSeconds,
    created_at: new Date().toISOString().split("T")[0],
  });
}

// ── WebSocket Server ─────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

console.log(`Voice server listening on ws://localhost:${PORT}`);

wss.on("connection", async (ws: WebSocket, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const token = url.searchParams.get("token");
  const clientIdOverride = url.searchParams.get("clientId"); // For admin testing

  if (!token) {
    ws.close(4001, "Missing token");
    return;
  }

  // Verify auth
  const auth = await verifyToken(token);
  if (!auth) {
    ws.close(4003, "Unauthorized");
    return;
  }

  const clientId = clientIdOverride || auth.clientId;
  if (!clientId) {
    ws.close(4004, "No client ID");
    return;
  }

  console.log(`Voice session started for client: ${clientId}`);
  const sessionStart = Date.now();

  // Pre-load the full context (client profile, audit, performance, learnings)
  // in parallel and inline it into the system prompt. The agent runs WITHOUT
  // tools during the session — this avoids the known 1008 "Requested entity
  // was not found" bug in gemini-2.5-flash-native-audio-* models that triggers
  // during tool-call exchanges (tracked in googleapis/js-genai#1236). Ideas
  // are extracted by Claude at session end from the transcript.
  const [clientContext, auditContext, performanceContext, learningsContext] = await Promise.all([
    toolLoadClientContext(clientId).catch(() => ""),
    toolLoadAudit(clientId).catch(() => ""),
    toolCheckPerformance(clientId).catch(() => ""),
    toolCheckLearnings(clientId).catch(() => ""),
  ]);

  const basePrompt = buildPrompt("voice-agent", {});
  const contextSections: string[] = [];
  if (clientContext) contextSections.push(`## CLIENT-PROFIL\n${clientContext}`);
  if (auditContext) contextSections.push(`## AUDIT-FINDINGS\n${auditContext}`);
  if (performanceContext) contextSections.push(`## PERFORMANCE-DATEN\n${performanceContext}`);
  if (learningsContext) contextSections.push(`## LEARNINGS\n${learningsContext}`);

  const systemPrompt = `${basePrompt}\n\n# VORAB GELADENER KONTEXT\n\nDu hast alle relevanten Daten bereits unten. Nutze sie direkt im Gespräch — keine Tool-Calls nötig.\n\n${contextSections.join("\n\n")}`;
  console.log(`[voice-server] system prompt: ${systemPrompt.length} chars (context pre-loaded, NO tools)`);

  // Create Gemini Live session
  const geminiSession = new GeminiLiveSession();

  let connected = false;

  try {
    let audioChunks = 0;
    let firstChunkSent = false;
    await geminiSession.connect({
      clientId,
      systemPrompt,
      tools: [],
      onAudioOutput: (audioBase64: string) => {
        audioChunks++;
        if (audioChunks === 1 || audioChunks % 50 === 0) {
          console.log(`[gemini→browser] audio chunk #${audioChunks} (${audioBase64.length} b64 chars)`);
        }
        if (ws.readyState === WebSocket.OPEN) {
          // On the very first audio chunk, signal the browser that the agent
          // is about to speak — this is when the UI should flip from loading
          // to "active".
          if (!firstChunkSent) {
            firstChunkSent = true;
            ws.send(JSON.stringify({ type: "speaking" }));
          }
          ws.send(JSON.stringify({ type: "audio", data: audioBase64 }));
        }
      },
      onTranscript: (role: "user" | "model", text: string) => {
        console.log(`[transcript ${role}] ${text}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "transcript", role, text }));
        }
      },
      onToolCall: async (name: string, args: Record<string, unknown>) => {
        console.log(`[tool call] ${name}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tool_status", tool: name, status: "running" }));
        }

        const result = await executeAgentTool(clientId, name, args);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "tool_status", tool: name, status: "done" }));
        }

        return result;
      },
      onInterrupted: () => {
        console.log("[interrupted]");
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "interrupted" }));
        }
      },
      onError: (error: Error) => {
        console.error("Gemini error:", error.message);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "error", message: error.message }));
        }
      },
    });

    connected = true;

    // Tell the browser the session is reserved — it should open mic access now
    // so it's ready when the agent starts speaking.
    ws.send(JSON.stringify({ type: "ready" }));
    console.log("[voice-server] ✅ sent 'ready' to browser");

    // Trigger the first agent turn. System prompt already includes full context.
    // recordInTranscript:false keeps the internal trigger out of the summary.
    console.log("[voice-server] sending greeting trigger to Gemini...");
    await geminiSession.sendText(
      "Begrüße mich jetzt mit EINEM kurzen, lockeren deutschen Satz — nutze gerne meinen Namen oder meine Nische.",
      { recordInTranscript: false },
    );
    console.log("[voice-server] greeting trigger sent — waiting for first audio chunk");
  } catch (err) {
    console.error("Failed to connect to Gemini:", err);
    ws.close(4005, "Gemini connection failed");
    return;
  }

  // Handle messages from browser
  ws.on("message", async (data: Buffer | string) => {
    try {
      const message = JSON.parse(typeof data === "string" ? data : data.toString());

      if (message.type === "audio" && message.data) {
        // Forward audio to Gemini
        await geminiSession.sendAudio(message.data);
      } else if (message.type === "text" && message.text) {
        // Forward text to Gemini (fallback/debug)
        await geminiSession.sendText(message.text);
      } else if (message.type === "end") {
        // Client wants to end the session
        await endSession();
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  // Handle disconnect
  ws.on("close", async () => {
    if (connected) {
      await endSession();
    }
  });

  async function endSession() {
    if (!connected) return;
    connected = false;

    const durationSeconds = Math.round((Date.now() - sessionStart) / 1000);
    const { transcript } = await geminiSession.close();

    // Generate summary and save ideas
    try {
      const ideas = await generateSessionSummary(clientId, transcript);

      // Save each idea
      for (const idea of ideas) {
        await executeAgentTool(clientId, "save_idea", {
          title: idea.title,
          description: idea.description,
          content_type: idea.contentType,
        });
      }

      // Save session
      await saveVoiceSession(clientId, transcript, ideas.length, durationSeconds);

      // Send summary to browser if still connected
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "summary",
          ideas,
          durationSeconds,
          transcriptLength: transcript.length,
        }));
      }

      console.log(`Voice session ended: ${durationSeconds}s, ${ideas.length} ideas saved`);
    } catch (err) {
      console.error("Error generating summary:", err);
    }
  }
});
