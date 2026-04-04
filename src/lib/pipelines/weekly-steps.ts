// ── Weekly Script Pipeline — Extracted Steps ──────────────────────────────
// Each step has a clear input/output interface and can be tested independently.

import Anthropic from "@anthropic-ai/sdk";
import { readConfig, readVideos, readScriptsByClient, readStrategyConfig } from "@/lib/csv";
import { getAuditBlock } from "@/lib/audit";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import { buildPrompt, TOPIC_SELECTION_TOOL, TREND_RESEARCH_TOOL, HOOK_GENERATION_TOOL, BODY_WRITING_TOOL, QUALITY_REVIEW_TOOL } from "@prompts";
import { getVoiceProfile, generateVoiceProfile, voiceProfileToPromptBlock, getScriptStructure, generateScriptStructure, scriptStructureToPromptBlock } from "@/lib/voice-profile";
import { safeJsonParse } from "@/lib/safe-json";
import { searchTrendsDeep, formatDeepTrendResults } from "@/lib/brave-search";
import type { DeepTrendContext } from "@/lib/brave-search";
import { buildPlatformContext, parseTargetPlatforms, DEFAULT_PLATFORM } from "@/lib/platforms";
import type { PlatformId } from "@/lib/platforms";
import { getLatestSnapshot, buildTrendBlockFromSnapshot } from "@/lib/intelligence";
import { getHighConfidenceLearnings, buildLearningsBlock } from "@/lib/client-learnings";
import type { ClientLearning } from "@/lib/client-learnings";
import { buildClientProfile, buildBrandContext } from "@/lib/client-context";
import { fmt, fmtDuration } from "@/lib/format";
import { parseInsights, videoInsightBlock } from "@/lib/performance-helpers";
import type { VideoInsight } from "@/lib/performance-helpers";
import type { VoiceProfile, ScriptStructureProfile, Config, Script } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────

export interface PipelineContext {
  config: Config;
  clientName: string;
  clientContext: string;
  brandContext: string;
  platformContext: string;
  primaryPlatform: PlatformId;
  // Strategy
  pillars: { name: string; subTopics?: string }[];
  pillarNames: string[];
  pillarBlock: string;
  weekSchedule: { day: string; contentType: string; format: string; pillar: string }[];
  activeDays: string[];
  postsPerWeek: number;
  // Content types
  allContentTypes: { name: string }[];
  allFormats: { name: string }[];
  // Performance
  auditBlock: string;
  ownPerformanceBlock: string;
  competitorHooksBlock: string;
  crossNicheBlock: string;
  ownTopVideos: VideoInsight[];
  // Scripts
  recentBlock: string;
  usedPatternsBlock: string;
  // Duration
  avgDuration: number;
  maxWords: number;
}

export interface VoiceContext {
  voiceProfile: VoiceProfile | null;
  scriptStructure: ScriptStructureProfile | null;
  voiceBlock: string;
  structureBlock: string;
  voiceToneBlock: string;
  structureHookBlock: string;
}

export interface ResearchContext {
  trendBlock: string;
  learningsBlock: string;
  learnings: ClientLearning[];
  hasTrendSnapshot: boolean;
}

export interface TopicResult {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  description: string;
  reasoning: string;
}

export interface HookResult {
  hook: string;
  pattern: string;
  allOptions: { hook: string; pattern: string }[];
  reason: string;
}

export interface BodyResult {
  body: string;
  cta: string;
}

export interface AssembledScript {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  hook: string;
  hookPattern: string;
  body: string;
  cta: string;
  reasoning: string;
}

// ── Step 1: Load Context ──────────────────────────────────────────────────

