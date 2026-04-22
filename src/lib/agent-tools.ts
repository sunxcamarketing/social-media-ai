// ── Content Agent Tool Implementations ─────────────────────────────────────
// Each function takes a clientId + optional tool input, queries Supabase,
// and returns a formatted string result for the agent's tool_result message.

import { v4 as uuid } from "uuid";
import { supabase } from "./supabase";
import {
  readConfig,
  readConfigs,
  readScriptsByClient,
  readAnalysesByClient,
  readVideosList,
  updateConfig,
} from "./csv";
import {
  getVoiceProfile,
  getScriptStructure,
  voiceProfileToPromptBlock,
  scriptStructureToPromptBlock,
} from "./voice-profile";
import { voiceOnboardingToPromptBlock } from "./voice-onboarding";
import { buildAllClientSections } from "./client-context";
import { safeJsonParse } from "./safe-json";
import { fmt, fmtDuration } from "./format";
import { searchWeb, searchTrends } from "./brave-search";
import { getHighConfidenceLearnings } from "./client-learnings";
import { runScriptAgent } from "./script-agent";
import type { ScriptAgentInput, ScriptAgentProgressFn } from "./script-agent";
import type { Config } from "./types";
import type { PerformanceInsights, VideoInsight } from "./performance-helpers";

// ── load_client_context ────────────────────────────────────────────────────

export async function toolLoadClientContext(clientId: string): Promise<string> {
  const config = await readConfig(clientId);
  if (!config) return "Client nicht gefunden.";
  return buildAllClientSections(config as unknown as Record<string, string>);
}

// ── load_voice_profile ─────────────────────────────────────────────────────

