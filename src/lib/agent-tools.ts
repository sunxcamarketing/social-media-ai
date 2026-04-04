// ── Content Agent Tool Implementations ─────────────────────────────────────
// Each function takes a clientId + optional tool input, queries Supabase,
// and returns a formatted string result for the agent's tool_result message.

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";
import {
  readConfig,
  readConfigs,
  readScriptsByClient,
  readAnalysesByClient,
  readVideosList,
  readVideos,
  readTrainingScripts,
} from "./csv";
import {
  getVoiceProfile,
  getScriptStructure,
  voiceProfileToPromptBlock,
  scriptStructureToPromptBlock,
} from "./voice-profile";
import { getAuditBlock } from "./audit";
import { buildPrompt } from "@prompts";
import { safeJsonParse } from "./safe-json";
import { fmt, fmtDuration, secondsToWords } from "./format";
import type { Config } from "./types";
import type { PerformanceInsights, VideoInsight } from "./performance-helpers";

// ── load_client_context ────────────────────────────────────────────────────

export async function toolLoadClientContext(clientId: string): Promise<string> {
  const config = await readConfig(clientId);
  if (!config) return "Client nicht gefunden.";

  const dreamCustomer = safeJsonParse(config.dreamCustomer);
  const customerProblems = safeJsonParse(config.customerProblems);
  const pillars: { name: string; subTopics?: string }[] = safeJsonParse(config.strategyPillars, []);
  const weekly = safeJsonParse(config.strategyWeekly);

  const sections: string[] = [];

  // Profile
  const profile = [
    config.name && `Name: ${config.name}`,
    config.role && `Rolle: ${config.role}`,
    config.company && `Unternehmen: ${config.company}`,
    config.creatorsCategory && `Nische: ${config.creatorsCategory}`,
    config.location && `Standort: ${config.location}`,
    config.businessContext && `Business-Kontext: ${config.businessContext}`,
    config.professionalBackground && `Professioneller Hintergrund: ${config.professionalBackground}`,
    config.keyAchievements && `Erfolge: ${config.keyAchievements}`,
  ].filter(Boolean);
  if (profile.length > 0) sections.push(`PROFIL:\n${profile.join("\n")}`);

  // Brand
  const brand = [
    config.brandFeeling && `Marken-Gefühl: ${config.brandFeeling}`,
    config.brandProblem && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.humanDifferentiation && `Differenzierung: ${config.humanDifferentiation}`,
    config.providerRole && `Anbieter-Rolle: ${config.providerRole}`,
    config.providerBeliefs && `Überzeugungen: ${config.providerBeliefs}`,
    config.authenticityZone && `Authentizitätszone: ${config.authenticityZone}`,
  ].filter(Boolean);
  if (brand.length > 0) sections.push(`BRAND:\n${brand.join("\n")}`);

  // Target audience
  const audience = [
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession && `Beruf: ${dreamCustomer.profession}`,
    customerProblems.mental && `Mentale Probleme: ${customerProblems.mental}`,
    customerProblems.emotional && `Emotionale Probleme: ${customerProblems.emotional}`,
    customerProblems.practical && `Praktische Probleme: ${customerProblems.practical}`,
  ].filter(Boolean);
  if (audience.length > 0) sections.push(`ZIELGRUPPE:\n${audience.join("\n")}`);

  // Strategy
  if (config.strategyGoal || pillars.length > 0) {
    const stratParts: string[] = [];
    if (config.strategyGoal) stratParts.push(`Ziel: ${config.strategyGoal}`);
    if (pillars.length > 0) {
      stratParts.push(`Content-Pillars:\n${pillars.map(p => {
        let line = `  - ${p.name}`;
        if (p.subTopics) line += ` (${p.subTopics})`;
        return line;
      }).join("\n")}`);
    }
    if (weekly && Object.keys(weekly).length > 0) {
      stratParts.push(`Wochenplan:\n${Object.entries(weekly).map(([day, d]) => {
        const info = d as { type?: string; format?: string; pillar?: string };
        return `  ${day}: ${info.type || "?"} | ${info.format || "?"} | ${info.pillar || "?"}`;
      }).join("\n")}`);
    }
    if (config.postsPerWeek) stratParts.push(`Posts/Woche: ${config.postsPerWeek}`);
    sections.push(`STRATEGIE:\n${stratParts.join("\n")}`);
  }

  // Social profiles
  const social = [
    config.instagram && `Instagram: @${config.instagram.replace(/^@/, "")}`,
    config.igFollowers && `Follower: ${config.igFollowers}`,
    config.tiktok && `TikTok: ${config.tiktok}`,
    config.youtube && `YouTube: ${config.youtube}`,
    config.website && `Website: ${config.website}`,
  ].filter(Boolean);
  if (social.length > 0) sections.push(`SOCIAL MEDIA:\n${social.join("\n")}`);

  return sections.join("\n\n");
}

