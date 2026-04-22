import { getAnthropicClient } from "@/lib/anthropic";
import { readConfig, updateConfig, readVideosByConfig, readAnalysesByClient, readStrategyConfig } from "@/lib/csv";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS, type ContentType, type ContentFormat } from "@/lib/strategy";
import { buildPrompt, STRATEGY_ANALYSIS_TOOL, STRATEGY_CREATION_TOOL, STRATEGY_REVIEW_TOOL } from "@prompts";
import { getVoiceProfile, voiceProfileToPromptBlock } from "@/lib/voice-profile";
import { voiceOnboardingToPromptBlock } from "@/lib/voice-onboarding";
import { sendEvent, sseResponse } from "@/lib/sse";
import { safeJsonParse } from "@/lib/safe-json";
import { buildClientProfile, buildBrandContext } from "@/lib/client-context";
import type { VoiceProfile } from "@/lib/types";
import type { PerformanceInsights, VideoInsight } from "@/lib/performance-helpers";
import { buildPlatformContext, parseTargetPlatforms, DEFAULT_PLATFORM } from "@/lib/platforms";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// ── Data loading helpers (NO truncation) ────────────────────────────────────

function buildPerformanceBlock(insights: PerformanceInsights): string {
  const formatVideo = (v: VideoInsight, i: number) => [
    `  Video ${i + 1}: ${v.url}`,
    `  Views: ${v.views.toLocaleString()} | Likes: ${v.likes.toLocaleString()} | Posted: ${v.datePosted}`,
    v.durationSeconds && `  Dauer: ${v.durationSeconds}s`,
    v.topic && `  Thema: ${v.topic}`,
    v.audioHook && `  Audio Hook: "${v.audioHook}"`,
    v.textHook && `  Text Hook: "${v.textHook}"`,
    v.scriptSummary && `  Script: ${v.scriptSummary}`,
    v.whyItWorked && `  Warum erfolgreich: ${v.whyItWorked}`,
    v.howToReplicate && `  Wie replizieren: ${v.howToReplicate}`,
  ].filter(Boolean).join("\n");

  const sections: string[] = [];
  if (insights.top30Days?.length > 0) {
    sections.push(`TOP VIDEOS (Letzte 30 Tage):\n${insights.top30Days.map(formatVideo).join("\n\n")}`);
  }
  if (insights.topAllTime?.length > 0) {
    sections.push(`TOP VIDEOS (Gesamtzeitraum):\n${insights.topAllTime.map(formatVideo).join("\n\n")}`);
  }
  return sections.length > 0 ? `<performance_data>\n${sections.join("\n\n")}\n</performance_data>` : "";
}

function buildFullAuditBlock(report: string): string {
  if (!report) return "";
  // NO truncation — Step 1 reads the full report
  return `<audit_report>\n${report}\n</audit_report>`;
}

