// ── Weekly Script Pipeline — Extracted Steps ──────────────────────────────
// Each step has a clear input/output interface and can be tested independently.

import Anthropic from "@anthropic-ai/sdk";
import { readConfig, readVideos, readScriptsByClient, readStrategyConfig } from "@/lib/csv";
import { getAuditBlockAndDuration } from "@/lib/audit";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import { buildPrompt, TOPIC_SELECTION_TOOL, TREND_RESEARCH_TOOL, HOOK_GENERATION_TOOL, BODY_WRITING_TOOL, QUALITY_REVIEW_TOOL } from "@prompts";
import { getVoiceProfile, generateVoiceProfile, voiceProfileToPromptBlock, getScriptStructure, generateScriptStructure, scriptStructureToPromptBlock } from "@/lib/voice-profile";
import { voiceOnboardingToPromptBlock } from "@/lib/voice-onboarding";
import { safeJsonParse } from "@/lib/safe-json";
import { searchTrendsDeep, formatDeepTrendResults, countDistinctCategoriesWithResults } from "@/lib/brave-search";
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
import type { VoiceProfile, ScriptStructureProfile, Config, Script, Pillar, PillarType } from "@/lib/types";
import { normalizePillarType } from "@/lib/types";
import { weekSeed, mulberry32, seededInt, shuffle, ALL_PATTERN_TYPES, type PatternType } from "@/lib/week-seed";
import { findDuplicateTitles, findDuplicatesByDB } from "@/lib/embeddings";

// ── Types ─────────────────────────────────────────────────────────────────

export interface PipelineContext {
  config: Config;
  clientName: string;
  lang: "de" | "en";
  clientContext: string;
  brandContext: string;
  platformContext: string;
  primaryPlatform: PlatformId;
  // Strategy
  pillars: Pillar[];
  pillarNames: string[];
  pillarBlock: string;
  pillarTypeMap: Record<string, PillarType | undefined>;   // pillar name → type
  weekSchedule: {
    day: string;
    contentType: string;
    format: string;
    pillar: string;
    pillarType?: PillarType;
    patternType: PatternType;
    ctaType: CtaType;
    ctaExample: string;
    funnelStage: FunnelStage;
  }[];
  activeDays: string[];
  postsPerWeek: number;
  weekRng: () => number;
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
  recentTitles: string[];
  anchorCandidates: { title: string; source: string }[];
  anchorBlock: string;
  // Duration
  avgDuration: number;
  maxWords: number;
  durationIsAuditOverride: boolean;
}

export interface VoiceContext {
  voiceProfile: VoiceProfile | null;
  scriptStructure: ScriptStructureProfile | null;
  voiceBlock: string;
  structureBlock: string;
  voiceToneBlock: string;
  structureHookBlock: string;
  /** Voice onboarding synthesis (holistic voice-DNA doc from 8-block interview). Empty string when no onboarding data. */
  voiceOnboardingBlock: string;
}

export interface ResearchContext {
  trendBlock: string;
  learningsBlock: string;
  learnings: ClientLearning[];
  hasTrendSnapshot: boolean;
}

export type PostType = "core" | "variant" | "test";
export type CtaType = "soft" | "lead" | "authority" | "none";
export type FunnelStage = "TOF" | "MOF" | "BOF";

const DEFAULT_CTA_ROTATION: Array<{ ctaType: CtaType; funnelStage: FunnelStage }> = [
  { ctaType: "soft", funnelStage: "TOF" },
  { ctaType: "lead", funnelStage: "MOF" },
  { ctaType: "soft", funnelStage: "MOF" },
  { ctaType: "authority", funnelStage: "BOF" },
  { ctaType: "lead", funnelStage: "BOF" },
  { ctaType: "soft", funnelStage: "TOF" },
  { ctaType: "lead", funnelStage: "MOF" },
];

export interface TopicResult {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  patternType: PatternType;
  postType: PostType;
  anchorRef: string;
  title: string;
  description: string;
  reasoning: string;
}

