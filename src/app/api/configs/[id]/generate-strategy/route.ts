import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, writeConfigs, readVideos, readAnalyses, readStrategyConfig } from "@/lib/csv";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS, type ContentType, type ContentFormat } from "@/lib/strategy";
import { STRATEGY_ANALYSIS_SYSTEM, STRATEGY_ANALYSIS_TOOL } from "@/lib/prompts/strategy-analysis";
import { strategyCreationSystemPrompt, STRATEGY_CREATION_TOOL } from "@/lib/prompts/strategy-creation";
import { STRATEGY_REVIEW_SYSTEM, STRATEGY_REVIEW_TOOL } from "@/lib/prompts/strategy-review";
import { getVoiceProfile, voiceProfileToPromptBlock } from "@/lib/voice-profile";
import type { VoiceProfile } from "@/lib/types";
import type { PerformanceInsights, VideoInsight } from "../performance/route";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// ── SSE helper ──────────────────────────────────────────────────────────────

function sendEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

// ── Data loading helpers (NO truncation) ────────────────────────────────────

function buildClientContext(config: Record<string, string>): string {
  const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();
  const customerProblems = (() => { try { return JSON.parse(config.customerProblems || "{}"); } catch { return {}; } })();

  return [
    config.name && `Name: ${config.name}`,
    config.role && `Rolle: ${config.role}`,
    config.company && `Unternehmen: ${config.company}`,
    config.creatorsCategory && `Nische: ${config.creatorsCategory}`,
    config.businessContext && `Business-Kontext: ${config.businessContext}`,
    config.professionalBackground && `Hintergrund: ${config.professionalBackground}`,
    config.keyAchievements && `Erfolge: ${config.keyAchievements}`,
    config.igBio && `Instagram Bio: ${config.igBio}`,
    config.igFollowers && `Instagram Follower: ${config.igFollowers}`,
    config.igCategory && `Instagram Kategorie: ${config.igCategory}`,
  ].filter(Boolean).join("\n");
}