// ── load_voice_profile ─────────────────────────────────────────────────────

export async function toolLoadVoiceProfile(clientId: string): Promise<string> {
  const voiceProfile = await getVoiceProfile(clientId);
  const scriptStructure = await getScriptStructure(clientId);

  const parts: string[] = [];

  if (voiceProfile) {
    const config = await readConfig(clientId);
    parts.push(voiceProfileToPromptBlock(voiceProfile, config?.name || "der Kunde"));
  } else {
    parts.push("Kein Voice Profile vorhanden. Skripte werden ohne Voice Matching generiert. Empfehlung: Training-Skripte im Portal hochladen.");
  }

  if (scriptStructure) {
    parts.push(scriptStructureToPromptBlock(scriptStructure));
  }

  return parts.join("\n\n");
}

// ── search_scripts ─────────────────────────────────────────────────────────

export async function toolSearchScripts(
  clientId: string,
  input: { query?: string; pillar?: string; limit?: number },
): Promise<string> {
  const scripts = await readScriptsByClient(clientId);
  if (scripts.length === 0) return "Keine Skripte vorhanden.";

  let filtered = scripts;

  if (input.query) {
    const q = input.query.toLowerCase();
    filtered = filtered.filter(s =>
      (s.title || "").toLowerCase().includes(q) ||
      (s.hook || "").toLowerCase().includes(q) ||
      (s.body || "").toLowerCase().includes(q) ||
      (s.pillar || "").toLowerCase().includes(q)
    );
  }

  if (input.pillar) {
    filtered = filtered.filter(s =>
      (s.pillar || "").toLowerCase() === input.pillar!.toLowerCase()
    );
  }

  // Sort by date desc
  filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const limit = input.limit || 10;
  filtered = filtered.slice(0, limit);

  if (filtered.length === 0) return `Keine Skripte gefunden${input.query ? ` für "${input.query}"` : ""}.`;

  return `${filtered.length} Skripte gefunden (von ${scripts.length} gesamt):\n\n${filtered.map((s, i) => {
    const parts = [`[${i + 1}] ${s.title || "Ohne Titel"} (${s.createdAt?.slice(0, 10) || "?"})`];
    if (s.pillar) parts.push(`Pillar: ${s.pillar}`);
    if (s.contentType) parts.push(`Typ: ${s.contentType}`);
    if (s.hook) parts.push(`Hook: ${s.hook.slice(0, 120)}`);
    if (s.status) parts.push(`Status: ${s.status}`);
    return parts.join("\n");
  }).join("\n\n")}`;
}

// ── check_performance ──────────────────────────────────────────────────────