export async function toolLoadVoiceProfile(clientId: string): Promise<string> {
  const voiceProfile = await getVoiceProfile(clientId);
  const scriptStructure = await getScriptStructure(clientId);
  const config = await readConfig(clientId);
  const lang: "de" | "en" = config?.language === "en" ? "en" : "de";
  const onboardingBlock = await voiceOnboardingToPromptBlock(clientId, lang);

  const parts: string[] = [];

  if (voiceProfile) {
    parts.push(voiceProfileToPromptBlock(voiceProfile, config?.name || "der Kunde"));
  } else {
    parts.push("Kein Voice Profile vorhanden. Skripte werden ohne Voice Matching generiert. Empfehlung: Training-Skripte im Portal hochladen.");
  }

  if (scriptStructure) {
    parts.push(scriptStructureToPromptBlock(scriptStructure));
  }

  if (onboardingBlock) {
    parts.push(onboardingBlock);
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
// Uses the Script Agent — a multi-step agent loop that thinks about the
// angle, crafts hooks, writes the script, and self-reviews before submitting.

export async function toolGenerateScript(
  clientId: string,
  input: ScriptAgentInput,
  onProgress?: ScriptAgentProgressFn,
): Promise<string> {
  try {
    const result = await runScriptAgent(clientId, input, onProgress);

    const textHookLine = result.textHook ? `[TEXT-HOOK auf Screen]: "${result.textHook}"` : "";
    const hookPatternLine = result.hookPattern ? `Hook-Muster: ${result.hookPattern}` : "";

    const shortSection = `── KURZ (30-40 Sek) ──\n${textHookLine ? textHookLine + "\n\n" : ""}${result.shortScript}`;
    const longSection = `── LANG (60+ Sek) ──\n${textHookLine ? textHookLine + "\n\n" : ""}${result.longScript}`;
    const body = `${shortSection}\n\n${longSection}`;

    const scriptId = uuid();
    const { error: saveError } = await supabase.from("scripts").insert({
      id: scriptId,
      client_id: clientId,
      title: input.title,
      pillar: input.pillar || "",
      content_type: input.contentType || "",
      format: input.format || "",
      hook: result.shortScript.split("\n\n")[0] || "",
      hook_pattern: result.hookPattern || "",
      text_hook: result.textHook || "",
      body,
      cta: "",
      status: "entwurf",
      source: "chat-agent",
      shot_list: "",
      pattern_type: "",
      post_type: "",
      anchor_ref: "",
      cta_type: "",
      funnel_stage: "",
      created_at: new Date().toISOString().split("T")[0],
    });

    const header = [
      `SKRIPT: "${input.title}"`,
      input.pillar && `Pillar: ${input.pillar}`,
      input.contentType && `Typ: ${input.contentType}`,
      result.angle && `Winkel: ${result.angle}`,
      result.whyItWorks && `Warum es funktioniert: ${result.whyItWorks}`,
      saveError
        ? `Konnte nicht gespeichert werden: ${saveError.message}`
        : `Gespeichert als Entwurf im Skripte-Tab (id=${scriptId}).`,
    ].filter(Boolean).join("\n");

    return [header, hookPatternLine, shortSection, longSection].filter(Boolean).join("\n\n");
  } catch (err) {
    return `Skript-Generierung fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`;
  }
}

// ── Save Script Tool ──────────────────────────────────────────────────────
// Speichert ein bereits fertig formuliertes Skript direkt in die Skripte-Tabelle.
// Nutzt der Agent wenn der User einen kompletten Text liefert oder im Chat ein
// Skript manuell zusammengestellt wurde und es ohne erneute Generierung
// gespeichert werden soll.

async function toolSaveScript(
  clientId: string,
  input: {
    title: string;
    short_script?: string;
    long_script?: string;
    body?: string;
    text_hook?: string;
    hook_pattern?: string;
    pillar?: string;
    content_type?: string;
    format?: string;
    cta?: string;
  },
): Promise<string> {
  if (!input.title?.trim()) return "Titel fehlt. Gib einen kurzen Titel mit.";

  let body = input.body?.trim() || "";
  if (!body) {
    if (!input.short_script && !input.long_script) {
      return "Skript-Text fehlt. Übergib entweder body oder short_script + long_script.";
    }
    const textHookLine = input.text_hook ? `[TEXT-HOOK auf Screen]: "${input.text_hook}"` : "";
    const parts: string[] = [];
    if (input.short_script) {
      parts.push(`── KURZ (30-40 Sek) ──\n${textHookLine ? textHookLine + "\n\n" : ""}${input.short_script.trim()}`);
    }
    if (input.long_script) {
      parts.push(`── LANG (60+ Sek) ──\n${textHookLine ? textHookLine + "\n\n" : ""}${input.long_script.trim()}`);
    }
    body = parts.join("\n\n");
  }

  const firstPara = (input.short_script || input.long_script || body).trim().split(/\n{2,}/)[0] || "";

  const scriptId = uuid();
  const { error } = await supabase.from("scripts").insert({
    id: scriptId,
    client_id: clientId,
    title: input.title.trim(),
    pillar: input.pillar || "",
    content_type: input.content_type || "",
    format: input.format || "",
    hook: firstPara,
    hook_pattern: input.hook_pattern || "",
    text_hook: input.text_hook || "",
    body,
    cta: input.cta || "",
    status: "entwurf",
    source: "chat-agent-manual",
    shot_list: "",
    pattern_type: "",
    post_type: "",
    anchor_ref: "",
    cta_type: "",
    funnel_stage: "",
    created_at: new Date().toISOString().split("T")[0],
  });
  if (error) return `Fehler beim Speichern: ${error.message}`;
  return `Skript gespeichert: "${input.title}" (id=${scriptId}). Zu finden im Skripte-Tab des Clients.`;
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

// ── search_web ────────────────────────────────────────────────────────────

export async function toolSearchWeb(
  input: { query: string; market?: string },
): Promise<string> {
  try {
    const results = await searchWeb(input.query, { market: input.market });
    if (results.length === 0) return `Keine Ergebnisse für "${input.query}".`;

    return `Web-Ergebnisse für "${input.query}":\n\n${results.map((r, i) => {
      const parts = [`[${i + 1}] ${r.title}`];
      if (r.age) parts.push(`(${r.age})`);
      parts.push(r.description);
      return parts.join("\n");
    }).join("\n\n")}`;
  } catch (err) {
    return `Web-Suche fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`;
  }
}

// ── research_trends ───────────────────────────────────────────────────────

export async function toolResearchTrends(
  clientId: string | null,
  input: { niche?: string },
): Promise<string> {
  let niche = input.niche;

  // Try to get niche from client config if not provided
  if (!niche && clientId) {
    const config = await readConfig(clientId);
    niche = config?.creatorsCategory || undefined;
  }

  if (!niche) return "Bitte gib eine Nische an (z.B. 'Trading', 'Fitness').";

  try {
    const trendResults = await searchTrends(niche);
    const allResults = trendResults.flatMap(tr =>
      tr.results.map(r => ({ ...r, query: tr.query }))
    );

    if (allResults.length === 0) return `Keine Trend-Ergebnisse für "${niche}".`;

    return `Live-Trends für "${niche}":\n\n${trendResults.map(tr => {
      if (tr.results.length === 0) return "";
      return `Suche: "${tr.query}"\n${tr.results.map((r, i) => {
        const parts = [`  [${i + 1}] ${r.title}`];
        if (r.age) parts.push(`  (${r.age})`);
        parts.push(`  ${r.description}`);
        return parts.join("\n");
      }).join("\n\n")}`;
    }).filter(Boolean).join("\n\n---\n\n")}`;
  } catch (err) {
    return `Trend-Recherche fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`;
  }
}

// ── check_learnings ───────────────────────────────────────────────────────

export async function toolCheckLearnings(clientId: string): Promise<string> {
  try {
    const learnings = await getHighConfidenceLearnings(clientId);
    if (learnings.length === 0) return "Noch keine statistisch gesicherten Erkenntnisse. Es braucht mindestens 8 Skripte mit Performance-Daten.";

    return `${learnings.length} verifizierte Erkenntnisse:\n\n${learnings.map((l, i) => {
      const conf = Math.round(l.confidence * 100);
      const arrow = l.direction === "positive" ? "\u2191" : "\u2193";
      return `[${i + 1}] ${arrow} ${l.insight}\n    Confidence: ${conf}% | Datenpunkte: ${l.dataPoints} | Kategorie: ${l.category}`;
    }).join("\n\n")}`;
  } catch {
    return "Learnings konnten nicht geladen werden.";
  }
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

// ── Save Idea Tool ────────────────────────────────────────────────────────

async function toolSaveIdea(
  clientId: string,
  input: { title: string; description: string; content_type?: string },
): Promise<string> {
  const normalizedTitle = normalizeTitle(input.title);
  if (!normalizedTitle) return "Titel fehlt. Gib einen kurzen Titel mit.";

  const { data: existing } = await supabase
    .from("ideas")
    .select("id, title")
    .eq("client_id", clientId);

  const duplicate = existing?.find((i) => normalizeTitle(i.title) === normalizedTitle);
  if (duplicate) {
    return `Idee "${input.title}" existiert bereits (id=${duplicate.id}) — nicht erneut gespeichert.`;
  }

  const { error } = await supabase.from("ideas").insert({
    id: uuid(),
    client_id: clientId,
    title: input.title,
    description: input.description,
    content_type: input.content_type || "",
    status: "idea",
    created_at: new Date().toISOString().split("T")[0],
  });
  if (error) return `Fehler beim Speichern: ${error.message}`;
  return `Video-Idee gespeichert: "${input.title}". Du findest sie im Ideen-Tab des Clients.`;
}

function normalizeTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:!?]+$/, "");
}

// ── List Ideas Tool ───────────────────────────────────────────────────────

async function toolListIdeas(
  clientId: string,
  input: { status?: string; query?: string },
): Promise<string> {
  const { data, error } = await supabase
    .from("ideas")
    .select("id, title, description, content_type, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return `Fehler beim Laden: ${error.message}`;
  if (!data || data.length === 0) return "Keine Ideen gespeichert für diesen Client.";

  let ideas = data;
  if (input.status) ideas = ideas.filter(i => i.status === input.status);
  if (input.query) {
    const q = input.query.toLowerCase();
    ideas = ideas.filter(i =>
      (i.title || "").toLowerCase().includes(q) ||
      (i.description || "").toLowerCase().includes(q),
    );
  }
  if (ideas.length === 0) return "Keine Ideen gefunden die dem Filter entsprechen.";

  const lines = ideas.map(i => {
    const desc = (i.description || "").replace(/\s+/g, " ").trim();
    const descShort = desc.length > 180 ? desc.slice(0, 180) + "..." : desc;
    return `- [${i.status}] "${i.title}"${i.content_type ? ` (${i.content_type})` : ""} — ${descShort || "(keine Beschreibung)"}  [id: ${i.id}]`;
  });
  return `Ideen (${ideas.length}):\n${lines.join("\n")}`;
}

// ── Update Profile Tool ───────────────────────────────────────────────────

const SAFE_PROFILE_FIELDS = new Set([
  "businessContext", "professionalBackground", "keyAchievements",
  "brandFeeling", "brandProblem", "brandingStatement",
  "humanDifferentiation", "providerRole", "providerBeliefs",
  "providerStrengths", "authenticityZone",
]);

async function toolUpdateProfile(
  clientId: string,
  input: { field_name: string; value: string },
): Promise<string> {
  if (!SAFE_PROFILE_FIELDS.has(input.field_name)) {
    return `Feld "${input.field_name}" darf nicht über den Chat geändert werden.`;
  }
  await updateConfig(clientId, { [input.field_name]: input.value });
  const preview = input.value.length > 120 ? input.value.slice(0, 120) + "..." : input.value;
  return `Profil aktualisiert: ${input.field_name} → "${preview}"`;
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
  onScriptProgress?: ScriptAgentProgressFn,
): Promise<string> {
  // Tools that don't need a clientId
  if (toolName === "list_clients") {
    if (scopedClientId) return "Du hast nur Zugriff auf deine eigenen Daten.";
    return toolListClients();
  }

  if (toolName === "search_web") {
    return toolSearchWeb(toolInput as { query: string; market?: string });
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
    case "generate_script": {
      const scriptInput: ScriptAgentInput = {
        title: toolInput.title as string,
        description: toolInput.description as string,
        pillar: toolInput.pillar as string | undefined,
        contentType: toolInput.contentType as string | undefined,
        format: toolInput.format as string | undefined,
        tone: toolInput.tone as string | undefined,
        conversationContext: toolInput.conversation_context as string | undefined,
      };
      return toolGenerateScript(clientId, scriptInput, onScriptProgress);
    }
    case "check_competitors":
      return toolCheckCompetitors(clientId, toolInput as { limit?: number });
    case "research_trends":
      return toolResearchTrends(clientId, toolInput as { niche?: string });
    case "check_learnings":
      return toolCheckLearnings(clientId);
    case "save_idea":
      return toolSaveIdea(clientId, toolInput as { title: string; description: string; content_type?: string });
    case "list_ideas":
      return toolListIdeas(clientId, toolInput as { status?: string; query?: string });
    case "save_script":
      return toolSaveScript(clientId, toolInput as Parameters<typeof toolSaveScript>[1]);
    case "update_profile":
      return toolUpdateProfile(clientId, toolInput as { field_name: string; value: string });
    default:
      return `Unbekanntes Tool: ${toolName}`;
  }
}
