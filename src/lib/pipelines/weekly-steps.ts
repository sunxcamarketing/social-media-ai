// ── Weekly Script Pipeline — Extracted Steps ──────────────────────────────
// Each step has a clear input/output interface and can be tested independently.

import Anthropic from "@anthropic-ai/sdk";
import { readConfig, readVideos, readScriptsByClient, readStrategyConfig } from "@/lib/csv";
import { getAuditBlockAndDuration } from "@/lib/audit";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import { buildPrompt, TREND_RESEARCH_TOOL } from "@prompts";
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
import { fmt } from "@/lib/format";
import { parseInsights, videoInsightBlock } from "@/lib/performance-helpers";
import type { VideoInsight } from "@/lib/performance-helpers";
import type { VoiceProfile, ScriptStructureProfile, Config, Pillar, PillarType } from "@/lib/types";
import { normalizePillarType } from "@/lib/types";
import { weekSeed, mulberry32, seededInt, shuffle, ALL_PATTERN_TYPES, type PatternType } from "@/lib/week-seed";

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
