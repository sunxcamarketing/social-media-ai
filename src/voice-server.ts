// ── Voice Agent WebSocket Server ────────────────────────────────────────────
// Standalone WS server on port 4001 that proxies audio between browser and
// Gemini Live API. Runs separately from Next.js:  npm run voice-server
//
// Flow:
//   Browser (mic audio) → WS → this server → Gemini Live API
//   Gemini (audio response) → this server → WS → Browser (speakers)

import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "@supabase/supabase-js";
import { GeminiLiveSession } from "./lib/gemini-live";
import { buildPrompt } from "../prompts";
import {
  executeAgentTool,
  toolLoadClientContext,
  toolLoadAudit,
  toolCheckPerformance,
  toolCheckLearnings,
} from "./lib/agent-tools";
import {
  loadVoiceOnboarding,
  markBlockComplete,
  buildOnboardingProgressBlock,
} from "./lib/voice-onboarding";
import { VOICE_BLOCK_ORDER, type VoiceBlockId } from "./lib/types";
import { getStep, type VoiceProfileStep } from "./lib/voice-profile-scenarios";
import { finalizeVoiceProfileSession } from "./lib/voice/finalize-voice-profile";
import { finalizeOnboardingSession } from "./lib/voice/finalize-onboarding";
import { finalizeContentIdeasSession } from "./lib/voice/finalize-content-ideas";
import { saveVoiceSession } from "./lib/voice/session-extractors";
import { trackGeminiLiveSession } from "./lib/cost-tracking";

// dotenv is loaded via --require dotenv/config in the npm script

// PORT wins (cloud convention: Fly.io, Railway, Heroku all set PORT).
// VOICE_SERVER_PORT only applies in local dev.
const PORT = Number(process.env.PORT || process.env.VOICE_SERVER_PORT) || 4001;

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
  const { data: clientUser, error: lookupError } = await supabase
    .from("client_users")
    .select("role, client_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  // Mirror the main app's `getCurrentUser`: a successfully authenticated user
  // with no `client_users` row is treated as a bootstrap admin (the original
  // account before the table was populated). They can connect, but must pass
  // ?clientId= explicitly to scope the session.
  const NO_ROWS_FOUND = "PGRST116";
  if (!clientUser) {
    if (lookupError && lookupError.code !== NO_ROWS_FOUND) return null;
    return { clientId: "", userId: user.id };
  }

  if (clientUser.role === "client" && clientUser.client_id) {
    return { clientId: clientUser.client_id, userId: user.id };
  }

  // Admin with a client_users row — same deal: clientId comes from query param.
  if (clientUser.role === "admin") {
    return { clientId: "", userId: user.id };
  }

  return null;
}

// ── Previous-sessions context (multi-session memory) ─────────────────────
// Loads the last 3 voice_sessions rows and condenses substantial client turns
// across them, deduplicated by normalized text prefix so a story repeated
// across two sessions only appears once. Gives the agent a broader picture of
// what the client typically talks about, beyond just the most recent call.

interface PreviousSessionTurn {
  role: string;
  text: string;
  timestamp?: string;
}

function normalizeForDedup(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
}

