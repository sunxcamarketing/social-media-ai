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
import {
  loadVoiceOnboarding,
  saveVoiceOnboarding,
  markBlockComplete,
  buildOnboardingProgressBlock,
  synthesizeVoiceOnboarding,
} from "./lib/voice-onboarding";
import { VOICE_BLOCK_ORDER, type VoiceBlockId, type Config } from "./lib/types";
import { VOICE_PROFILE_STEPS, getStep, type VoiceProfileStep } from "./lib/voice-profile-scenarios";
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

// ── Shared helpers for Claude post-session extractions ───────────────────

function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript
    .map((t) => `${t.role === "user" ? "Client" : "Agent"}: ${t.text}`)
    .join("\n");
}

interface ToolExtractionOptions<TInput> {
  label: string;
  systemPrompt: string;
  userContent: string;
  tool: Anthropic.Messages.Tool;
  maxTokens?: number;
}

/** Run a single Claude tool-call extraction. Returns the raw tool input or null
 *  on any failure (no key, no tool-use block, API error). Never throws — callers
 *  can treat `null` as "extraction produced nothing". */
const CLAUDE_EXTRACTION_TIMEOUT_MS = 45_000;

async function runToolExtraction<TInput>(
  opts: ToolExtractionOptions<TInput>,
): Promise<TInput | null> {
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

// ── Session summary: Convert transcript to content ideas ─────────────────

async function generateSessionSummary(
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

// ── Onboarding: extract per-block summaries + quotes from transcript ─────
// Runs post-session. Claude sees the full transcript and produces a clean
// summary + verbatim quotes per block. Overwrites any provisional data
// that was marked live via the signal-phrase parser.

interface ExtractedBlock {
  block_id: VoiceBlockId;
  summary: string;
  quotes: string[];
}

const VALID_BLOCK_IDS = new Set<VoiceBlockId>(VOICE_BLOCK_ORDER);
function isVoiceBlockId(v: unknown): v is VoiceBlockId {
  return typeof v === "string" && VALID_BLOCK_IDS.has(v as VoiceBlockId);
}

// ── Profile field suggestions: map voice-interview content to Config fields

type SuggestableField =
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

async function extractProfileSuggestions(
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
  // Runtime-validate: Claude sometimes hallucinates field names outside the enum.
  const validFieldSet = new Set<string>(SUGGESTABLE_FIELDS);
  const cleaned: FieldSuggestion[] = raw
    .filter((s) => validFieldSet.has(s.field))
    .filter((s) => s.value && s.value.trim().length > 2 && s.sourceQuote && s.sourceQuote.trim().length > 0)
    .map((s) => ({ field: s.field as SuggestableField, value: s.value, sourceQuote: s.sourceQuote }));
  if (cleaned.length < raw.length) console.warn(`[profile-suggestions] dropped ${raw.length - cleaned.length} invalid suggestion(s)`);
  console.log(`[profile-suggestions] ${cleaned.length} field suggestion(s) extracted`);
  return cleaned;
}

async function extractOnboardingBlocks(
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

// ── Save session to Supabase ─────────────────────────────────────────────

// ── System prompt assembly ───────────────────────────────────────────────

interface SystemPromptContext {
  clientContext: string;
  auditContext: string;
  performanceContext: string;
  learningsContext: string;
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

  const sections: string[] = [];
  if (ctx.clientContext) sections.push(`${headers.clientProfile}\n${ctx.clientContext}`);
  if (ctx.auditContext) sections.push(`${headers.audit}\n${ctx.auditContext}`);
  if (ctx.performanceContext) sections.push(`${headers.performance}\n${ctx.performanceContext}`);
  if (ctx.learningsContext) sections.push(`${headers.learnings}\n${ctx.learningsContext}`);

  if (ctx.onboardingProgress) {
    sections.push(buildOnboardingProgressBlock(ctx.onboardingProgress, lang));
    sections.push(lang === "en"
      ? `# BLOCK-COMPLETION SIGNAL (IMPORTANT)\n\nWhen you finish a block, say EXACTLY this short sentence out loud before transitioning to the next block:\n\n\`\`\`\nDone with {block_id}.\n\`\`\`\n\nReplace {block_id} with one of: identity, positioning, audience, beliefs, offer, feel, vision, resources. Then continue naturally with the next question. This is a signal so the UI can track progress — keep it short and confident.`
      : `# BLOCK-ABSCHLUSS-SIGNAL (WICHTIG)\n\nWenn du einen Block abschließt, sag EXAKT diesen kurzen Satz laut, bevor du zum nächsten Block überleitest:\n\n\`\`\`\nBlock {block_id} abgeschlossen.\n\`\`\`\n\nErsetze {block_id} durch einen von: identity, positioning, audience, beliefs, offer, feel, vision, resources. Dann redest du natürlich mit der nächsten Frage weiter. Das ist ein Signal damit das UI den Fortschritt tracken kann — halte es kurz und bestimmt.`);
  }

  return `${basePrompt}\n\n${headers.context}\n\n${sections.join("\n\n")}`;
}

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
    // voice_sessions.transcript is JSONB — pass the array directly. Legacy rows
    // written with JSON.stringify are stored as strings and must be parsed on
    // read (see /api/configs/[id]/voice-sessions for the compat logic).
    transcript,
    ideas_generated: ideasGenerated,
    duration_seconds: durationSeconds,
    created_at: new Date().toISOString().split("T")[0],
  });
}