export async function loadPipelineContext(configId: string): Promise<PipelineContext> {
  const config = await readConfig(configId);
  if (!config) throw new Error("Config not found");

  const clientContext = buildClientProfile(config as unknown as Record<string, string>);
  const brandContext = buildBrandContext(config as unknown as Record<string, string>);
  const clientName = config.name || config.configName || "Kunde";

  // Platform
  const platforms = parseTargetPlatforms(config.targetPlatforms);
  const primaryPlatform: PlatformId = platforms[0] || DEFAULT_PLATFORM;
  const platformContext = buildPlatformContext(primaryPlatform);

  // Strategy
  const pillars: { name: string; subTopics?: string }[] = safeJsonParse(config.strategyPillars, []);
  const weekly: Record<string, { type: string; format: string }> = safeJsonParse(config.strategyWeekly);

  // Parallel DB reads
  const configName = config.configName || config.name || "";
  const [allVideos, existingScripts, auditBlock, strategyJson] = await Promise.all([
    readVideos(),
    readScriptsByClient(configId),
    getAuditBlock(configId),
    readStrategyConfig(),
  ]);
  const configVideos = allVideos.filter(v => v.configName === configName);

  const allContentTypes = [...BUILT_IN_CONTENT_TYPES, ...(strategyJson.customContentTypes || [])];
  const allFormats = [...BUILT_IN_FORMATS, ...(strategyJson.customFormats || [])];

  const postsPerWeek = parseInt(config.postsPerWeek || "5", 10);
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);
  const pillarNames = pillars.map(p => p.name);

  const weekSchedule = activeDays.map((day, i) => {
    const d = weekly[day];
    return {
      day,
      contentType: d?.type || allContentTypes[i % allContentTypes.length]?.name || "Education / Value",
      format: d?.format || allFormats[i % allFormats.length]?.name || "Face to Camera",
      pillar: pillarNames.length > 0 ? pillarNames[i % pillarNames.length] : "Allgemein",
    };
  });

  const pillarBlock = pillars.map(p => {
    let line = `- ${p.name}`;
    if (Array.isArray(p.subTopics)) {
      line += "\n" + (p.subTopics as unknown as { title: string; angle?: string }[]).map((st) =>
        `  • ${st.title}${st.angle ? ` (${st.angle})` : ""}`
      ).join("\n");
    } else if (p.subTopics) {
      line += `\n  Unterthemen: ${p.subTopics}`;
    }
    return line;
  }).join("\n");

  // Performance data
  const insights = parseInsights(config.performanceInsights || "");
  const ownTopVideos: VideoInsight[] = [
    ...(insights?.top30Days || []),
    ...(insights?.topAllTime || []),
  ];

  const creatorVideos = configVideos.filter(v => v.views > 0).sort((a, b) => b.views - a.views).slice(0, 6);

  const ownPerformanceBlock = ownTopVideos.length > 0
    ? `<own_top_videos>\n${ownTopVideos.slice(0, 5).map((v, i) => videoInsightBlock(v, i)).join("\n\n")}\n</own_top_videos>`
    : "";

  const crossNicheVideos = allVideos
    .filter(v => v.configName !== configName && v.views > 0 && v.analysis)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const crossNicheBlock = crossNicheVideos.length > 0
    ? `<cross_niche_inspiration>\nVirale Videos aus ANDEREN Nischen — Formate und Hooks die du adaptieren kannst:\n${crossNicheVideos.map((v, i) => {
        const lines = [`[${i + 1}] @${v.creator} · ${fmt(v.views)} Views · Nische: ${v.configName}`];
        if (v.analysis) {
          const m = v.analysis.match(/HOOK[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
          if (m) lines.push(`Hook: ${m[1].trim().slice(0, 150)}`);
          const f = v.analysis.match(/(?:FORMAT|KONZEPT|CONCEPT)[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
          if (f) lines.push(`Format: ${f[1].trim().slice(0, 150)}`);
        }
        return lines.join("\n");
      }).join("\n\n")}\n</cross_niche_inspiration>`
    : "";

  const competitorHooksBlock = creatorVideos.length > 0
    ? creatorVideos.map((v, i) => {
        const lines = [`[${i + 1}] @${v.creator} · ${fmt(v.views)} Views`];
        if (v.analysis) {
          const m = v.analysis.match(/HOOK[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
          if (m) lines.push(`Hook: ${m[1].trim().slice(0, 150)}`);
        }
        return lines.join("\n");
      }).join("\n\n")
    : "";

  // Recent scripts
  const recentScriptsInfo = existingScripts.slice(-40).map(s => {
    let line = `- ${s.title}`;
    if (s.pillar) line += ` [${s.pillar}]`;
    if (s.hookPattern) line += ` (Muster: ${s.hookPattern})`;
    if (s.hook) line += `\n  Hook: "${s.hook.slice(0, 120)}"`;
    return line;
  }).filter(Boolean);
  const recentBlock = recentScriptsInfo.length > 0
    ? `\n⚠️ BEREITS GESCHRIEBEN — DIESE THEMEN, HOOKS UND WINKEL SIND GESPERRT. Wähle komplett andere Themen und Perspektiven:\n${recentScriptsInfo.join("\n")}`
    : "";

  // Hook pattern tracking
  const patternCounts: Record<string, number> = {};
  for (const s of existingScripts) {
    if (s.hookPattern) patternCounts[s.hookPattern] = (patternCounts[s.hookPattern] || 0) + 1;
  }
  const usedPatternsBlock = Object.keys(patternCounts).length > 0
    ? Object.entries(patternCounts).sort((a, b) => b[1] - a[1]).map(([p, c]) => `- ${p} (${c}× verwendet)`).join("\n")
    : "";

  // Duration
  const allDurations = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];
  const avgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;

  return {
    config, clientName, clientContext, brandContext, platformContext, primaryPlatform,
    pillars, pillarNames, pillarBlock, weekSchedule, activeDays, postsPerWeek,
    allContentTypes, allFormats,
    auditBlock, ownPerformanceBlock, competitorHooksBlock, crossNicheBlock, ownTopVideos,
    recentBlock, usedPatternsBlock,
    avgDuration, maxWords: avgDuration > 0 ? Math.round(avgDuration * 2) : 0,
  };
}