function buildFullCompetitorBlock(videos: { creator: string; views: number; likes: number; analysis: string; link: string; durationSeconds?: number }[]): string {
  if (videos.length === 0) return "";
  // NO truncation — full analysis per video
  const formatted = videos.slice(0, 15).map((v, i) => [
    `  ${i + 1}. @${v.creator} — ${v.views.toLocaleString()} Views, ${v.likes.toLocaleString()} Likes`,
    v.durationSeconds && `  Dauer: ${v.durationSeconds}s`,
    `  Link: ${v.link}`,
    v.analysis && `  Analyse: ${v.analysis}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  return `<competitor_data>\nTOP COMPETITOR VIDEOS (sortiert nach Views):\n\n${formatted}\n</competitor_data>`;
}

// ── Language-aware prompt helpers ──────────────────────────────────────────
// All user prompts carry a strong language directive at the top so Claude
// doesn't drift to German just because the tool-schema descriptions are in
// German. The directive is the first thing the model sees — it overrides any
// linguistic cues from the schema.

function languageDirective(lang: "de" | "en"): string {
  return lang === "en"
    ? "LANGUAGE — CRITICAL: Every string you return via the tool (pillar names, why, subTopics titles/angles, ctaExample, reason, goal, goalReasoning, hooks, assessment, issues) MUST be in ENGLISH. Ignore any German phrasing in the schema descriptions — they are meta-instructions, not output-language signals."
    : "SPRACHE — WICHTIG: Alle Strings die du über das Tool zurückgibst (Pillar-Namen, why, subTopics Titel/angle, ctaExample, reason, goal, goalReasoning, Hooks, Assessment, Issues) MÜSSEN auf DEUTSCH sein.";
}

type UserLabels = {
  analyzeInstruction: string;
  strategicGoal: string;
  reasoning: string;
  createInstruction: (posts: number, days: string) => string;
  availableContentTypes: string;
  availableFormats: string;
  goalLabel: string;
  pillarsLabel: string;
  reviewInstruction: string;
};

function userLabels(lang: "de" | "en"): UserLabels {
  return lang === "en"
    ? {
        analyzeInstruction: "Analyze ALL the data and determine the strategic goal.",
        strategicGoal: "STRATEGIC GOAL",
        reasoning: "REASONING",
        createInstruction: (posts, days) => `Create 3-5 content pillars and a weekly plan for ${posts}×/week (${days}).`,
        availableContentTypes: "AVAILABLE CONTENT TYPES:",
        availableFormats: "AVAILABLE FORMATS:",
        goalLabel: "GOAL",
        pillarsLabel: "PILLARS",
        reviewInstruction: "Review this strategy.",
      }
    : {
        analyzeInstruction: "Analysiere ALLE Daten und bestimme das strategische Ziel.",
        strategicGoal: "STRATEGISCHES ZIEL",
        reasoning: "BEGRÜNDUNG",
        createInstruction: (posts, days) => `Erstelle 3-5 Content Pillars und einen Wochenplan für ${posts}×/Woche (${days}).`,
        availableContentTypes: "VERFÜGBARE CONTENT TYPES:",
        availableFormats: "VERFÜGBARE FORMATE:",
        goalLabel: "ZIEL",
        pillarsLabel: "PILLARS",
        reviewInstruction: "Prüfe diese Strategie.",
      };
}

// ── Main endpoint — Multi-Step SSE Pipeline ─────────────────────────────────

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ════════════════════════════════════════════════════════════════════
        // STEP 0: LOAD CONTEXT
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "context", status: "loading" });

        const config = await readConfig(id);
        if (!config) {
          sendEvent(controller, { step: "error", message: "Config not found" });
          controller.close();
          return;
        }

        const claude = getAnthropicClient();
        const lang: "de" | "en" = config.language === "en" ? "en" : "de";
        const clientContext = buildClientProfile(config as unknown as Record<string, string>);
        const brandContext = buildBrandContext(config as unknown as Record<string, string>);
        const clientName = config.name || config.configName || "Kunde";

        // Performance data (own top videos)
        let performanceBlock = "";
        try {
          const insights: PerformanceInsights = safeJsonParse(config.performanceInsights);
          if (insights.top30Days || insights.topAllTime) {
            performanceBlock = buildPerformanceBlock(insights);
          }
        } catch { /* no data */ }

        // Parallel DB reads — all independent after config is loaded
        const configName = config.configName || config.name || "";
        const [analyses, configVideos, strategyConfig] = await Promise.all([
          readAnalysesByClient(id).catch(() => []),
          readVideosByConfig(configName).catch(() => []),
          readStrategyConfig().catch(() => ({ customContentTypes: [], customFormats: [] })),
        ]);

        // Audit report — FULL, no truncation
        let auditBlock = "";
        try {
          const latest = analyses
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          if (latest?.report) {
            auditBlock = buildFullAuditBlock(latest.report);
          }
        } catch { /* no data */ }

        // Competitor videos — FULL, no truncation
        let competitorBlock = "";
        try {
          const competitorVideos = configVideos
            .filter((v) => v.analysis)
            .sort((a, b) => b.views - a.views);
          if (competitorVideos.length > 0) {
            competitorBlock = buildFullCompetitorBlock(competitorVideos);
          }
        } catch { /* no data */ }

        // Content types & formats
        let allTypes: ContentType[] = [...BUILT_IN_CONTENT_TYPES];
        let allFormats: ContentFormat[] = [...BUILT_IN_FORMATS];
        if (strategyConfig.customContentTypes?.length) allTypes = [...allTypes, ...strategyConfig.customContentTypes];
        if (strategyConfig.customFormats?.length) allFormats = [...allFormats, ...strategyConfig.customFormats];

        const contentTypeNames = allTypes.map(t => t.name);
        const formatNames = allFormats.map(f => f.name);
        const contentTypeList = allTypes.map(t => `- ${t.name}: ${t.goal} (best for: ${t.bestFor})`).join("\n");
        const formatList = allFormats.map(f => `- ${f.name}: ${f.description} (${f.platform})`).join("\n");

        // Schedule
        const postsPerWeek = Math.min(7, Math.max(1, parseInt(config.postsPerWeek || "5", 10)));
        const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const activeDays = ALL_DAYS.slice(0, postsPerWeek);

        // Voice profile
        const voiceProfile: VoiceProfile | null = await getVoiceProfile(id).catch(() => null);
        const langForPrompts: "de" | "en" = config.language === "en" ? "en" : "de";
        const voiceOnboardingBlock = await voiceOnboardingToPromptBlock(id, langForPrompts).catch(() => "");

        const hasData = !!performanceBlock || !!auditBlock || !!competitorBlock;

        // Platform context
        const platforms = parseTargetPlatforms(config.targetPlatforms);
        const primaryPlatform = platforms[0] || DEFAULT_PLATFORM;
        const platformContext = buildPlatformContext(primaryPlatform);

        sendEvent(controller, { step: "context", status: "done" });

        // ════════════════════════════════════════════════════════════════════
        // STEP 1: DATA ANALYSIS + GOAL (1 Claude call)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "analysis", status: "loading" });

        let analysisResult: {
          insights: Array<{ category: string; insight: string; dataPoint: string; implication: string }>;
          topPerformingFormats: string[];
          topPerformingTypes: string[];
          avgViralDuration: number | null;
          nichePatterns: string;
          goal: string;
          goalReasoning: string;
        };

        const labels = userLabels(lang);
        const langHeader = languageDirective(lang);

        if (hasData) {
          const analysisUserPrompt = `${langHeader}

<client>
${clientContext}
</client>

${auditBlock}

${performanceBlock}

${competitorBlock}

${labels.analyzeInstruction}`;

          const analysisMsg = await claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 3000,
            system: buildPrompt("strategy-analysis", { platform_context: platformContext }, lang),
            tools: [STRATEGY_ANALYSIS_TOOL],
            tool_choice: { type: "tool", name: "submit_analysis" },
            messages: [{ role: "user", content: analysisUserPrompt }],
          });

          const tu = analysisMsg.content.find(b => b.type === "tool_use");
          if (!tu || tu.type !== "tool_use") {
            sendEvent(controller, { step: "error", message: "KI konnte keine Analyse erstellen." });
            controller.close();
            return;
          }

          analysisResult = tu.input as typeof analysisResult;
        } else {
          // No data available — infer goal from profile
          analysisResult = {
            insights: [],
            topPerformingFormats: [],
            topPerformingTypes: [],
            avgViralDuration: null,
            nichePatterns: "",
            goal: "reach",
            goalReasoning: lang === "en"
              ? `No performance data or audit available. For ${clientName}, we recommend "reach" as a starting goal to build visibility.`
              : `Keine Performance-Daten oder Audit vorhanden. Für ${clientName} empfehlen wir als Start-Ziel "reach" um Sichtbarkeit aufzubauen.`,
          };
        }

        sendEvent(controller, {
          step: "analysis",
          status: "done",
          goal: analysisResult.goal,
          goalReasoning: analysisResult.goalReasoning,
          insightCount: analysisResult.insights.length,
        });

        // ════════════════════════════════════════════════════════════════════
        // STEP 2: STRATEGY CREATION — Pillars + Weekly (1 Claude call)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "strategy", status: "loading" });

        const insightsBlock = analysisResult.insights.length > 0
          ? `<data_insights>
${analysisResult.insights.map(i => `[${i.category.toUpperCase()}] ${i.insight} — Daten: ${i.dataPoint} → ${i.implication}`).join("\n")}

Top-Formate: ${analysisResult.topPerformingFormats.join(", ") || "keine Daten"}
Top-Content-Types: ${analysisResult.topPerformingTypes.join(", ") || "keine Daten"}
${analysisResult.avgViralDuration ? `Ø virale Video-Dauer: ${analysisResult.avgViralDuration}s` : ""}
${analysisResult.nichePatterns ? `Nischen-Muster: ${analysisResult.nichePatterns}` : ""}
</data_insights>`
          : "";

        const creationSystemPrompt = buildPrompt("strategy-creation", {
          posts_per_week: String(postsPerWeek),
          active_days: activeDays.join(", "),
          content_types: contentTypeNames.join(", "),
          formats: formatNames.join(", "),
          platform_context: platformContext,
        }, lang);

        const creationTool = STRATEGY_CREATION_TOOL(activeDays, contentTypeNames, formatNames);

        const creationUserPrompt = `${langHeader}

${labels.strategicGoal}: ${analysisResult.goal}
${labels.reasoning}: ${analysisResult.goalReasoning}

${insightsBlock}

<client_brand>
${brandContext}
</client_brand>

${labels.availableContentTypes}
${contentTypeList}

${labels.availableFormats}
${formatList}

${labels.createInstruction(postsPerWeek, activeDays.join(", "))}`;

        const creationMsg = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: creationSystemPrompt,
          tools: [creationTool],
          tool_choice: { type: "tool", name: "submit_strategy" },
          messages: [{ role: "user", content: creationUserPrompt }],
        });

        const creationTu = creationMsg.content.find(b => b.type === "tool_use");
        if (!creationTu || creationTu.type !== "tool_use") {
          sendEvent(controller, { step: "error", message: "KI konnte keine Strategie erstellen." });
          controller.close();
          return;
        }

        const creationRaw = creationTu.input as {
          pillars?: Array<{ name: string; why: string; subTopics: Array<{ title: string; angle: string }> }>;
          weekly?: Record<string, { type: string; format: string; reason: string }>;
        };
        let creationResult = {
          pillars: creationRaw.pillars || [],
          weekly: creationRaw.weekly || {} as Record<string, { type: string; format: string; reason: string }>,
        };

        sendEvent(controller, {
          step: "strategy",
          status: "done",
          pillarCount: creationResult.pillars.length,
          pillars: creationResult.pillars.map(p => p.name),
        });

        // ════════════════════════════════════════════════════════════════════
        // STEP 3: STRATEGY REVIEW (1 Claude call)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "review", status: "loading" });

        const voiceBlock = voiceProfile ? voiceProfileToPromptBlock(voiceProfile, clientName) : "";

        const reviewUserPrompt = `${langHeader}

${labels.goalLabel}: ${analysisResult.goal} — ${analysisResult.goalReasoning}

${labels.pillarsLabel}:
${creationResult.pillars.map((p, i) => {
  const topics = p.subTopics.map(st => `    • ${st.title} (${st.angle})`).join("\n");
  return `${i + 1}. ${p.name} — ${p.why}\n${topics}`;
}).join("\n\n")}

WOCHENPLAN (Rhythmus ohne Pillar-Bindung):
${activeDays.map(d => {
  const slot = creationResult.weekly[d];
  return slot ? `${d}: ${slot.type} | ${slot.format} | ${slot.reason}` : `${d}: —`;
}).join("\n")}

${voiceBlock ? `\n${voiceBlock}` : ""}
${voiceOnboardingBlock ? `\n${voiceOnboardingBlock}` : ""}

<client_brand>
${brandContext}
</client_brand>

${labels.reviewInstruction}`;

        let reviewIssues: Array<{ area: string; issue: string; suggestion: string }> = [];
        let overallAssessment = "";

        try {
          const reviewMsg = await claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 3000,
            system: buildPrompt("strategy-review", { platform_context: platformContext }, lang),
            tools: [STRATEGY_REVIEW_TOOL(activeDays)],
            tool_choice: { type: "tool", name: "submit_strategy_review" },
            messages: [{ role: "user", content: reviewUserPrompt }],
          });

          const reviewTu = reviewMsg.content.find(b => b.type === "tool_use");
          if (reviewTu && reviewTu.type === "tool_use") {
            const review = reviewTu.input as {
              issues: typeof reviewIssues;
              revisedPillars?: typeof creationResult.pillars | null;
              revisedWeekly?: typeof creationResult.weekly | null;
              overallAssessment: string;
            };

            reviewIssues = review.issues || [];
            overallAssessment = review.overallAssessment || "";

            // Apply revisions if provided
            if (review.revisedPillars && Array.isArray(review.revisedPillars) && review.revisedPillars.length > 0) {
              creationResult.pillars = review.revisedPillars;
            }
            if (review.revisedWeekly && typeof review.revisedWeekly === "object" && Object.keys(review.revisedWeekly).length > 0) {
              creationResult.weekly = review.revisedWeekly;
            }
          }
        } catch {
          // Review failed — use strategy as-is
        }

        sendEvent(controller, {
          step: "review",
          status: "done",
          issueCount: reviewIssues.length,
          issues: reviewIssues.slice(0, 10),
          assessment: overallAssessment,
        });

        // ════════════════════════════════════════════════════════════════════
        // STEP 4: SAVE & DONE
        // ════════════════════════════════════════════════════════════════════

        // Convert structured pillars to storage format
        // Keep subTopics as structured array (JSON) for new format
        const storagePillars = creationResult.pillars.map(p => ({
          name: p.name,
          why: p.why,
          subTopics: p.subTopics,
        }));

        const weeklyWithReasoning = {
          ...creationResult.weekly,
          _reasoning: analysisResult.goalReasoning || "",
        };

        await updateConfig(id, {
          strategyGoal: analysisResult.goal || config.strategyGoal,
          strategyPillars: JSON.stringify(storagePillars),
          strategyWeekly: JSON.stringify(weeklyWithReasoning),
        });

        sendEvent(controller, {
          step: "done",
          strategy: {
            goal: analysisResult.goal,
            goalReasoning: analysisResult.goalReasoning,
            pillars: storagePillars,
            weekly: creationResult.weekly,
            insights: analysisResult.insights,
          },
          review: {
            issues: reviewIssues,
            assessment: overallAssessment,
          },
          _meta: {
            hasAudit: !!auditBlock,
            hasPerformance: !!performanceBlock,
            hasCompetitor: !!competitorBlock,
            hasVoiceProfile: !!voiceProfile,
            insightCount: analysisResult.insights.length,
            reviewIssuesCount: reviewIssues.length,
          },
        });

        controller.close();
      } catch (err) {
        sendEvent(controller, {
          step: "error",
          message: err instanceof Error ? err.message : "Unbekannter Fehler",
        });
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