export async function toolCheckPerformance(clientId: string): Promise<string> {
  const config = await readConfig(clientId);
  if (!config) return "Client nicht gefunden.";

  const sections: string[] = [];

  // Performance insights
  const insights = safeJsonParse<PerformanceInsights | null>(config.performanceInsights || "", null);
  if (insights) {
    const topVideos: VideoInsight[] = [
      ...(insights.top30Days || []),
      ...(insights.topAllTime || []),
    ];

    if (topVideos.length > 0) {
      sections.push(`TOP EIGENE VIDEOS:\n${topVideos.slice(0, 8).map((v, i) => {
        const parts = [`[${i + 1}] ${fmt(v.views)} Views · ${fmt(v.likes)} Likes · ${v.datePosted}${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""}`];
        if (v.topic) parts.push(`Thema: ${v.topic}`);
        if (v.audioHook && v.audioHook !== "none") parts.push(`Hook: "${v.audioHook}"`);
        if (v.whyItWorked) parts.push(`Warum erfolgreich: ${v.whyItWorked}`);
        return parts.join("\n");
      }).join("\n\n")}`);
    }
  }

  // Competitor videos
  const allVideos = await readVideosList(config.configName);
  const creatorVideos = allVideos
    .filter(v => v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  if (creatorVideos.length > 0) {
    const avgViews = Math.round(creatorVideos.reduce((sum, v) => sum + v.views, 0) / creatorVideos.length);
    sections.push(`COMPETITOR-BENCHMARK:\nØ Views Top-Videos: ${fmt(avgViews)}`);
  }

  // Hook pattern distribution
  const scripts = await readScriptsByClient(clientId);
  const patternCounts: Record<string, number> = {};
  for (const s of scripts) {
    const pattern = s.hookPattern || "Unbekannt";
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
  }
  if (Object.keys(patternCounts).length > 0) {
    sections.push(`HOOK-PATTERN VERTEILUNG:\n${Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([pattern, count]) => `${pattern}: ${count}x`)
      .join("\n")}`);
  }

  // Instagram stats
  if (config.igFollowers || config.igPostsCount) {
    const stats = [
      config.igFollowers && `Follower: ${config.igFollowers}`,
      config.igPostsCount && `Posts: ${config.igPostsCount}`,
    ].filter(Boolean);
    sections.push(`INSTAGRAM STATS:\n${stats.join("\n")}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : "Keine Performance-Daten vorhanden.";
}

// ── load_audit ─────────────────────────────────────────────────────────────

export async function toolLoadAudit(clientId: string): Promise<string> {
  const analyses = await readAnalysesByClient(clientId);
  if (analyses.length === 0) return "Kein Audit-Report vorhanden.";

  const latest = analyses[0];
  const parts: string[] = [];

  if (latest.profileFollowers || latest.profileReels30d || latest.profileAvgViews30d) {
    parts.push(`PROFIL-STATS:\nFollower: ${latest.profileFollowers || "?"}\nReels (30d): ${latest.profileReels30d || "?"}\nØ Views (30d): ${latest.profileAvgViews30d || "?"}`);
  }

  if (latest.report) {
    parts.push(`AUDIT-REPORT:\n${latest.report}`);
  }

  if (latest.createdAt) {
    parts.push(`Erstellt: ${latest.createdAt.slice(0, 10)}`);
  }

  return parts.join("\n\n");
}

// ── generate_script ────────────────────────────────────────────────────────

interface ScriptGenerationInput {
  title: string;
  description: string;
  pillar?: string;
  contentType?: string;
  format?: string;
  tone?: string;
}

const SCRIPT_TOOL = {
  name: "submit_script",
  description: "Das fertige gesprochene Skript einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      script: {
        type: "string" as const,
        description: "Das KOMPLETTE gesprochene Skript. Absätze mit \\n trennen.",
      },
    },
    required: ["script"],
  },
};

const SHORT_DURATION_SECONDS = 35;
const DEFAULT_LONG_DURATION_SECONDS = 60;

async function buildVoiceBlock(clientId: string, clientName: string): Promise<string> {
  const voiceProfile = await getVoiceProfile(clientId);
  if (voiceProfile) {
    return "\n" + voiceProfileToPromptBlock(voiceProfile, clientName);
  }

  const trainingScripts = (await readTrainingScripts()).filter(ts => ts.clientId === clientId);
  if (trainingScripts.length === 0) return "";

  const MAX_EXAMPLES = 6;
  const MAX_SCRIPT_LENGTH = 2000;
  const examples = trainingScripts.slice(0, MAX_EXAMPLES)
    .map((ts, i) => `--- ${i + 1} ---\n${(ts.script || "").slice(0, MAX_SCRIPT_LENGTH)}`)
    .join("\n\n");

  return `\n<voice_examples>\nSo spricht ${clientName} wirklich:\n${examples}\n</voice_examples>`;
}

async function buildScriptContext(clientId: string, config: Config) {
  const dreamCustomer = safeJsonParse(config.dreamCustomer);
  const clientContext = [
    config.name && `Name: ${config.name}`,
    config.role && `Rolle: ${config.role}`,
    config.company && `Unternehmen: ${config.company}`,
    config.creatorsCategory && `Nische: ${config.creatorsCategory}`,
    config.businessContext && `Business-Kontext: ${config.businessContext}`,
    config.brandProblem && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.providerRole && `Anbieter-Rolle: ${config.providerRole}`,
    config.authenticityZone && `Authentizitätszone: ${config.authenticityZone}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
  ].filter(Boolean).join("\n");

  const clientName = config.name || "der Kunde";
  const voiceBlock = await buildVoiceBlock(clientId, clientName);

  const scriptStructure = await getScriptStructure(clientId);
  const structureBlock = scriptStructure ? "\n" + scriptStructureToPromptBlock(scriptStructure) : "";
  const auditBlock = await getAuditBlock(clientId);

  return { clientContext, voiceBlock, structureBlock, auditBlock };
}

function computeAvgDuration(config: Config, creatorVideos: { durationSeconds: number }[]): number {
  const insights = safeJsonParse<PerformanceInsights | null>(config.performanceInsights || "", null);
  const ownTopVideos: VideoInsight[] = [...(insights?.top30Days || []), ...(insights?.topAllTime || [])];

  const allDurations = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];

  return allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;
}

async function generateSingleVersion(
  client: Anthropic,
  label: string,
  maxWords: number,
  userPrompt: string,
): Promise<string> {
  const durationLabel = fmtDuration(Math.round(maxWords / 2));
  const laengeRegeln = `- LÄNGE: Max ${maxWords} Wörter gesamt. Das entspricht ca. ${durationLabel} Sprechzeit. Kürzer ist besser.`;
  const systemPrompt = buildPrompt("topic-script", { laenge_regeln: laengeRegeln });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: systemPrompt,
      tools: [SCRIPT_TOOL],
      tool_choice: { type: "tool", name: "submit_script" },
      messages: [{ role: "user", content: userPrompt }],
    });

    const toolUse = message.content.find(b => b.type === "tool_use");
    if (toolUse && toolUse.type === "tool_use") {
      const scriptText = (toolUse.input as { script: string }).script || "";
      return `── ${label} ──\n${scriptText}`;
    }
    return `── ${label} ──\n(Konnte nicht generiert werden)`;
  } catch (err) {
    return `── ${label} ──\n(Fehler: ${err instanceof Error ? err.message : "Unbekannt"})`;
  }
}