// ── Step 2: Load Voice Profiles ───────────────────────────────────────────

export async function loadVoiceProfiles(configId: string, clientName: string): Promise<VoiceContext> {
  const [voiceResult, structureResult] = await Promise.allSettled([
    getVoiceProfile(configId).then(async (p) => p || await generateVoiceProfile(configId, clientName)),
    getScriptStructure(configId).then(async (s) => s || await generateScriptStructure(configId, clientName)),
  ]);

  const voiceProfile: VoiceProfile | null = voiceResult.status === "fulfilled" ? voiceResult.value : null;
  const scriptStructure: ScriptStructureProfile | null = structureResult.status === "fulfilled" ? structureResult.value : null;

  return {
    voiceProfile,
    scriptStructure,
    voiceBlock: voiceProfile ? voiceProfileToPromptBlock(voiceProfile, clientName) : "",
    structureBlock: scriptStructure ? scriptStructureToPromptBlock(scriptStructure) : "",
    voiceToneBlock: voiceProfile
      ? `\nSTIMMPROFIL:\nTon: ${voiceProfile.tone}\nEnergie: ${voiceProfile.energy}\nLieblingswörter: ${voiceProfile.favoriteWords.slice(0, 5).join(", ")}`
      : "",
    structureHookBlock: scriptStructure
      ? `\nSKRIPT-STRUKTUR HOOK-MUSTER (aus Training gelernt — bevorzuge diese):\n${scriptStructure.hookPatterns.map(h => `- ${h.pattern}: "${h.example}"`).join("\n")}`
      : "",
  };
}

// ── Step 2.5: Research (Snapshots + Trends + Learnings) ───────────────────