// ── Title Quality Gate ─────────────────────────────────────────────────────
// Rejects generic "Stanni" titles (0 specificity). Every title must have at
// least one specificity anchor: a number, a named method/tool, a contrarian
// marker, or a concrete scene reference.
export function checkTitleSpecificity(title: string): { ok: boolean; reason: string } {
  const t = title.trim();
  if (t.length < 6) return { ok: false, reason: "zu kurz" };

  // Hard anti-patterns — recycled finance-guru templates
  const antiPatterns: Array<{ re: RegExp; label: string }> = [
    { re: /^warum\s+(ein|eine|der|die|das)\s+\S+\s+dich\s+nie(mals)?\b/i, label: '"Warum X dich niemals …" ist ein 2020-Bro-Template' },
    { re: /^so\s+erkennst?\s+du\s+(in|an)\s+\d+\s+\S+/i, label: '"So erkennst du in X Schritten …" = generisches Listicle' },
    { re: /^\d+\s+(tipps?|fehler|dinge|zeichen|gründe|geheimnisse)\b/i, label: '"X Tipps/Fehler/…" Listicle-Format ohne Twist' },
    { re: /an\s+einem\s+tag\b|in\s+(?:einer\s+)?24\s*stunden\b/i, label: '"an einem Tag" klingt fake ohne Zeitrahmen' },
    { re: /^der?\s+(tag|moment|morgen)\s*,?\s*an\s+dem\s+ich\s+nie\s*wieder\b/i, label: '"Der Moment an dem ich nie wieder …" = weiche Story ohne Konflikt' },
  ];
  for (const p of antiPatterns) {
    if (p.re.test(t)) return { ok: false, reason: p.label };
  }

  // Specificity anchors — at least ONE must match
  const hasNumber = /\d/.test(t);
  const hasContrarian = /\b(quatsch|lüge|fake|mythos|niemals\s+\w+\s+weil|unpopulär|kontrovers|unbequem|nie\s+wieder\s+\w+\s+weil|kostet|verbrennt|ruiniert|gelogen|falsche?r?\s)\b/i.test(t);
  const hasNamedTool = /[A-ZÄÖÜ][a-zäöüß]{2,}-[A-ZÄÖÜ][a-zäöüß]{2,}/.test(t) || /\b(stop-loss|tradingview|binance|crypto\.com|metatrader|nasdaq|s&p|etf|dax)\b/i.test(t);
  const hasTimeMarker = /\b\d{1,2}[:.]?\d{2}?\s*(uhr|am|pm)\b/i.test(t) || /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i.test(t);
  const hasQuoteOrDialog = /["„»].+["»"]/.test(t);

  const anchors = [
    hasNumber && "Zahl",
    hasContrarian && "Contrarian-Marker",
    hasNamedTool && "benannter Tool/Anker",
    hasTimeMarker && "Zeit-/Tag-Anker",
    hasQuoteOrDialog && "Zitat/Dialog",
  ].filter(Boolean);

  if (anchors.length === 0) {
    return { ok: false, reason: "kein Spezifitäts-Anker (keine Zahl, kein Tool/Name, keine Contrarian-These, keine Szene)" };
  }
  return { ok: true, reason: anchors.join(", ") };
}

export function expectedPostTypeCounts(n: number): { core: number; variant: number; test: number } {
  // 70/20/10 — rounded to integers that sum to n, ensuring at least 1 test when n ≥ 5
  if (n <= 0) return { core: 0, variant: 0, test: 0 };
  if (n === 1) return { core: 1, variant: 0, test: 0 };
  if (n === 2) return { core: 1, variant: 1, test: 0 };
  if (n === 3) return { core: 2, variant: 1, test: 0 };
  if (n === 4) return { core: 3, variant: 1, test: 0 };
  const core = Math.round(n * 0.7);
  const test = Math.max(1, Math.round(n * 0.1));
  const variant = n - core - test;
  return { core, variant: Math.max(0, variant), test };
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
  patternType: PatternType;
  postType: PostType;
  anchorRef: string;
  ctaType: CtaType;
  funnelStage: FunnelStage;
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
  const rawPillars: Array<Pillar & { purpose?: string }> = safeJsonParse(config.strategyPillars, []);
  const pillars: Pillar[] = rawPillars.map(p => ({
    ...p,
    pillarType: normalizePillarType(p.pillarType) || normalizePillarType(p.purpose),
  }));
  const pillarTypeMap: Record<string, PillarType | undefined> = Object.fromEntries(
    pillars.map(p => [p.name, p.pillarType]),
  );
  const weekly: Record<string, {
    type: string; format: string;
    ctaType?: CtaType; ctaExample?: string; funnelStage?: FunnelStage;
  }> = safeJsonParse(config.strategyWeekly);

  // Parallel DB reads
  const configName = config.configName || config.name || "";
  const [allVideos, existingScripts, auditResult, strategyJson] = await Promise.all([
    readVideos(),
    readScriptsByClient(configId),
    getAuditBlockAndDuration(configId),
    readStrategyConfig(),
  ]);
  const auditBlock = auditResult.block;
  const auditPreferredDuration = auditResult.preferredDurationSeconds;
  const configVideos = allVideos.filter(v => v.configName === configName);

  const allContentTypes = [...BUILT_IN_CONTENT_TYPES, ...(strategyJson.customContentTypes || [])];
  const allFormats = [...BUILT_IN_FORMATS, ...(strategyJson.customFormats || [])];

  const postsPerWeek = parseInt(config.postsPerWeek || "5", 10);
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);
  const pillarNames = pillars.map(p => p.name);

  // Week-seeded rotation: same configId + same ISO week → same schedule; different week → different offset
  const seed = weekSeed(configId);
  const weekRng = mulberry32(seed);
  const pillarOffset = pillarNames.length > 0 ? seededInt(weekRng, pillarNames.length) : 0;
  const patternOrder = shuffle(ALL_PATTERN_TYPES, weekRng);

  const ctaOffset = seededInt(weekRng, DEFAULT_CTA_ROTATION.length);
  const weekSchedule = activeDays.map((day, i) => {
    const d = weekly[day];
    const pillarName = pillarNames.length > 0 ? pillarNames[(i + pillarOffset) % pillarNames.length] : "Allgemein";
    const defaultCta = DEFAULT_CTA_ROTATION[(i + ctaOffset) % DEFAULT_CTA_ROTATION.length];
    return {
      day,
      contentType: d?.type || allContentTypes[i % allContentTypes.length]?.name || "Education / Value",
      format: d?.format || allFormats[i % allFormats.length]?.name || "Face to Camera",
      pillar: pillarName,
      pillarType: pillarTypeMap[pillarName],
      patternType: patternOrder[i % patternOrder.length],
      ctaType: (d?.ctaType as CtaType) || defaultCta.ctaType,
      ctaExample: d?.ctaExample || "",
      funnelStage: (d?.funnelStage as FunnelStage) || defaultCta.funnelStage,
    };
  });

  const pillarBlock = pillars.map(p => {
    const typeTag = p.pillarType ? ` [${p.pillarType}]` : "";
    let line = `- ${p.name}${typeTag}`;
    if (p.offerLink) line += `\n  Funnel-Bezug: ${p.offerLink}`;
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
  const recentScripts = existingScripts.slice(-40);
  const recentTitles = recentScripts.map(s => s.title).filter(Boolean);
  const recentScriptsInfo = recentScripts.map(s => {
    let line = `- ${s.title}`;
    if (s.pillar) line += ` [${s.pillar}]`;
    if (s.hookPattern) line += ` (Muster: ${s.hookPattern})`;
    if (s.hook) line += `\n  Hook: "${s.hook.slice(0, 120)}"`;
    return line;
  }).filter(Boolean);
  const recentBlock = recentScriptsInfo.length > 0
    ? `\n⚠️ BEREITS GESCHRIEBEN — DIESE THEMEN, HOOKS UND WINKEL SIND GESPERRT. Wähle komplett andere Themen und Perspektiven:\n${recentScriptsInfo.join("\n")}`
    : "";

  // Anchor candidates (winners) — basis for "core" and "variant" posts in the 70/20/10 mix
  const anchorCandidates: { title: string; source: string }[] = [
    ...ownTopVideos.slice(0, 8).map(v => ({
      title: (v.topic || v.audioHook || "").slice(0, 120),
      source: `Own viral video (${fmt(v.views)} views)`,
    })).filter(a => a.title),
    ...creatorVideos.slice(0, 4).map(v => {
      const hookMatch = v.analysis?.match(/HOOK[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
      return {
        title: hookMatch ? hookMatch[1].trim().slice(0, 120) : `@${v.creator} viral Reel`,
        source: `Competitor winner (${fmt(v.views)} views)`,
      };
    }).filter(a => a.title),
  ];
  const anchorBlock = anchorCandidates.length > 0
    ? `<winner_anchors>\nWinner-Themen für "core"/"variant" Posts (core MUSS einen davon als anchorRef zitieren):\n${anchorCandidates.map((a, i) => `[${i + 1}] "${a.title}" — ${a.source}`).join("\n")}\n</winner_anchors>`
    : "";

  // Hook pattern tracking
  const patternCounts: Record<string, number> = {};
  for (const s of existingScripts) {
    if (s.hookPattern) patternCounts[s.hookPattern] = (patternCounts[s.hookPattern] || 0) + 1;
  }
  const usedPatternsBlock = Object.keys(patternCounts).length > 0
    ? Object.entries(patternCounts).sort((a, b) => b[1] - a[1]).map(([p, c]) => `- ${p} (${c}× verwendet)`).join("\n")
    : "";

  // Duration — audit wins over viral-average. Audit pref is treated as a HARD ceiling.
  const allDurations = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];
  const viralAvgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;
  const avgDuration = auditPreferredDuration ?? viralAvgDuration;
  const durationIsAuditOverride = auditPreferredDuration !== null;

  return {
    config, clientName, lang: (config.language === "en" ? "en" : "de"),
    clientContext, brandContext, platformContext, primaryPlatform,
    pillars, pillarNames, pillarBlock, pillarTypeMap, weekSchedule, activeDays, postsPerWeek, weekRng,
    allContentTypes, allFormats,
    auditBlock, ownPerformanceBlock, competitorHooksBlock, crossNicheBlock, ownTopVideos,
    recentBlock, usedPatternsBlock, recentTitles, anchorCandidates, anchorBlock,
    avgDuration,
    maxWords: avgDuration > 0 ? Math.round(avgDuration * 2) : 0,
    durationIsAuditOverride,
  };
}

// ── Step 2: Load Voice Profiles ───────────────────────────────────────────

export async function loadVoiceProfiles(configId: string, clientName?: string, lang: "de" | "en" = "de"): Promise<VoiceContext> {
  // Resolve clientName lazily if not provided (allows parallel loading with context)
  const getName = async () => {
    if (clientName) return clientName;
    const cfg = await readConfig(configId);
    return cfg?.configName || cfg?.name || "Client";
  };

  const [voiceResult, structureResult, onboardingResult] = await Promise.allSettled([
    getVoiceProfile(configId).then(async (p) => p || await generateVoiceProfile(configId, await getName(), lang)),
    getScriptStructure(configId).then(async (s) => s || await generateScriptStructure(configId, await getName(), lang)),
    voiceOnboardingToPromptBlock(configId, lang),
  ]);

  const voiceProfile: VoiceProfile | null = voiceResult.status === "fulfilled" ? voiceResult.value : null;
  const scriptStructure: ScriptStructureProfile | null = structureResult.status === "fulfilled" ? structureResult.value : null;
  const voiceOnboardingBlock = onboardingResult.status === "fulfilled" ? onboardingResult.value : "";

  return {
    voiceProfile,
    scriptStructure,
    voiceBlock: voiceProfile ? voiceProfileToPromptBlock(voiceProfile, clientName ?? "Client") : "",
    structureBlock: scriptStructure ? scriptStructureToPromptBlock(scriptStructure) : "",
    voiceToneBlock: voiceProfile
      ? `\nSTIMMPROFIL:\nTon: ${voiceProfile.tone}\nEnergie: ${voiceProfile.energy}\nLieblingswörter: ${voiceProfile.favoriteWords.slice(0, 5).join(", ")}`
      : "",
    structureHookBlock: scriptStructure
      ? `\nSKRIPT-STRUKTUR HOOK-MUSTER (aus Training gelernt — bevorzuge diese):\n${scriptStructure.hookPatterns.map(h => `- ${h.pattern}: "${h.example}"`).join("\n")}`
      : "",
    voiceOnboardingBlock,
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
  rng?: () => number,
  lang: "de" | "en" = "de",
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
  const customerProblems = safeJsonParse<{
    mental?: string; emotional?: string; practical?: string; financial?: string; social?: string;
  }>(config.customerProblems, {});
  const deepCtx: DeepTrendContext = {
    niche: config.creatorsCategory || "Social Media",
    pillars: pillars.map(p => p.name).slice(0, 5),
    customerProblems: [customerProblems.mental, customerProblems.emotional, customerProblems.practical].filter(Boolean).join(". "),
    customerProblemsByDim: {
      mental: customerProblems.mental,
      emotional: customerProblems.emotional,
      practical: customerProblems.practical,
      financial: customerProblems.financial,
      social: customerProblems.social,
    },
    brandProblem: config.brandProblem || undefined,
    businessContext: config.businessContext || undefined,
    coreOffer: config.coreOffer || undefined,
  };

  // Deep search: 15-20 targeted queries across 9 categories (~2s parallel)
  // Week-rng rotates sub-angles/pillar order so each week surfaces different results
  try {
    const deepResults = await searchTrendsDeep(deepCtx, { rng });
    const totalResults = deepResults.reduce((sum, r) => sum + r.results.length, 0);
    const distinctCategories = countDistinctCategoriesWithResults(deepResults);
    if (totalResults > 0 && distinctCategories >= 3) {
      webTrendContext = formatDeepTrendResults(deepResults);
    } else if (totalResults > 0) {
      // Categories too concentrated — still use, but log for monitoring
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
    }, lang);

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
        const result = tu.input as {
          trends: Array<{ topic: string; angle: string; whyNow: string; hookIdea: string; sourceUrls: string[]; category: string }>;
          categoryMix?: { distinctCategoriesUsed?: number };
        };
        const usedCats = new Set(result.trends.map(t => t.category)).size;
        // Require >= 3 distinct categories — else log but still use
        if (usedCats >= 3 || result.trends.length < 6) {
          trendBlock = `<trending_topics>\nAktuelle Trends basierend auf echten Suchdaten (JEDES Thema muss auf einem dieser Trends basieren):\n${result.trends.map((t, i) => `${i + 1}. ${t.topic} — ${t.angle}\n   Warum jetzt: ${t.whyNow}\n   Hook-Idee: "${t.hookIdea}"\n   Kategorie: ${t.category}\n   Quellen: ${t.sourceUrls.join(", ")}`).join("\n\n")}\n</trending_topics>`;
        } else {
          // Single-category dump detected — use anyway but flag for prompt (topic-selection sees the diversity warning)
          trendBlock = `<trending_topics>\n⚠️ HINWEIS: Trends kommen fast alle aus Kategorie "${[...new Set(result.trends.map(t => t.category))].join(", ")}". Zwinge dich bei der Topic-Auswahl zu mehr Winkel-Vielfalt.\n\n${result.trends.map((t, i) => `${i + 1}. ${t.topic} — ${t.angle}\n   Warum jetzt: ${t.whyNow}\n   Hook-Idee: "${t.hookIdea}"\n   Kategorie: ${t.category}\n   Quellen: ${t.sourceUrls.join(", ")}`).join("\n\n")}\n</trending_topics>`;
        }
      }
    }
  } catch { /* Trend synthesis failed */ }

  return { trendBlock, learningsBlock, learnings, hasTrendSnapshot: !!trendSnapshot };
}

// ── Step 3: Topic Selection ───────────────────────────────────────────────

function normalizeTopics(topics: TopicResult[], ctx: PipelineContext): TopicResult[] {
  return topics.map((t, i) => ({
    ...t,
    day: ctx.weekSchedule[i]?.day || t.day,
    pillar: t.pillar || ctx.weekSchedule[i]?.pillar || "",
    contentType: t.contentType || ctx.weekSchedule[i]?.contentType || "",
    format: t.format || ctx.weekSchedule[i]?.format || "",
    patternType: ctx.weekSchedule[i]?.patternType || t.patternType,
    postType: t.postType || "test",
    anchorRef: t.anchorRef || "",
  }));
}

function countPostTypes(topics: TopicResult[]): { core: number; variant: number; test: number } {
  return topics.reduce((acc, t) => {
    acc[t.postType] = (acc[t.postType] || 0) + 1;
    return acc;
  }, { core: 0, variant: 0, test: 0 });
}

function buildTopicUserPrompt(ctx: PipelineContext, research: ResearchContext, extraFeedback = ""): string {
  const expected = expectedPostTypeCounts(ctx.activeDays.length);
  const availableTypes = [...new Set(Object.values(ctx.pillarTypeMap).filter(Boolean))] as PillarType[];
  const requiredTypes = (["RESULT", "PROOF", "MECHANISM", "BELIEFS"] as PillarType[]).filter(t => availableTypes.includes(t));
  const typeMixBlock = availableTypes.length > 0 && ctx.activeDays.length >= 4
    ? `<pillar_type_mix>
ZWINGENDE PILLAR-TYPEN-VIELFALT pro Woche:
Verfügbare Typen in dieser Strategie: ${availableTypes.join(", ")}.
Die ${ctx.activeDays.length} gewählten Themen MÜSSEN mindestens je 1× diese Typen abdecken (sofern verfügbar): ${requiredTypes.join(", ")}.
- RESULT = Traumergebnis / Vision
- PROOF = Cases, Zahlen, Vorher-Nachher
- MECHANISM = System, Methode, Framework
- BELIEFS = Glaubenssatz brechen, Anti-Pattern aufdecken
- IDENTITY = Persönlichkeit, Gründer-Story

Der pillarType pro Tag ergibt sich aus dem zugeordneten Pillar im Wochenplan — du musst sicherstellen dass die Pillar-Auswahl über die Woche diese Typ-Vielfalt bietet.
</pillar_type_mix>

`
    : "";
  return `${research.trendBlock}

${ctx.recentBlock}

${ctx.anchorBlock}

<performance_signals>
${ctx.ownPerformanceBlock}
${ctx.competitorHooksBlock ? `\nCOMPETITOR-VIDEOS:\n${ctx.competitorHooksBlock}` : ""}
${research.learningsBlock}
${ctx.crossNicheBlock}
</performance_signals>

${ctx.auditBlock}

<strategy_filter>
CONTENT PILLARS (mit pillarType in [KLAMMER] und Funnel-Bezug):
${ctx.pillarBlock}

WOCHENPLAN (${ctx.postsPerWeek}×/Woche) — jeder Tag hat Pillar, pillarType, Pattern, CTA-Typ und Funnel-Stage vorgegeben:
${ctx.weekSchedule.map(s => `${s.day}: Content-Type "${s.contentType}" | Format "${s.format}" | Pillar "${s.pillar}"${s.pillarType ? ` [${s.pillarType}]` : ""} | Pattern "${s.patternType}" | CTA "${s.ctaType}" | Funnel ${s.funnelStage}${s.ctaExample ? ` | Beispiel-CTA: "${s.ctaExample}"` : ""}`).join("\n")}

STORY-PATTERN-DEFINITIONEN (verwende exakt das vorgegebene Pattern pro Tag):
- STORY: Persönliche/Kunden-Story mit Wendepunkt. Ich-Perspektive oder Fallbeispiel.
- HOW_TO: Schritt-für-Schritt-Anleitung. Klares Framework, nummerierte Steps.
- MISTAKES: Fehler aufdecken / Anti-Patterns. "Das ist der Grund warum X nicht funktioniert".
- PROOF: Case-Study, Zahlen, Vorher-Nachher. Belegte Ergebnisse statt Meinung.
- HOT_TAKE: Kontroverse Meinung, Glaubenssatz brechen. Polarisierend, klare Position.
</strategy_filter>

${typeMixBlock}

<post_type_mix_70_20_10>
ZWINGENDE VERTEILUNG der ${ctx.activeDays.length} Themen:
- core: ${expected.core}× — direkte Adaption eines Winner-Anchors (s. <winner_anchors>). anchorRef MUSS einen Anchor-Titel zitieren.
- variant: ${expected.variant}× — NEUER WINKEL auf Winner-Thema (anderer Pain, anderes Format, andere Zielgruppe-Ansprache). anchorRef zitiert den Original-Anchor, Titel muss erkennbar anders sein.
- test: ${expected.test}× — komplett neue Idee aus aktuellen Trends/Learnings, KEIN Anchor. anchorRef ist leer.

Regel: Wenn keine Anchor-Winner vorhanden sind, setze alle Posts auf "test". Sonst halte die Quote exakt ein.
</post_type_mix_70_20_10>

<client>
${ctx.clientContext}
Nische: ${ctx.config.creatorsCategory || ""}
</client>

AUFTRAG: Wähle ${ctx.activeDays.length} Themen für diese Woche. JEDES Thema muss auf einem der Trends oben basieren. Adaptiere die besten Trends für diesen Client und ordne jedem den passendsten Pillar zu. Der Pillar ist der FILTER, nicht die Quelle der Idee. Gib im trendRef Feld an welcher Trend die Basis war. Halte die core/variant/test-Quote exakt ein.

GESPERRTE THEMEN: Alles in der Blacklist oben ist TABU — keine Wiederholungen, auch nicht in Abwandlung.${extraFeedback ? `\n\n${extraFeedback}` : ""}`;
}

async function runTopicSelectionCall(
  ctx: PipelineContext,
  research: ResearchContext,
  claude: Anthropic,
  extraFeedback = "",
): Promise<TopicResult[]> {
  const topicSystemPrompt = buildPrompt("topic-selection", {
    num_days: String(ctx.activeDays.length),
    platform_context: ctx.platformContext,
  }, ctx.lang);
  const topicTool = TOPIC_SELECTION_TOOL(
    ctx.activeDays, ctx.pillarNames,
    ctx.allContentTypes.map(t => t.name), ctx.allFormats.map(f => f.name),
  );

  const msg = await claude.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 2500, temperature: 1,
    system: topicSystemPrompt, tools: [topicTool],
    tool_choice: { type: "tool", name: "submit_topics" },
    messages: [{ role: "user", content: buildTopicUserPrompt(ctx, research, extraFeedback) }],
  });

  const tu = msg.content.find(b => b.type === "tool_use");
  if (!tu || tu.type !== "tool_use") throw new Error("KI konnte keine Themen auswählen.");

  const result = tu.input as { topics: TopicResult[] };
  return normalizeTopics(result.topics, ctx);
}