export async function toolGenerateScript(
  clientId: string,
  input: ScriptGenerationInput,
): Promise<string> {

  const config = await readConfig(clientId);
  if (!config) return "Client nicht gefunden.";

  const { clientContext, voiceBlock, structureBlock, auditBlock } = await buildScriptContext(clientId, config);

  const creatorVideos = (await readVideos())
    .filter(v => v.configName === config.configName && v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);
  const avgDuration = computeAvgDuration(config, creatorVideos);

  const shortMaxWords = secondsToWords(SHORT_DURATION_SECONDS);
  const longMaxWords = avgDuration > 0 ? secondsToWords(avgDuration) : secondsToWords(DEFAULT_LONG_DURATION_SECONDS);

  const toneHint = input.tone ? `\nTONALITÄT: ${input.tone}` : "";
  const metaLine = [
    input.contentType && `Content-Type: ${input.contentType}`,
    input.format && `Format: ${input.format}`,
    input.pillar && `Pillar: ${input.pillar}`,
  ].filter(Boolean).join(" | ");

  const userPrompt = `<client>\n${clientContext}\n</client>\n${auditBlock}${voiceBlock}${structureBlock}${toneHint}

THEMA: ${input.title}
BESCHREIBUNG: ${input.description}
${metaLine}

Schreibe jetzt das Skript zu genau diesem Thema.`;

  const client = getAnthropicClient();

  const results = await Promise.all([
    generateSingleVersion(client, "KURZ (30-40 Sek)", shortMaxWords, userPrompt),
    generateSingleVersion(client, "LANG (60+ Sek)", longMaxWords, userPrompt),
  ]);

  const header = [
    `SKRIPT: "${input.title}"`,
    input.pillar && `Pillar: ${input.pillar}`,
    input.contentType && `Typ: ${input.contentType}`,
    input.format && `Format: ${input.format}`,
  ].filter(Boolean).join("\n");

  return `${header}\n\n${results.join("\n\n")}`;
}

// ── check_competitors ──────────────────────────────────────────────────────