export async function runResearch(
  configId: string,
  config: Config,
  clientName: string,
  recentBlock: string,
  platformContext: string,
  claude: Anthropic,
): Promise<ResearchContext> {
  const [trendSnapshot, learnings] = await Promise.all([
    getLatestSnapshot(configId, "web_trends"),
    getHighConfidenceLearnings(configId),
  ]);

  const learningsBlock = buildLearningsBlock(learnings);
  let trendBlock = "";
  let webTrendContext = "";

  // Build deep search context from client data
  const pillars: { name: string }[] = safeJsonParse(config.strategyPillars, []);
  const customerProblems = safeJsonParse(config.customerProblems);
  const deepCtx: DeepTrendContext = {
    niche: config.creatorsCategory || "Social Media",
    pillars: pillars.map(p => p.name).slice(0, 3),
    customerProblems: [customerProblems.mental, customerProblems.emotional, customerProblems.practical].filter(Boolean).join(". "),
    brandProblem: config.brandProblem || undefined,
    businessContext: config.businessContext || undefined,
  };

  // Deep search: 12-15 targeted queries across 6 categories (~2s parallel)
  try {
    const deepResults = await searchTrendsDeep(deepCtx);
    const totalResults = deepResults.reduce((sum, r) => sum + r.results.length, 0);
    if (totalResults > 0) {
      webTrendContext = formatDeepTrendResults(deepResults);
    }
  } catch {
    // Live search failed — fall back to snapshot
    if (trendSnapshot) {
      webTrendContext = buildTrendBlockFromSnapshot(trendSnapshot.data);
    }
  }

  // Claude synthesizes trends from real search data (does NOT invent)
  try {
    const niche = deepCtx.niche;
    const currentDate = new Date().toISOString().split("T")[0];
    const monthLabel = new Date(currentDate).toLocaleString("de-DE", { month: "long", year: "numeric" });

    const trendSystem = buildPrompt("trend-research", {
      niche, current_date: currentDate, month_label: monthLabel, platform_context: platformContext,
    });

    const trendPromise = claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      temperature: 0.7,
      system: trendSystem,
      tools: [TREND_RESEARCH_TOOL],
      tool_choice: { type: "tool", name: "submit_trends" },
      messages: [{
        role: "user",
        content: `Nische: ${niche}\nKunde: ${clientName}${config.businessContext ? `\nBusiness: ${config.businessContext}` : ""}\n\n${recentBlock}\n\n${webTrendContext}\n\nGruppiere die Suchergebnisse oben zu 6-12 konkreten Video-Themen. JEDES Thema muss auf echten Suchergebnissen basieren. Erfinde NICHTS.`,
      }],
    });

    const trendMsg = await Promise.race([trendPromise, new Promise<null>((r) => setTimeout(() => r(null), 45000))]);
    if (trendMsg) {
      const tu = trendMsg.content.find(b => b.type === "tool_use");
      if (tu && tu.type === "tool_use") {
        const result = tu.input as { trends: Array<{ topic: string; angle: string; whyNow: string; hookIdea: string; sourceUrls: string[]; category: string }> };
        trendBlock = `<trending_topics>\nAktuelle Trends basierend auf echten Suchdaten (JEDES Thema muss auf einem dieser Trends basieren):\n${result.trends.map((t, i) => `${i + 1}. ${t.topic} — ${t.angle}\n   Warum jetzt: ${t.whyNow}\n   Hook-Idee: "${t.hookIdea}"\n   Kategorie: ${t.category}\n   Quellen: ${t.sourceUrls.join(", ")}`).join("\n\n")}\n</trending_topics>`;
      }
    }
  } catch { /* Trend synthesis failed */ }

  return { trendBlock, learningsBlock, learnings, hasTrendSnapshot: !!trendSnapshot };
}

// ── Step 3: Topic Selection ───────────────────────────────────────────────