export async function selectTopics(
  ctx: PipelineContext,
  research: ResearchContext,
  claude: Anthropic,
): Promise<TopicResult[]> {
  let topics = await runTopicSelectionCall(ctx, research, claude);

  // Validate: post-type quota + semantic duplicates
  const feedback: string[] = [];
  const expected = expectedPostTypeCounts(ctx.activeDays.length);
  const hasAnchors = ctx.anchorCandidates.length > 0;

  if (hasAnchors) {
    const counts = countPostTypes(topics);
    const quotaOk =
      Math.abs(counts.core - expected.core) <= 1 &&
      Math.abs(counts.variant - expected.variant) <= 1 &&
      Math.abs(counts.test - expected.test) <= 1;
    if (!quotaOk) {
      feedback.push(
        `QUOTA-VERLETZUNG beim letzten Versuch: du hast ${counts.core}× core / ${counts.variant}× variant / ${counts.test}× test geliefert. SOLL: ${expected.core}/${expected.variant}/${expected.test}. Korrigiere die postType-Zuordnung.`
      );
    }
  }

  // Title specificity check — reject generic "Stanni" titles
  const specIssues: string[] = [];
  topics.forEach((t, i) => {
    const check = checkTitleSpecificity(t.title);
    if (!check.ok) {
      specIssues.push(`- Position ${i + 1} ("${t.title}"): ${check.reason}. NEU schreiben mit konkreter Zahl, benanntem Tool/Person ODER Contrarian-These.`);
    }
  });
  if (specIssues.length > 0) {
    feedback.push(`SPEZIFITÄTS-VERLETZUNG (Titel zu generisch):\n${specIssues.join("\n")}`);
  }

  // Semantic dup check — prefer pgvector-backed DB lookup, fall back to in-memory
  if (ctx.recentTitles.length > 0) {
    try {
      let dupes: Awaited<ReturnType<typeof findDuplicateTitles>> = [];
      // DB path: queries all scripts for this client via match_script_titles.
      const dbDupes = await findDuplicatesByDB(ctx.config.id, topics.map(t => t.title), 0.85);
      if (dbDupes.length > 0) {
        dupes = dbDupes;
      } else {
        // Either no matches or DB path unavailable — check in-memory against the last 40 titles
        dupes = await findDuplicateTitles(topics.map(t => t.title), ctx.recentTitles, 0.85);
      }
      if (dupes.length > 0) {
        const lines = dupes.map(d =>
          `- Position ${d.index + 1} ("${topics[d.index].title}") ist ${(d.similarity * 100).toFixed(0)}% ähnlich zu bestehendem Titel "${d.matchedTitle}". ERSETZEN.`
        );
        feedback.push(`SEMANTISCHE DUPLIKATE gefunden:\n${lines.join("\n")}`);
      }
    } catch { /* embeddings failed — skip dup check */ }
  }

  if (feedback.length > 0) {
    const extraFeedback = `⚠️ KORREKTUR-RUNDE:\n${feedback.join("\n\n")}\n\nGenerier die ${ctx.activeDays.length} Themen neu. Halte Quoten exakt ein und vermeide Duplikate.`;
    try {
      topics = await runTopicSelectionCall(ctx, research, claude, extraFeedback);
    } catch { /* keep first attempt if retry fails */ }
  }

  return topics;
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
    const patternGuide: Record<PatternType, string> = {
      STORY: "Hook öffnet eine Story oder einen Moment. Ich-Perspektive oder Kunden-Szene. Keine These, keine Frage.",
      HOW_TO: "Hook verspricht konkretes Resultat + Methode in 1 Satz. 'So …' / 'In 3 Schritten …'",
      MISTAKES: "Hook benennt einen Fehler oder ein Anti-Pattern. 'Hör auf mit …' / 'Der Grund warum X nicht funktioniert'.",
      PROOF: "Hook mit Zahl/Ergebnis/Zeitraum. 'Von X auf Y in Z Wochen' / 'Was wir mit 1 Kunde erreicht haben'.",
      HOT_TAKE: "Hook polarisiert. 'Unpopuläre Meinung' / 'Warum X Quatsch ist'. Klare Position, kein Hedging.",
    };
    const userPrompt = `THEMA: ${topic.title}\nBESCHREIBUNG: ${topic.description}\nContent-Type: ${topic.contentType} | Format: ${topic.format}\nSTORY-PATTERN (zwingend): ${topic.patternType} — ${patternGuide[topic.patternType] || ""}\n\n${ctx.competitorHooksBlock ? `COMPETITOR-HOOKS (was in der Nische funktioniert):\n${ctx.competitorHooksBlock}` : ""}${ctx.usedPatternsBlock ? `\nBEREITS VERWENDETE HOOK-MUSTER (vermeide Wiederholung, wähle ANDERE):\n${ctx.usedPatternsBlock}` : ""}${voice.structureHookBlock}${voice.voiceToneBlock}\n\nErstelle 3 Hook-Optionen die zum STORY-PATTERN oben passen. Nutze Hook-Muster die NOCH NICHT oft verwendet wurden.`;

    try {
      const msg = await claude.messages.create({
        model: "claude-sonnet-4-6", max_tokens: 500, temperature: 1,
        system: buildPrompt("hook-generation", { platform_context: ctx.platformContext }, ctx.lang),
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
    ? ctx.durationIsAuditOverride
      ? `- LÄNGE (HARDCODED AUS AUDIT): STRIKT max ${ctx.avgDuration} Sekunden Sprechzeit = max ${ctx.maxWords} Wörter gesamt (Hook+Body+CTA zusammen). Diese Vorgabe kommt direkt aus dem Audit und ist NICHT VERHANDELBAR. Überziehen ist ein Fehler — eher 10% kürzer liefern.`
      : `- LÄNGE: Max ${ctx.maxWords} Wörter gesamt (Hook+Body+CTA). Das entspricht ca. ${durationLabel} Sprechzeit. Kürzer ist besser.`
    : `- LÄNGE: Kurze Video-Formate. Max 30-60 Sekunden Sprechzeit. Prägnant.`;

  const bodySystemPrompt = buildPrompt("body-writing", {
    laenge_regeln: laengeRegeln, stimm_matching: "", skript_struktur: "", skript_beispiele: "",
    platform_context: ctx.platformContext,
  }, ctx.lang);

  const ctaGuide: Record<CtaType, string> = {
    soft: "Soft-CTA: Kommentar-Frage, Save, Share oder Interaktion. KEIN Verkauf. Beispiel: 'Welcher Punkt trifft dich am meisten? Schreib's in die Kommentare.'",
    lead: "Lead-CTA: DM-Keyword, Call buchen, Webinar-Anmeldung, Link in Bio. Konkret und zum Core Offer führend. Beispiel: 'Schreib \"PLAN\" in die DMs, ich schick dir den 4-Schritte-Fahrplan.'",
    authority: "Authority-CTA: Kein direkter Handlungsaufruf, stattdessen Status-/Positions-Signal wie 'So arbeite ich mit meinen Programm-Kundinnen' oder 'Das ist genau was wir in Woche 3 machen'.",
    none: "KEIN CTA. Der Body endet mit einem starken letzten Satz. Setze cta-Feld auf einen leeren String oder einen einzelnen Abschluss-Punkt.",
  };
  const promises = topics.map(async (topic, idx) => {
    const dayInfo = ctx.weekSchedule[idx];
    const ctaType = dayInfo?.ctaType || "soft";
    const funnelStage = dayInfo?.funnelStage || "MOF";
    const coreOffer = ctx.config.coreOffer ? `\nCORE OFFER: ${ctx.config.coreOffer}` : "";
    const onboardingBlock = voice.voiceOnboardingBlock ? `${voice.voiceOnboardingBlock}\n\n` : "";
    const userPrompt = `<client>\n${ctx.clientContext}\n${ctx.brandContext}${coreOffer}\n</client>\n\n${onboardingBlock}${voice.voiceBlock}\n\n${voice.structureBlock}\n\nTHEMA: ${topic.title}\nBESCHREIBUNG: ${topic.description}\nHOOK (bereits fertig): "${hooks[idx].hook}"\nFUNNEL-STAGE: ${funnelStage} (${funnelStage === "TOF" ? "kalte Zuschauer — Reach" : funnelStage === "MOF" ? "warme Zuschauer — Trust/Education" : "heiße Zuschauer — Entscheidung, Offer-Berührung"})\nCTA-TYP: ${ctaType}\nCTA-ANLEITUNG: ${ctaGuide[ctaType]}\n\nSchreibe jetzt Body und CTA. Der Hook steht — baue darauf auf. Folge den Strukturmustern aus dem Skript-Aufbau-Profil. Der CTA MUSS exakt zum vorgegebenen ctaType passen.`;

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
  lengthConstraint?: { maxWords: number; maxSeconds: number; fromAudit: boolean },
  lang: "de" | "en" = "de",
): Promise<{ finalScripts: AssembledScript[]; issues: string[] }> {
  const countWords = (s: AssembledScript) => [s.hook, s.body, s.cta].filter(Boolean).join(" ").split(/\s+/).filter(Boolean).length;
  const lengthBlock = lengthConstraint && lengthConstraint.maxWords > 0
    ? `\n\n⚠️ LÄNGEN-LIMIT${lengthConstraint.fromAudit ? " (AUDIT-STRICT)" : ""}: max ${lengthConstraint.maxWords} Wörter / ${lengthConstraint.maxSeconds}s Sprechzeit pro Skript (Hook+Body+CTA zusammen). Skripte die das überschreiten MÜSSEN gekürzt werden.\n\nAKTUELLE WORT-ZAHLEN:\n${scripts.map((s, i) => `- Skript ${i + 1}: ${countWords(s)} Wörter${countWords(s) > lengthConstraint.maxWords ? " ⚠️ ZU LANG" : ""}`).join("\n")}`
    : "";
  const reviewUserPrompt = `${voice.voiceBlock ? voice.voiceBlock + "\n\n" : ""}${voice.structureBlock ? voice.structureBlock + "\n\n" : ""}${scripts.map((s, i) => `--- SKRIPT ${i + 1} (${s.day}) ---\nPATTERN: ${s.patternType} | POST-TYP: ${s.postType} | CTA-TYP: ${s.ctaType} | FUNNEL: ${s.funnelStage}${s.anchorRef ? `\nANCHOR: ${s.anchorRef}` : ""}\nTITEL: ${s.title}\nHOOK: ${s.hook}\nBODY: ${s.body}\nCTA: ${s.cta}`).join("\n\n")}\n\nWOCHEN-STATISTIK:\n- CTA-Typen: ${Object.entries(scripts.reduce<Record<string, number>>((a, s) => { a[s.ctaType] = (a[s.ctaType] || 0) + 1; return a; }, {})).map(([k, v]) => `${v}× ${k}`).join(", ")}\n- Funnel-Stages: ${Object.entries(scripts.reduce<Record<string, number>>((a, s) => { a[s.funnelStage] = (a[s.funnelStage] || 0) + 1; return a; }, {})).map(([k, v]) => `${v}× ${k}`).join(", ")}\n- Post-Types: ${Object.entries(scripts.reduce<Record<string, number>>((a, s) => { a[s.postType] = (a[s.postType] || 0) + 1; return a; }, {})).map(([k, v]) => `${v}× ${k}`).join(", ")}${lengthBlock}\n\nPrüfe alle ${scripts.length} Skripte inkl. CTA/Funnel-Alignment${lengthConstraint?.fromAudit ? " UND Längen-Limit" : ""}.`;

  const finalScripts = [...scripts];
  const issues: string[] = [];

  try {
    const reviewPromise = claude.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 4000,
      system: buildPrompt("quality-review", { platform_context: platformContext }, lang),
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