export async function toolCheckCompetitors(
  clientId: string,
  input: { limit?: number },
): Promise<string> {
  const config = await readConfig(clientId);
  if (!config) return "Client nicht gefunden.";

  const allVideos = await readVideosList(config.configName);
  const videos = allVideos
    .filter(v => v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, input.limit || 10);

  if (videos.length === 0) return "Keine Competitor-Videos analysiert.";

  return `${videos.length} Top Competitor-Videos:\n\n${videos.map((v, i) => {
    const parts = [`[${i + 1}] @${v.creator} · ${fmt(v.views)} Views · ${fmt(v.likes)} Likes · ${v.datePosted?.slice(0, 10) || "?"}`];
    if (v.durationSeconds) parts.push(`Dauer: ${fmtDuration(v.durationSeconds)}`);
    if (v.analysis) {
      // Extract hook from analysis
      const hookMatch = v.analysis.match(/HOOK[\s:]+([^\n]+)/i);
      if (hookMatch) parts.push(`Hook: ${hookMatch[1].slice(0, 150)}`);
      const conceptMatch = v.analysis.match(/CONCEPT[\s:]+([^\n]+)/i);
      if (conceptMatch) parts.push(`Konzept: ${conceptMatch[1].slice(0, 150)}`);
    }
    if (v.newConcepts) parts.push(`Adaptierte Ideen: ${v.newConcepts.slice(0, 200)}`);
    return parts.join("\n");
  }).join("\n\n")}`;
}

// ── list_clients (Admin only) ──────────────────────────────────────────────

async function toolListClients(): Promise<string> {
  const configs = await readConfigs();
  if (configs.length === 0) return "Keine Clients vorhanden.";

  return `${configs.length} Clients:\n\n${configs.map((c, i) => {
    const parts = [`[${i + 1}] ${c.configName || c.name || "Unbenannt"}`];
    if (c.creatorsCategory) parts.push(`Nische: ${c.creatorsCategory}`);
    if (c.instagram) parts.push(`Instagram: @${c.instagram.replace(/^@/, "")}`);
    if (c.company) parts.push(`Unternehmen: ${c.company}`);
    return parts.join(" · ");
  }).join("\n")}`;
}

// ── Client Name Resolution ────────────────────────────────────────────────

/**
 * Resolve a client_name to a clientId.
 * Matches against configName and name fields (case-insensitive, partial match).
 */
async function resolveClientId(
  scopedClientId: string | null,
  clientName?: string,
): Promise<string | null> {
  // If scoped (client user), always use their own ID
  if (scopedClientId) return scopedClientId;

  // Admin: resolve by name
  if (!clientName) return null;

  const configs = await readConfigs();
  const lower = clientName.toLowerCase();

  // Exact match first
  const exact = configs.find(c =>
    (c.configName || "").toLowerCase() === lower ||
    (c.name || "").toLowerCase() === lower
  );
  if (exact) return exact.id;

  // Partial match
  const partial = configs.find(c =>
    (c.configName || "").toLowerCase().includes(lower) ||
    (c.name || "").toLowerCase().includes(lower)
  );
  if (partial) return partial.id;

  return null;
}

// ── Tool Router ────────────────────────────────────────────────────────────

/**
 * Execute an agent tool.
 * @param scopedClientId - For client users: their clientId (auto-scope). For admins: null.
 * @param toolName - The tool to execute.
 * @param toolInput - The tool input from Claude (may contain client_name for admins).
 */
export async function executeAgentTool(
  scopedClientId: string | null,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<string> {
  // list_clients doesn't need a clientId
  if (toolName === "list_clients") {
    if (scopedClientId) return "Du hast nur Zugriff auf deine eigenen Daten.";
    return toolListClients();
  }

  // Resolve clientId from scoped ID or client_name
  const clientName = toolInput.client_name as string | undefined;
  const clientId = await resolveClientId(scopedClientId, clientName);

  if (!clientId) {
    if (!scopedClientId && !clientName) {
      return "Bitte gib den Client-Namen an. Nutze list_clients um alle Clients zu sehen.";
    }
    return `Client "${clientName}" nicht gefunden. Nutze list_clients um alle Clients zu sehen.`;
  }

  switch (toolName) {
    case "load_client_context":
      return toolLoadClientContext(clientId);
    case "load_voice_profile":
      return toolLoadVoiceProfile(clientId);
    case "search_scripts":
      return toolSearchScripts(clientId, toolInput as { query?: string; pillar?: string; limit?: number });
    case "check_performance":
      return toolCheckPerformance(clientId);
    case "load_audit":
      return toolLoadAudit(clientId);
    case "generate_script":
      return toolGenerateScript(clientId, toolInput as unknown as ScriptGenerationInput);
    case "check_competitors":
      return toolCheckCompetitors(clientId, toolInput as { limit?: number });
    default:
      return `Unbekanntes Tool: ${toolName}`;
  }
}