export async function selectTopics(
  ctx: PipelineContext,
  research: ResearchContext,
  claude: Anthropic,
): Promise<TopicResult[]> {
  const topicSystemPrompt = buildPrompt("topic-selection", {
    num_days: String(ctx.activeDays.length),
    platform_context: ctx.platformContext,
  });
  const topicTool = TOPIC_SELECTION_TOOL(
    ctx.activeDays, ctx.pillarNames,
    ctx.allContentTypes.map(t => t.name), ctx.allFormats.map(f => f.name),
  );

  // Research-first prompt: Trends PRIMARY, Strategy as FILTER
  const topicUserPrompt = `${research.trendBlock}

${ctx.recentBlock}

<performance_signals>
${ctx.ownPerformanceBlock}
${ctx.competitorHooksBlock ? `\nCOMPETITOR-VIDEOS:\n${ctx.competitorHooksBlock}` : ""}
${research.learningsBlock}
${ctx.crossNicheBlock}
</performance_signals>

${ctx.auditBlock}

<strategy_filter>
CONTENT PILLARS (nutze als Filter — ordne Trends den passendsten Pillars zu):
${ctx.pillarBlock}

WOCHENPLAN (${ctx.postsPerWeek}×/Woche):
${ctx.weekSchedule.map(s => `${s.day}: Content-Type "${s.contentType}" | Format "${s.format}" | Pillar "${s.pillar}"`).join("\n")}
</strategy_filter>

<client>
${ctx.clientContext}
Nische: ${ctx.config.creatorsCategory || ""}
</client>

AUFTRAG: Wähle ${ctx.activeDays.length} Themen für diese Woche. JEDES Thema muss auf einem der Trends oben basieren. Adaptiere die besten Trends für diesen Client und ordne jedem den passendsten Pillar zu. Der Pillar ist der FILTER, nicht die Quelle der Idee. Gib im trendRef Feld an welcher Trend die Basis war.

GESPERRTE THEMEN: Alles in der Blacklist oben ist TABU — keine Wiederholungen, auch nicht in Abwandlung.`;

  const msg = await claude.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 2000, temperature: 1,
    system: topicSystemPrompt, tools: [topicTool],
    tool_choice: { type: "tool", name: "submit_topics" },
    messages: [{ role: "user", content: topicUserPrompt }],
  });

  const tu = msg.content.find(b => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw new Error("KI konnte keine Themen auswählen.");

  const result = tu.input as { topics: TopicResult[] };
  return result.topics.map((t, i) => ({
    ...t,
    day: ctx.weekSchedule[i]?.day || t.day,
    pillar: t.pillar || ctx.weekSchedule[i]?.pillar || "",
    contentType: t.contentType || ctx.weekSchedule[i]?.contentType || "",
    format: t.format || ctx.weekSchedule[i]?.format || "",
  }));
}

// ── Step 4: Hook Generation (parallel) ────────────────────────────────────

export async function generateHooks(
  topics: TopicResult[],
  ctx: PipelineContext,
  voice: VoiceContext,
  claude: Anthropic,
  onHookDone?: (index: number, hook: string) => void,
): Promise<HookResult[]> {
  const promises = topics.map(async (topic, idx) => {
    const userPrompt = `THEMA: ${topic.title}\nBESCHREIBUNG: ${topic.description}\nContent-Type: ${topic.contentType} | Format: ${topic.format}\n\n${ctx.competitorHooksBlock ? `COMPETITOR-HOOKS (was in der Nische funktioniert):\n${ctx.competitorHooksBlock}` : ""}${ctx.usedPatternsBlock ? `\nBEREITS VERWENDETE HOOK-MUSTER (vermeide Wiederholung, wähle ANDERE):\n${ctx.usedPatternsBlock}` : ""}${voice.structureHookBlock}${voice.voiceToneBlock}\n\nErstelle 3 Hook-Optionen für dieses Thema. Nutze Hook-Muster die NOCH NICHT oft verwendet wurden.`;

    try {
      const msg = await claude.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 500, temperature: 1,
        system: buildPrompt("hook-generation", { platform_context: ctx.platformContext }),
        tools: [HOOK_GENERATION_TOOL],
        tool_choice: { type: "tool", name: "submit_hooks" },
        messages: [{ role: "user", content: userPrompt }],
      });

      const tu = msg.content.find(b => b.type === "tool_use");
      if (tu && tu.type === "tool_use") {
        const result = tu.input as { options: { hook: string; pattern: string }[]; selected: number; selectionReason: string };
        const selectedIdx = result.selected ?? 0;
        const hook = result.options[selectedIdx]?.hook || result.options[0]?.hook || "";
        const pattern = result.options[selectedIdx]?.pattern || result.options[0]?.pattern || "";
        onHookDone?.(idx, hook);
        return { hook, pattern, allOptions: result.options, reason: result.selectionReason };
      }
    } catch { /* Fallback */ }

    onHookDone?.(idx, topic.title);
    return { hook: topic.title, pattern: "", allOptions: [], reason: "fallback" };
  });

  return Promise.all(promises);
}

// ── Step 5: Body Writing (parallel) ───────────────────────────────────────