// ── WebSocket Server ─────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

console.log(`[${new Date().toISOString()}] Voice server listening on ws://localhost:${PORT}`);

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

  console.log(`Voice session started for client: ${clientId} (lang=${lang}, mode=${mode})`);
  const sessionStart = Date.now();

  // Pre-load the full context (client profile, audit, performance, learnings)
  // in parallel and inline it into the system prompt. The agent runs WITHOUT
  // tools during the session — this avoids the known 1008 "Requested entity
  // was not found" bug in gemini-2.5-flash-native-audio-* models that triggers
  // during tool-call exchanges (tracked in googleapis/js-genai#1236). Progress
  // tracking happens via (a) signal-phrase parsing of the model transcript for
  // live UI updates and (b) a post-session Claude extraction pass for the
  // authoritative per-block summaries + quotes.
  const [clientContext, auditContext, performanceContext, learningsContext] = await Promise.all([
    toolLoadClientContext(clientId).catch(() => ""),
    toolLoadAudit(clientId).catch(() => ""),
    toolCheckPerformance(clientId).catch(() => ""),
    toolCheckLearnings(clientId).catch(() => ""),
  ]);

  let onboardingProgress = mode === "onboarding" ? await loadVoiceOnboarding(clientId) : null;
  const systemPrompt = buildSessionSystemPrompt(mode, lang, {
    clientContext, auditContext, performanceContext, learningsContext, onboardingProgress, voiceProfileStep,
  });
  console.log(`[voice-server] system prompt: ${systemPrompt.length} chars (context pre-loaded, NO tools, mode=${mode}${voiceProfileStep ? `, step=${voiceProfileStep.id}` : ""})`);

  // Create Gemini Live session
  const geminiSession = new GeminiLiveSession();

  let connected = false;

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

    const durationSeconds = Math.round((Date.now() - sessionStart) / 1000);
    const { transcript } = await geminiSession.close();

    try {
      if (mode === "onboarding") {
        await finalizeOnboardingSession({ ws, clientId, lang, transcript, durationSeconds });
      } else if (mode === "voice-profile" && voiceProfileStep) {
        await finalizeVoiceProfileSession({ ws, clientId, lang, transcript, durationSeconds, step: voiceProfileStep });
      } else {
        await finalizeContentIdeasSession({ ws, clientId, lang, transcript, durationSeconds });
      }
    } catch (err) {
      console.error("Error finalizing session:", err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "error", message: "Session summary failed" }));
      }
    }
  }
});

// ── Post-session finalizers (extracted from connection handler) ──────────

interface FinalizeArgs {
  ws: WebSocket;
  clientId: string;
  lang: "de" | "en";
  transcript: TranscriptEntry[];
  durationSeconds: number;
}

async function finalizeOnboardingSession({ ws, clientId, lang, transcript, durationSeconds }: FinalizeArgs): Promise<void> {
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
  if (ws.readyState === WebSocket.OPEN) {
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
  // On success, sends onboarding_enriched to browser if still connected.
  // On any failure, errors are logged but provisional state is already saved.
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
  if (ws.readyState === WebSocket.OPEN) {
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

async function finalizeVoiceProfileSession(
  args: FinalizeArgs & { step: VoiceProfileStep },
): Promise<void> {
  const { ws, clientId, transcript, durationSeconds, step } = args;
  // Extract only the user's spoken lines — this is the actual voice sample.
  // Keep model lines minimal (topic-mode questions are useful context for the
  // voice-profile extraction prompt, but scenarios should be user-only).
  const userLines = transcript.filter((t) => t.role === "user").map((t) => t.text.trim()).filter(Boolean);
  const combined = userLines.join("\n\n");

  if (combined.length < 30) {
    console.warn(`[voice-profile] step ${step.id}: sample too short (${combined.length} chars), skipping save`);
    if (ws.readyState === WebSocket.OPEN) {
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

  // Persist the transcript as a training sample — feeds voice-profile extraction.
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

  // Save voice session record for replay/debug.
  await saveVoiceSession(clientId, transcript, 0, durationSeconds).catch((err) => {
    console.error("[voice-profile] saveVoiceSession failed:", err);
  });

  if (ws.readyState === WebSocket.OPEN) {
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

async function finalizeContentIdeasSession({ ws, clientId, lang, transcript, durationSeconds }: FinalizeArgs): Promise<void> {
  const ideas = await generateSessionSummary(clientId, transcript, lang);
  for (const idea of ideas) {
    await executeAgentTool(clientId, "save_idea", {
      title: idea.title,
      description: idea.description,
      content_type: idea.contentType,
    });
  }
  await saveVoiceSession(clientId, transcript, ideas.length, durationSeconds);

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "summary",
      ideas,
      durationSeconds,
      transcriptLength: transcript.length,
    }));
  }
  console.log(`Voice session ended: ${durationSeconds}s, ${ideas.length} ideas saved`);
}