async function loadPreviousSessionsContext(clientId: string, lang: "de" | "en"): Promise<string> {
  const { data, error } = await supabase
    .from("voice_sessions")
    .select("transcript, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error || !data || data.length === 0) return "";

  const seen = new Set<string>();
  const sessionBlocks: string[] = [];

  for (const row of data) {
    let transcript: PreviousSessionTurn[] = [];
    if (Array.isArray(row.transcript)) transcript = row.transcript as PreviousSessionTurn[];
    else if (typeof row.transcript === "string") {
      try { transcript = JSON.parse(row.transcript); } catch { transcript = []; }
    }

    const userTurns: string[] = [];
    for (const t of transcript) {
      if (t.role !== "user" || typeof t.text !== "string") continue;
      const text = t.text.trim();
      if (text.length < 25) continue;
      const key = normalizeForDedup(text);
      if (seen.has(key)) continue;
      seen.add(key);
      userTurns.push(text);
    }
    if (userTurns.length === 0) continue;

    const dateStr = new Date(row.created_at).toLocaleDateString(lang === "en" ? "en-US" : "de-DE", {
      day: "numeric", month: "long", year: "numeric",
    });
    const recap = userTurns.slice(-6).map((t) => `  - ${t.slice(0, 280)}`).join("\n");
    sessionBlocks.push(lang === "en" ? `Session ${dateStr}:\n${recap}` : `Gespräch ${dateStr}:\n${recap}`);
  }

  if (sessionBlocks.length === 0) return "";
  return sessionBlocks.join("\n\n");
}

// ── Already-extracted ideas (avoid repeat topics) ────────────────────────
// Lists the client's recent ideas so the agent can a) avoid pitching topics
// that have already been covered, and b) compare against the pillars in the
// client profile to spot under-mined territories.

async function loadExtractedIdeasContext(clientId: string, lang: "de" | "en"): Promise<string> {
  const { data, error } = await supabase
    .from("ideas")
    .select("title, description, content_type, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data || data.length === 0) return "";

  const lines = data.map((i) => {
    const desc = (i.description || "").trim().slice(0, 180);
    const type = i.content_type ? ` [${i.content_type}]` : "";
    return desc ? `  - ${i.title}${type} — ${desc}` : `  - ${i.title}${type}`;
  }).join("\n");

  return lang === "en"
    ? `${data.length} idea(s) already extracted (most recent first):\n${lines}\n\nDo NOT pitch any of these topics again. Either find a new angle on a pillar that's bare, or surface a topic the client hasn't covered yet.`
    : `${data.length} bereits extrahierte Idee(n) (neueste zuerst):\n${lines}\n\nSchlage KEINES dieser Themen erneut vor. Such entweder einen neuen Winkel in einem Pillar der noch leer ist, oder bring ein Thema das der Client noch nicht behandelt hat.`;
}

// ── System prompt assembly ───────────────────────────────────────────────

interface SystemPromptContext {
  clientContext: string;
  auditContext: string;
  performanceContext: string;
  learningsContext: string;
  previousSessionsContext: string;
  extractedIdeasContext: string;
  onboardingProgress: Awaited<ReturnType<typeof loadVoiceOnboarding>> | null;
  voiceProfileStep: VoiceProfileStep | null;
}

function buildSessionSystemPrompt(
  mode: "onboarding" | "content-ideas" | "voice-profile",
  lang: "de" | "en",
  ctx: SystemPromptContext,
): string {
  // Voice-profile mode: use the step-specific prompt, skip onboarding progress.
  // Scenarios get the passive-listener prompt with the scenario text inlined;
  // the topic step gets the guided-interview prompt.
  if (mode === "voice-profile" && ctx.voiceProfileStep) {
    const step = ctx.voiceProfileStep;
    const promptName = step.kind === "scenario" ? "voice-profile-scenario" : "voice-profile-topic";
    const scenarioText = lang === "en" ? step.promptEn : step.promptDe;
    const basePrompt = buildPrompt(promptName, { scenario_text: scenarioText }, lang);
    // Still inline client context — helps the topic interviewer pick questions
    // that fit the client's niche.
    const headers = lang === "en"
      ? { context: "# PRE-LOADED CLIENT CONTEXT\n\nUse this to personalize questions, but never quiz the client about it.", clientProfile: "## CLIENT PROFILE" }
      : { context: "# VORAB GELADENER CLIENT-KONTEXT\n\nNutze das um Fragen zu personalisieren, aber frag den Client nicht darüber ab.", clientProfile: "## CLIENT-PROFIL" };
    const sections: string[] = [];
    if (ctx.clientContext) sections.push(`${headers.clientProfile}\n${ctx.clientContext}`);
    return sections.length > 0
      ? `${basePrompt}\n\n${headers.context}\n\n${sections.join("\n\n")}`
      : basePrompt;
  }

  const basePromptName = mode === "onboarding" ? "voice-agent-onboarding" : "voice-agent";
  const basePrompt = buildPrompt(basePromptName, {}, lang);

  const headers = lang === "en"
    ? {
        context: "# PRE-LOADED CONTEXT\n\nYou already have all relevant data below. Use it directly in the conversation — no tool calls needed.",
        clientProfile: "## CLIENT PROFILE",
        audit: "## AUDIT FINDINGS",
        performance: "## PERFORMANCE DATA",
        learnings: "## LEARNINGS",
      }
    : {
        context: "# VORAB GELADENER KONTEXT\n\nDu hast alle relevanten Daten bereits unten. Nutze sie direkt im Gespräch — keine Tool-Calls nötig.",
        clientProfile: "## CLIENT-PROFIL",
        audit: "## AUDIT-FINDINGS",
        performance: "## PERFORMANCE-DATEN",
        learnings: "## LEARNINGS",
      };
  const previousSessionsHeader = lang === "en" ? "## RECENT VOICE SESSIONS" : "## LETZTE VOICE-GESPRÄCHE";
  const extractedIdeasHeader = lang === "en" ? "## ALREADY EXTRACTED VIDEO IDEAS — DO NOT REPEAT" : "## BEREITS EXTRAHIERTE VIDEO-IDEEN — NICHT WIEDERHOLEN";

  const sections: string[] = [];
  if (ctx.clientContext) sections.push(`${headers.clientProfile}\n${ctx.clientContext}`);
  if (ctx.auditContext) sections.push(`${headers.audit}\n${ctx.auditContext}`);
  if (ctx.performanceContext) sections.push(`${headers.performance}\n${ctx.performanceContext}`);
  if (ctx.learningsContext) sections.push(`${headers.learnings}\n${ctx.learningsContext}`);
  if (ctx.previousSessionsContext) sections.push(`${previousSessionsHeader}\n${ctx.previousSessionsContext}`);
  if (ctx.extractedIdeasContext) sections.push(`${extractedIdeasHeader}\n${ctx.extractedIdeasContext}`);

  if (ctx.onboardingProgress) {
    sections.push(buildOnboardingProgressBlock(ctx.onboardingProgress, lang));
    sections.push(lang === "en"
      ? `# BLOCK-COMPLETION SIGNAL (IMPORTANT)\n\nWhen you finish a block, say EXACTLY this short sentence out loud before transitioning to the next block:\n\n\`\`\`\nDone with {block_id}.\n\`\`\`\n\nReplace {block_id} with one of: identity, positioning, audience, beliefs, offer, feel, vision, resources. Then continue naturally with the next question. This is a signal so the UI can track progress — keep it short and confident.`
      : `# BLOCK-ABSCHLUSS-SIGNAL (WICHTIG)\n\nWenn du einen Block abschließt, sag EXAKT diesen kurzen Satz laut, bevor du zum nächsten Block überleitest:\n\n\`\`\`\nBlock {block_id} abgeschlossen.\n\`\`\`\n\nErsetze {block_id} durch einen von: identity, positioning, audience, beliefs, offer, feel, vision, resources. Dann redest du natürlich mit der nächsten Frage weiter. Das ist ein Signal damit das UI den Fortschritt tracken kann — halte es kurz und bestimmt.`);
  }

  return `${basePrompt}\n\n${headers.context}\n\n${sections.join("\n\n")}`;
}


// ── WebSocket Server ─────────────────────────────────────────────────────

// Run the WS server on top of a tiny HTTP server so cloud providers
// (Fly.io etc.) can hit a /health endpoint for liveness checks.
const httpServer = createHttpServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocketServer({ server: httpServer });
// Bind explicitly to 0.0.0.0 — on Alpine/Node defaults to "::" (IPv6) which
// fly-proxy doesn't always resolve, leading to "app not listening" warnings.
httpServer.listen(PORT, "0.0.0.0");

console.log(`[${new Date().toISOString()}] Voice server listening on 0.0.0.0:${PORT}`);

wss.on("connection", async (ws: WebSocket, req) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const token = url.searchParams.get("token");
  const clientIdOverride = url.searchParams.get("clientId"); // For admin testing
  const modeParam = url.searchParams.get("mode");
  const mode: "onboarding" | "content-ideas" | "voice-profile" =
    modeParam === "onboarding" ? "onboarding"
    : modeParam === "voice-profile" ? "voice-profile"
    : "content-ideas";
  const stepParam = url.searchParams.get("step");
  const voiceProfileStep: VoiceProfileStep | null =
    mode === "voice-profile" && stepParam ? getStep(stepParam) || null : null;
  if (mode === "voice-profile" && !voiceProfileStep) {
    ws.close(4007, "Invalid voice-profile step");
    return;
  }

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

  // Load client config for language (query param overrides). en-US if client.language === "en".
  const langOverride = url.searchParams.get("lang"); // "de" | "en" — admin testing
  const { data: clientCfg } = await supabase
    .from("configs")
    .select("language")
    .eq("id", clientId)
    .maybeSingle();
  const langRaw = langOverride || clientCfg?.language || "de";
  const lang: "de" | "en" = langRaw === "en" ? "en" : "de";
  const languageCode = lang === "en" ? "en-US" : "de-DE";

  // Stable session id used for both incremental snapshots and the final save.
  // crypto.randomUUID is global in Node 19+ which Fly's node:20-alpine has.
  const sessionId = crypto.randomUUID();
  console.log(`Voice session started for client: ${clientId} (lang=${lang}, mode=${mode}, session=${sessionId.slice(0, 8)})`);
  const sessionStart = Date.now();

  // Pre-load the full context (client profile, audit, performance, learnings)
  // in parallel and inline it into the system prompt. The agent runs WITHOUT
  // tools during the session — this avoids the known 1008 "Requested entity
  // was not found" bug in gemini-2.5-flash-native-audio-* models that triggers
  // during tool-call exchanges (tracked in googleapis/js-genai#1236). Progress
  // tracking happens via (a) signal-phrase parsing of the model transcript for
  // live UI updates and (b) a post-session Claude extraction pass for the
  // authoritative per-block summaries + quotes.
  const [clientContext, auditContext, performanceContext, learningsContext, previousSessionsContext, extractedIdeasContext] = await Promise.all([
    toolLoadClientContext(clientId).catch(() => ""),
    toolLoadAudit(clientId).catch(() => ""),
    toolCheckPerformance(clientId).catch(() => ""),
    toolCheckLearnings(clientId).catch(() => ""),
    loadPreviousSessionsContext(clientId, lang).catch(() => ""),
    loadExtractedIdeasContext(clientId, lang).catch(() => ""),
  ]);

  let onboardingProgress = mode === "onboarding" ? await loadVoiceOnboarding(clientId) : null;
  const systemPrompt = buildSessionSystemPrompt(mode, lang, {
    clientContext, auditContext, performanceContext, learningsContext, previousSessionsContext, extractedIdeasContext, onboardingProgress, voiceProfileStep,
  });
  console.log(`[voice-server] system prompt: ${systemPrompt.length} chars (context pre-loaded, NO tools, mode=${mode}${voiceProfileStep ? `, step=${voiceProfileStep.id}` : ""})`);

  // Create Gemini Live session
  const geminiSession = new GeminiLiveSession();

  let connected = false;
  let incrementalSaveIntervalRef: NodeJS.Timeout | null = null;

  // ── Onboarding mode: parse model transcript for block-completion signals
  // Signal format (agent speaks this as one short sentence at end of each block):
  //   DE: "Block identity abgeschlossen."   EN: "Done with identity."
  // Gemini streams transcription fragment-by-fragment, so we accumulate
  // model text into a rolling window and search.
  let modelBuf = "";
  const alreadyMarked = new Set<VoiceBlockId>(
    onboardingProgress ? onboardingProgress.blocks.filter((b) => b.status === "done").map((b) => b.id) : [],
  );
  // Multiple surface forms — Gemini paraphrases under voice pressure.
  // Matches: "Block identity abgeschlossen", "identity block abgeschlossen",
  // "done with identity", "identity complete/done/fertig", "identity block is done", etc.
  // Punctuation between the block id and the verb is tolerated.
  const blockIdPattern = VOICE_BLOCK_ORDER.join("|");
  const signalRegex = new RegExp(
    [
      `\\bblock\\s+(${blockIdPattern})\\b`,                                                  // "block identity"
      `\\b(${blockIdPattern})\\s+block\\b`,                                                  // "identity block"
      `\\bdone\\s+with\\s+(${blockIdPattern})\\b`,                                           // "done with identity"
      `\\b(${blockIdPattern})[\\s,\\.!?-]+(?:block\\s+)?(?:is\\s+)?(?:complete|done|fertig|abgeschlossen|erledigt|durch)\\b`, // "identity, complete"
    ].join("|"),
    "gi",
  );

  async function accumulateAndMaybeMarkBlock(fragment: string) {
    modelBuf += fragment.toLowerCase();
    if (modelBuf.length > 4000) modelBuf = modelBuf.slice(-2000);

    // Loop: multiple signals can land in one turn ("done with identity. Positioning block is next.")
    const matches = [...modelBuf.matchAll(signalRegex)];
    if (matches.length === 0) return;

    let lastEnd = 0;
    for (const m of matches) {
      // Any capture group holds the matched id (only one fires per alternation)
      const blockId = (m[1] || m[2] || m[3] || m[4]) as VoiceBlockId | undefined;
      if (!blockId || alreadyMarked.has(blockId)) continue;
      alreadyMarked.add(blockId);
      lastEnd = Math.max(lastEnd, (m.index || 0) + m[0].length);
      await markBlockProvisional(blockId);
    }
    if (lastEnd > 0) modelBuf = modelBuf.slice(lastEnd);
  }

  async function markBlockProvisional(blockId: VoiceBlockId) {
    // Summary + quotes stay empty — filled by the post-session Claude pass.
    // The UI only needs the progress bar to advance live.
    try {
      const { onboarding, accepted } = await markBlockComplete(clientId, {
        block_id: blockId,
        summary: "",
        quotes: [],
      });
      if (accepted) {
        onboardingProgress = onboarding;
        console.log(`[onboarding] block complete (provisional): ${blockId}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "block_progress",
            blockId,
            doneCount: onboarding.blocks.filter((b) => b.status === "done").length,
            total: VOICE_BLOCK_ORDER.length,
          }));
        }
      }
    } catch (err) {
      console.error("[onboarding] markBlockComplete failed:", err);
    }
  }

  try {
    let audioChunks = 0;
    let firstChunkSent = false;
    let firstChunkTimeout: NodeJS.Timeout | null = null;
    await geminiSession.connect({
      clientId,
      systemPrompt,
      tools: [],
      languageCode,
      onAudioOutput: (audioBase64: string) => {
        audioChunks++;
        if (audioChunks === 1 || audioChunks % 50 === 0) {
          console.log(`[gemini→browser] audio chunk #${audioChunks} (${audioBase64.length} b64 chars)`);
        }
        if (ws.readyState === WebSocket.OPEN) {
          // On the very first audio chunk, signal the browser that the agent
          // is about to speak — this is when the UI should flip from loading
          // to "active". Clear the stall-timeout the same way.
          if (!firstChunkSent) {
            firstChunkSent = true;
            if (firstChunkTimeout) { clearTimeout(firstChunkTimeout); firstChunkTimeout = null; }
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
        // Onboarding mode: parse model transcript for block-completion signal.
        // Gemini streams transcription in fragments — we accumulate model text
        // per turn and check the running buffer against the signal pattern.
        if (mode === "onboarding" && role === "model") {
          accumulateAndMaybeMarkBlock(text);
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

    // Incremental transcript save — every 15s we upsert the current transcript
    // into voice_sessions so a server crash / restart / network drop never
    // causes the transcript to be lost. Final save in endSession() rewrites
    // the same row with ideas_generated set after extraction.
    const incrementalSaveInterval = setInterval(() => {
      const transcript = geminiSession.getTranscript();
      if (transcript.length === 0) return;
      const durationSeconds = Math.round((Date.now() - sessionStart) / 1000);
      saveVoiceSession(clientId, transcript, 0, durationSeconds, sessionId).catch((err) => {
        console.warn("[voice-server] incremental save failed:", err instanceof Error ? err.message : err);
      });
    }, 15_000);
    incrementalSaveIntervalRef = incrementalSaveInterval;

    // Tell the browser the session is reserved — it should open mic access now
    // so it's ready when the agent starts speaking.
    ws.send(JSON.stringify({ type: "ready" }));
    console.log("[voice-server] ✅ sent 'ready' to browser");

    // Safety timeout: if Gemini hasn't produced the first audio chunk within
    // 30s of sending the greeting trigger, something's wrong — bail out with
    // a clear error instead of leaving the browser stuck on "Lade Kontext...".
    // The onAudioOutput callback clears this when the first chunk arrives.
    // SKIP for voice-profile scenario mode — the agent is meant to stay silent
    // until the client finishes talking, so no audio is expected upfront.
    const isPassiveListenMode = mode === "voice-profile" && voiceProfileStep?.kind === "scenario";
    if (isPassiveListenMode) {
      // Passive mode: no greeting, activate UI immediately so the client can
      // start recording without waiting for agent audio.
      ws.send(JSON.stringify({ type: "speaking" }));
    } else {
      firstChunkTimeout = setTimeout(() => {
        if (!firstChunkSent && ws.readyState === WebSocket.OPEN) {
          console.error("[voice-server] ⚠️ no audio from Gemini within 30s — aborting");
          ws.send(JSON.stringify({
            type: "error",
            message: "Gemini antwortet nicht. Bitte in 10 Sek. nochmal versuchen.",
          }));
          try { ws.close(4006, "Gemini audio timeout"); } catch (err) {
            console.warn("[voice-server] ws.close failed during timeout:", err);
          }
        }
      }, 30_000);
    }

    // Trigger the first agent turn. System prompt already includes full context.
    // recordInTranscript:false keeps the internal trigger out of the summary.
    console.log("[voice-server] sending greeting trigger to Gemini...");
    let greetingTrigger: string;
    if (mode === "voice-profile" && voiceProfileStep?.kind === "scenario") {
      // Scenario mode: the client just read the scenario and is about to start
      // talking. Agent must STAY SILENT and wait. Send a silent-trigger so the
      // session is active but no greeting plays.
      greetingTrigger = lang === "en"
        ? "The client is about to start talking. DO NOT speak. DO NOT greet. Stay completely silent until you hear the client start their story. Only speak if they fall silent mid-story or signal they're done."
        : "Der Client fängt gleich an zu erzählen. SPRICH NICHT. BEGRÜSSE NICHT. Bleib komplett still bis du den Client anfangen hörst. Sprich nur wenn er mitten drin verstummt oder signalisiert dass er fertig ist.";
    } else if (mode === "voice-profile" && voiceProfileStep?.kind === "topic") {
      // Topic mode: agent opens with one short question.
      greetingTrigger = lang === "en"
        ? "Start now with ONE short opening question like 'Okay — tell me, what exactly do you do?'. Don't introduce yourself. Don't explain. Just ask."
        : "Starte jetzt mit EINER kurzen Eröffnungsfrage wie 'Okay — erzähl mal, was machst du genau?'. Stell dich nicht vor. Erklär nichts. Frag einfach.";
    } else {
      greetingTrigger = lang === "en"
        ? "Greet me now with ONE short, casual English sentence — feel free to use my name or my niche."
        : "Begrüße mich jetzt mit EINEM kurzen, lockeren deutschen Satz — nutze gerne meinen Namen oder meine Nische.";
    }
    await geminiSession.sendText(greetingTrigger, { recordInTranscript: false });
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

    if (incrementalSaveIntervalRef) {
      clearInterval(incrementalSaveIntervalRef);
      incrementalSaveIntervalRef = null;
    }

    const durationSeconds = Math.round((Date.now() - sessionStart) / 1000);
    const { transcript } = await geminiSession.close();

    trackGeminiLiveSession({
      clientId,
      userId: auth?.userId || null,
      operation: mode === "onboarding" ? "voice_onboarding" : mode === "voice-profile" ? "voice_profile_interview" : "voice_content_ideas",
      initiator: "client",
      durationSeconds,
    });

    try {
      if (mode === "onboarding") {
        await finalizeOnboardingSession({ ws, clientId, lang, transcript, durationSeconds });
      } else if (mode === "voice-profile" && voiceProfileStep) {
        await finalizeVoiceProfileSession({ ws, clientId, transcript, durationSeconds, step: voiceProfileStep });
      } else {
        await finalizeContentIdeasSession({ ws, clientId, lang, transcript, durationSeconds, sessionId });
      }
    } catch (err) {
      console.error("Error finalizing session:", err);
      // Last-resort save so a crash in finalize never loses the transcript.
      // Incremental saves cover the common case but a finalize-time crash
      // could land between snapshots.
      try {
        await saveVoiceSession(clientId, transcript, 0, durationSeconds, sessionId);
      } catch (saveErr) {
        console.error("Last-resort transcript save failed:", saveErr);
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: "Session summary failed" }));
      }
    }
  }
});