export async function writeBodies(
  topics: TopicResult[],
  hooks: HookResult[],
  ctx: PipelineContext,
  voice: VoiceContext,
  claude: Anthropic,
  onBodyDone?: (index: number, day: string, title: string) => void,
): Promise<BodyResult[]> {
  const durationLabel = ctx.avgDuration > 0 ? fmtDuration(ctx.avgDuration) : "";
  const laengeRegeln = ctx.maxWords > 0
    ? `- LÄNGE: Max ${ctx.maxWords} Wörter gesamt (Hook+Body+CTA). Das entspricht ca. ${durationLabel} Sprechzeit. Kürzer ist besser.`
    : `- LÄNGE: Kurze Video-Formate. Max 30-60 Sekunden Sprechzeit. Prägnant.`;

  const bodySystemPrompt = buildPrompt("body-writing", {
    laenge_regeln: laengeRegeln, stimm_matching: "", skript_struktur: "", skript_beispiele: "",
    platform_context: ctx.platformContext,
  });

  const promises = topics.map(async (topic, idx) => {
    const userPrompt = `<client>\n${ctx.clientContext}\n${ctx.brandContext}\n</client>\n\n${voice.voiceBlock}\n\n${voice.structureBlock}\n\nTHEMA: ${topic.title}\nBESCHREIBUNG: ${topic.description}\nHOOK (bereits fertig): "${hooks[idx].hook}"\n\nSchreibe jetzt Body und CTA. Der Hook steht — baue darauf auf. Folge den Strukturmustern aus dem Skript-Aufbau-Profil.`;

    try {
      const msg = await claude.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 1500, temperature: 0.8,
        system: bodySystemPrompt, tools: [BODY_WRITING_TOOL(ctx.maxWords)],
        tool_choice: { type: "tool", name: "submit_body" },
        messages: [{ role: "user", content: userPrompt }],
      });

      const tu = msg.content.find(b => b.type === "tool_use");
      if (tu && tu.type === "tool_use") {
        const result = tu.input as { body: string; cta: string };
        onBodyDone?.(idx, topic.day, topic.title);
        return result;
      }
    } catch { /* Fallback */ }

    onBodyDone?.(idx, topic.day, topic.title);
    return { body: "", cta: "" };
  });

  return Promise.all(promises);
}

// ── Step 6: Quality Review ────────────────────────────────────────────────

export async function reviewQuality(
  scripts: AssembledScript[],
  voice: VoiceContext,
  platformContext: string,
  claude: Anthropic,
): Promise<{ finalScripts: AssembledScript[]; issues: string[] }> {
  const reviewUserPrompt = `${voice.voiceBlock ? voice.voiceBlock + "\n\n" : ""}${voice.structureBlock ? voice.structureBlock + "\n\n" : ""}${scripts.map((s, i) => `--- SKRIPT ${i + 1} (${s.day}) ---\nTITEL: ${s.title}\nHOOK: ${s.hook}\nBODY: ${s.body}\nCTA: ${s.cta}`).join("\n\n")}\n\nPrüfe alle ${scripts.length} Skripte.`;

  const finalScripts = [...scripts];
  const issues: string[] = [];

  try {
    const reviewPromise = claude.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 4000,
      system: buildPrompt("quality-review", { platform_context: platformContext }),
      tools: [QUALITY_REVIEW_TOOL(scripts.length)],
      tool_choice: { type: "tool", name: "submit_review" },
      messages: [{ role: "user", content: reviewUserPrompt }],
    });

    const reviewMsg = await Promise.race([reviewPromise, new Promise<null>((r) => setTimeout(() => r(null), 60000))]);

    if (reviewMsg) {
      const tu = reviewMsg.content.find(b => b.type === "tool_use");
      if (tu && tu.type === "tool_use") {
        const review = tu.input as {
          scripts: Array<{ index: number; issues: string[]; revised?: { hook?: string; body?: string; cta?: string } | null }>;
          weekCoherence: string;
        };
        for (const r of review.scripts) {
          if (r.revised && finalScripts[r.index]) {
            if (r.revised.hook) finalScripts[r.index].hook = r.revised.hook;
            if (r.revised.body) finalScripts[r.index].body = r.revised.body;
            if (r.revised.cta) finalScripts[r.index].cta = r.revised.cta;
          }
          if (r.issues.length > 0) {
            issues.push(...r.issues.map(issue => `Skript ${r.index + 1}: ${issue}`));
          }
        }
      }
    }
  } catch { /* Review failed — use scripts as-is */ }

  return { finalScripts, issues };
}