function buildBrandContext(config: Record<string, string>): string {
  const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();
  const customerProblems = (() => { try { return JSON.parse(config.customerProblems || "{}"); } catch { return {}; } })();

  return [
    config.brandFeeling && `Marken-Gefühl: ${config.brandFeeling}`,
    config.brandProblem && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.humanDifferentiation && `AND-Faktor: ${config.humanDifferentiation}`,
    config.providerRole && `Anbieter-Rolle: ${config.providerRole}`,
    config.providerBeliefs && `Überzeugungen: ${config.providerBeliefs}`,
    config.providerStrengths && `Stärken: ${config.providerStrengths}`,
    config.authenticityZone && `Authentizitätszone: ${config.authenticityZone}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession && `Traumkunde Beruf: ${dreamCustomer.profession}`,
    dreamCustomer.values && `Traumkunde Werte: ${dreamCustomer.values}`,
    customerProblems.mental && `Mentale Probleme: ${customerProblems.mental}`,
    customerProblems.financial && `Finanzielle Probleme: ${customerProblems.financial}`,
    customerProblems.social && `Soziale Probleme: ${customerProblems.social}`,
  ].filter(Boolean).join("\n");
}

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

        const configs = await readConfigs();
        const configIndex = configs.findIndex((c) => c.id === id);
        if (configIndex === -1) {
          sendEvent(controller, { step: "error", message: "Config not found" });
          controller.close();
          return;
        }

        const config = configs[configIndex];
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          sendEvent(controller, { step: "error", message: "ANTHROPIC_API_KEY not set" });
          controller.close();
          return;
        }

        const claude = new Anthropic({ apiKey });
        const clientContext = buildClientContext(config as unknown as Record<string, string>);
        const brandContext = buildBrandContext(config as unknown as Record<string, string>);
        const clientName = config.name || config.configName || "Kunde";

        // Performance data (own top videos)
        let performanceBlock = "";
        try {
          const insights: PerformanceInsights = JSON.parse(config.performanceInsights || "{}");
          if (insights.top30Days || insights.topAllTime) {
            performanceBlock = buildPerformanceBlock(insights);
          }
        } catch { /* no data */ }

        // Audit report — FULL, no truncation
        let auditBlock = "";
        try {
          const analyses = await readAnalyses();
          const latest = analyses
            .filter((a) => a.clientId === id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          if (latest?.report) {
            auditBlock = buildFullAuditBlock(latest.report);
          }
        } catch { /* no data */ }

        // Competitor videos — FULL, no truncation
        let competitorBlock = "";
        try {
          const allVideos = await readVideos();
          const configName = config.configName || config.name || "";
          const competitorVideos = allVideos
            .filter((v) => v.configName === configName && v.analysis)
            .sort((a, b) => b.views - a.views);
          if (competitorVideos.length > 0) {
            competitorBlock = buildFullCompetitorBlock(competitorVideos);
          }
        } catch { /* no data */ }

        // Content types & formats
        let allTypes: ContentType[] = [...BUILT_IN_CONTENT_TYPES];
        let allFormats: ContentFormat[] = [...BUILT_IN_FORMATS];
        try {
          const strategyConfig = await readStrategyConfig();
          if (strategyConfig.customContentTypes?.length) allTypes = [...allTypes, ...strategyConfig.customContentTypes];
          if (strategyConfig.customFormats?.length) allFormats = [...allFormats, ...strategyConfig.customFormats];
        } catch { /* use defaults */ }

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

        const hasData = !!performanceBlock || !!auditBlock || !!competitorBlock;

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

        if (hasData) {
          const analysisUserPrompt = `<client>
${clientContext}
</client>

${auditBlock}

${performanceBlock}

${competitorBlock}

Analysiere ALLE Daten und bestimme das strategische Ziel.`;

          const analysisMsg = await claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 3000,
            system: STRATEGY_ANALYSIS_SYSTEM,
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
            goalReasoning: `Keine Performance-Daten oder Audit vorhanden. Für ${clientName} empfehlen wir als Start-Ziel "reach" um Sichtbarkeit aufzubauen.`,
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

        const creationSystemPrompt = strategyCreationSystemPrompt({
          postsPerWeek,
          activeDays,
          contentTypes: contentTypeNames,
          formats: formatNames,
        });

        const creationTool = STRATEGY_CREATION_TOOL(activeDays, contentTypeNames, formatNames);

        const creationUserPrompt = `STRATEGISCHES ZIEL: ${analysisResult.goal}
BEGRÜNDUNG: ${analysisResult.goalReasoning}

${insightsBlock}

<client_brand>
${brandContext}
</client_brand>

VERFÜGBARE CONTENT TYPES:
${contentTypeList}

VERFÜGBARE FORMATE:
${formatList}

Erstelle 3-5 Content Pillars und einen Wochenplan für ${postsPerWeek}×/Woche (${activeDays.join(", ")}).`;

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

        let creationResult = creationTu.input as {
          pillars: Array<{ name: string; why: string; subTopics: Array<{ title: string; angle: string }> }>;
          weekly: Record<string, { type: string; format: string; pillar: string; reason: string }>;
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

        const reviewUserPrompt = `ZIEL: ${analysisResult.goal} — ${analysisResult.goalReasoning}

PILLARS:
${creationResult.pillars.map((p, i) => {
  const topics = p.subTopics.map(st => `    • ${st.title} (${st.angle})`).join("\n");
  return `${i + 1}. ${p.name} — ${p.why}\n${topics}`;
}).join("\n\n")}

WOCHENPLAN:
${activeDays.map(d => {
  const slot = creationResult.weekly[d];
  return slot ? `${d}: ${slot.type} | ${slot.format} | Pillar: ${slot.pillar} | ${slot.reason}` : `${d}: —`;
}).join("\n")}

${voiceBlock ? `\n${voiceBlock}` : ""}

<client_brand>
${brandContext}
</client_brand>

Prüfe diese Strategie.`;

        let reviewIssues: Array<{ area: string; issue: string; suggestion: string }> = [];
        let overallAssessment = "";

        try {
          const reviewMsg = await claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 3000,
            system: STRATEGY_REVIEW_SYSTEM,
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
            if (review.revisedPillars && review.revisedPillars.length > 0) {
              creationResult.pillars = review.revisedPillars;
            }
            if (review.revisedWeekly && Object.keys(review.revisedWeekly).length > 0) {
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

        configs[configIndex] = {
          ...config,
          strategyGoal: analysisResult.goal || config.strategyGoal,
          strategyPillars: JSON.stringify(storagePillars),
          strategyWeekly: JSON.stringify(weeklyWithReasoning),
        };
        await writeConfigs(configs);

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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
