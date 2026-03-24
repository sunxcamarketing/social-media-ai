import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, readVideos, readScripts, readAnalyses, readStrategyConfig } from "@/lib/csv";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import { topicSelectionSystemPrompt, TOPIC_SELECTION_TOOL } from "@/lib/prompts/topic-selection";
import { trendResearchSystemPrompt, TREND_RESEARCH_TOOL } from "@/lib/prompts/trend-research";
import { HOOK_GENERATION_SYSTEM, HOOK_GENERATION_TOOL } from "@/lib/prompts/hook-generation";
import { bodyWritingSystemPrompt, BODY_WRITING_TOOL } from "@/lib/prompts/body-writing";
import { QUALITY_REVIEW_SYSTEM, QUALITY_REVIEW_TOOL } from "@/lib/prompts/quality-review";
import { getVoiceProfile, generateVoiceProfile, voiceProfileToPromptBlock, getScriptStructure, generateScriptStructure, scriptStructureToPromptBlock } from "@/lib/voice-profile";
import type { VoiceProfile, ScriptStructureProfile } from "@/lib/types";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";

export const maxDuration = 300;

// ── SSE helper ──────────────────────────────────────────────────────────────

function sendEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

// ── Audit report extraction (kept from old version, still used elsewhere) ───

export function extractAuditContext(report: string): {
  profileOverview: string;
  strengths: string;
  improvements: string;
  contentAnalysis: string;
  immediateActions: string;
} {
  const sections: Record<string, string> = {};
  const parts = report.split(/^## /m);
  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const heading = part.slice(0, newlineIdx).trim().toLowerCase();
    const body = part.slice(newlineIdx + 1).trim();
    sections[heading] = body;
  }

  const trim = (s: string, max = 800) => s ? s.slice(0, max) : "";

  return {
    profileOverview: trim(sections["profil-überblick"] || sections["profil-überblick"] || ""),
    strengths: trim(sections["stärken"] || sections["strengths"] || ""),
    improvements: trim(sections["verbesserungspotenzial"] || sections["improvements"] || ""),
    contentAnalysis: trim(sections["content-analyse"] || sections["content analysis"] || "", 1200),
    immediateActions: trim(sections["sofort-maßnahmen"] || sections["sofort-massnahmen"] || sections["immediate actions"] || "", 1000),
  };
}

export async function getAuditBlock(clientId: string): Promise<string> {
  const analyses = (await readAnalyses())
    .filter(a => a.clientId === clientId)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  if (analyses.length === 0) return "";

  const latest = analyses[0];
  const audit = extractAuditContext(latest.report || "");

  const parts: string[] = [];

  if (latest.profileFollowers || latest.profileAvgViews30d) {
    parts.push(`Profil: ${latest.profileFollowers} Follower, ${latest.profileReels30d} Reels/30d, Ø ${latest.profileAvgViews30d} Views`);
  }
  if (audit.profileOverview) parts.push(`ÜBERBLICK:\n${audit.profileOverview}`);
  if (audit.strengths) parts.push(`STÄRKEN:\n${audit.strengths}`);
  if (audit.improvements) parts.push(`VERBESSERUNGSPOTENZIAL:\n${audit.improvements}`);
  if (audit.contentAnalysis) parts.push(`CONTENT-ANALYSE (was funktioniert vs. was nicht):\n${audit.contentAnalysis}`);
  if (audit.immediateActions) parts.push(`SOFORT-MASSNAHMEN:\n${audit.immediateActions}`);

  return parts.length > 0 ? `<audit_report>\n${parts.join("\n\n")}\n</audit_report>` : "";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseInsights(raw: string): PerformanceInsights | null {
  try { return JSON.parse(raw) || null; } catch { return null; }
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtDuration(s: number): string {
  if (!s) return "?s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
}

function videoInsightBlock(v: VideoInsight, index: number): string {
  return [
    `[${index + 1}] ${fmt(v.views)} Views · ${fmt(v.likes)} Likes · ${v.datePosted}${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""}`,
    v.topic && `Thema: ${v.topic}`,
    v.audioHook && v.audioHook !== "none" && `Audio-Hook: "${v.audioHook}"`,
    v.textHook && v.textHook !== "none" && `Text-Hook: "${v.textHook}"`,
    v.scriptSummary && `Zusammenfassung: ${v.scriptSummary}`,
    v.whyItWorked && `Warum erfolgreich: ${v.whyItWorked}`,
    v.howToReplicate && `Wie replizieren: ${v.howToReplicate}`,
  ].filter(Boolean).join("\n");
}


// ── Main endpoint — Multi-Step SSE Pipeline ─────────────────────────────────

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ════════════════════════════════════════════════════════════════════
        // STEP 1: LOAD CONTEXT
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "context", status: "loading" });

        const configs = await readConfigs();
        const config = configs.find((c) => c.id === id);
        if (!config) {
          sendEvent(controller, { step: "error", message: "Config not found" });
          controller.close();
          return;
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          sendEvent(controller, { step: "error", message: "ANTHROPIC_API_KEY not set" });
          controller.close();
          return;
        }

        const claude = new Anthropic({ apiKey });

        // Client context
        const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();
        const customerProblems = (() => { try { return JSON.parse(config.customerProblems || "{}"); } catch { return {}; } })();

        const clientContext = [
          config.name && `Name: ${config.name}`,
          config.role && `Rolle: ${config.role}`,
          config.company && `Unternehmen: ${config.company}`,
          config.creatorsCategory && `Nische: ${config.creatorsCategory}`,
          config.businessContext && `Business-Kontext: ${config.businessContext}`,
          config.professionalBackground && `Hintergrund: ${config.professionalBackground}`,
        ].filter(Boolean).join("\n");

        const brandContext = [
          config.brandFeeling && `Marken-Gefühl: ${config.brandFeeling}`,
          config.brandProblem && `Kernproblem: ${config.brandProblem}`,
          config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
          config.humanDifferentiation && `Differenzierung: ${config.humanDifferentiation}`,
          config.providerRole && `Anbieter-Rolle: ${config.providerRole}`,
          config.authenticityZone && `Authentizitätszone: ${config.authenticityZone}`,
          dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
          customerProblems.mental && `Mentale Probleme: ${customerProblems.mental}`,
        ].filter(Boolean).join("\n");

        // Strategy
        const pillars: { name: string; subTopics?: string }[] = (() => {
          try { return JSON.parse(config.strategyPillars || "[]") || []; } catch { return []; }
        })();
        const weekly: Record<string, { type: string; format: string }> = (() => {
          try { return JSON.parse(config.strategyWeekly || "{}") || {}; } catch { return {}; }
        })();

        const strategyJson = await readStrategyConfig();
        const allContentTypes = [...BUILT_IN_CONTENT_TYPES, ...(strategyJson.customContentTypes || [])];
        const allFormats = [...BUILT_IN_FORMATS, ...(strategyJson.customFormats || [])];

        const postsPerWeek = parseInt(config.postsPerWeek || "5", 10);
        const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const activeDays = ALL_DAYS.slice(0, postsPerWeek);
        const pillarNames = pillars.map(p => p.name);

        function getPillarForDay(dayIndex: number): string {
          if (pillarNames.length > 0) return pillarNames[dayIndex % pillarNames.length];
          return "Allgemein";
        }

        const weekSchedule = activeDays.map((day, i) => {
          const d = weekly[day];
          return {
            day,
            contentType: d?.type || allContentTypes[i % allContentTypes.length]?.name || "Education / Value",
            format: d?.format || allFormats[i % allFormats.length]?.name || "Face to Camera",
            pillar: getPillarForDay(i),
          };
        });

        const pillarBlock = pillars.map(p => {
          let line = `- ${p.name}`;
          if (Array.isArray(p.subTopics)) {
            line += "\n" + p.subTopics.map((st: { title: string; angle?: string }) =>
              `  • ${st.title}${st.angle ? ` (${st.angle})` : ""}`
            ).join("\n");
          } else if (p.subTopics) {
            line += `\n  Unterthemen: ${p.subTopics}`;
          }
          return line;
        }).join("\n");

        // Audit report
        const auditBlock = await getAuditBlock(id);

        // Performance data
        const insights = parseInsights(config.performanceInsights || "");
        const ownTopVideos: VideoInsight[] = [
          ...(insights?.top30Days || []),
          ...(insights?.topAllTime || []),
        ];

        const allVideos = await readVideos();
        const creatorVideos = allVideos
          .filter(v => v.configName === config.configName && v.views > 0)
          .sort((a, b) => b.views - a.views)
          .slice(0, 6);

        const ownPerformanceBlock = ownTopVideos.length > 0
          ? `<own_top_videos>\n${ownTopVideos.slice(0, 5).map((v, i) => videoInsightBlock(v, i)).join("\n\n")}\n</own_top_videos>`
          : "";

        // Cross-niche inspiration: top videos from OTHER configs
        const crossNicheVideos = allVideos
          .filter(v => v.configName !== config.configName && v.views > 0 && v.analysis)
          .sort((a, b) => b.views - a.views)
          .slice(0, 5);

        const crossNicheBlock = crossNicheVideos.length > 0
          ? `<cross_niche_inspiration>
Virale Videos aus ANDEREN Nischen — Formate und Hooks die du adaptieren kannst:
${crossNicheVideos.map((v, i) => {
              const lines = [`[${i + 1}] @${v.creator} · ${fmt(v.views)} Views · Nische: ${v.configName}`];
              if (v.analysis) {
                const m = v.analysis.match(/HOOK[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
                if (m) lines.push(`Hook: ${m[1].trim().slice(0, 150)}`);
                const f = v.analysis.match(/(?:FORMAT|KONZEPT|CONCEPT)[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
                if (f) lines.push(`Format: ${f[1].trim().slice(0, 150)}`);
              }
              return lines.join("\n");
            }).join("\n\n")}
</cross_niche_inspiration>`
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

        // Existing scripts (avoid repetition) — include ALL with pillar + hook pattern
        const existingScripts = (await readScripts()).filter(s => s.clientId === id);
        const recentScriptsInfo = existingScripts.slice(-40).map(s => {
          const parts = [`- ${s.title}`];
          if (s.pillar) parts[0] += ` [${s.pillar}]`;
          if (s.hookPattern) parts[0] += ` (Hook: ${s.hookPattern})`;
          return parts[0];
        }).filter(Boolean);
        const recentBlock = recentScriptsInfo.length > 0
          ? `\nBEREITS BEHANDELT (vermeide diese Themen UND Winkel):\n${recentScriptsInfo.join("\n")}`
          : "";

        // Hook pattern tracking
        const usedPatterns = existingScripts
          .filter(s => s.hookPattern)
          .map(s => s.hookPattern);
        const patternCounts: Record<string, number> = {};
        for (const p of usedPatterns) {
          patternCounts[p] = (patternCounts[p] || 0) + 1;
        }
        const usedPatternsBlock = Object.keys(patternCounts).length > 0
          ? Object.entries(patternCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([pattern, count]) => `- ${pattern} (${count}× verwendet)`)
              .join("\n")
          : "";

        // Duration info
        const allDurations: number[] = [
          ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
          ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
        ];
        const avgDuration = allDurations.length > 0
          ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
          : 0;
        const maxWords = avgDuration > 0 ? Math.round(avgDuration * 2) : 0;
        const clientName = config.name || config.configName || "Kunde";

        sendEvent(controller, { step: "context", status: "done" });

        // ════════════════════════════════════════════════════════════════════
        // STEP 2: VOICE PROFILE + SCRIPT STRUCTURE
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "voice", status: "loading" });

        // Load both profiles in parallel (cached or generate)
        const [voiceResult, structureResult] = await Promise.allSettled([
          getVoiceProfile(id).then(async (p) => p || await generateVoiceProfile(id, clientName)),
          getScriptStructure(id).then(async (s) => s || await generateScriptStructure(id, clientName)),
        ]);

        const voiceProfile: VoiceProfile | null = voiceResult.status === "fulfilled" ? voiceResult.value : null;
        const scriptStructure: ScriptStructureProfile | null = structureResult.status === "fulfilled" ? structureResult.value : null;

        const voiceBlock = voiceProfile
          ? voiceProfileToPromptBlock(voiceProfile, clientName)
          : "";

        const structureBlock = scriptStructure
          ? scriptStructureToPromptBlock(scriptStructure)
          : "";

        sendEvent(controller, {
          step: "voice",
          status: "done",
          hasVoice: !!voiceProfile,
          hasStructure: !!scriptStructure,
        });

        // ════════════════════════════════════════════════════════════════════
        // STEP 2.5: TREND RESEARCH (1 focused call)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "trends", status: "loading" });

        let trendBlock = "";
        try {
          const trendSystem = trendResearchSystemPrompt(
            config.creatorsCategory || "Social Media",
            new Date().toISOString().split("T")[0],
          );

          const trendPromise = claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            system: trendSystem,
            tools: [TREND_RESEARCH_TOOL],
            tool_choice: { type: "tool", name: "submit_trends" },
            messages: [{
              role: "user",
              content: `Nische: ${config.creatorsCategory || "Social Media"}\nKunde: ${clientName}${config.businessContext ? `\nBusiness: ${config.businessContext}` : ""}\n\n${recentBlock}\n\nIdentifiziere 5-8 aktuelle Trend-Themen für diese Nische.`,
            }],
          });

          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000));
          const trendMsg = await Promise.race([trendPromise, timeoutPromise]);

          if (trendMsg) {
            const tu = trendMsg.content.find(b => b.type === "tool_use");
            if (tu && tu.type === "tool_use") {
              const result = tu.input as { trends: Array<{ topic: string; angle: string; whyNow: string; hookIdea: string }> };
              trendBlock = `<trending_topics>
Aktuelle Trend-Themen (als INSPIRATION — mindestens 1-2 davon aufgreifen):
${result.trends.map((t, i) => `${i + 1}. ${t.topic} — ${t.angle}\n   Warum jetzt: ${t.whyNow}\n   Hook-Idee: "${t.hookIdea}"`).join("\n")}
</trending_topics>`;
              sendEvent(controller, { step: "trends", status: "done", count: result.trends.length });
            } else {
              sendEvent(controller, { step: "trends", status: "done", count: 0 });
            }
          } else {
            console.log("Trend research timed out after 30s — skipping");
            sendEvent(controller, { step: "trends", status: "done", count: 0 });
          }
        } catch (e) {
          console.error("Trend research failed:", e);
          sendEvent(controller, { step: "trends", status: "done", count: 0 });
        }

        // ════════════════════════════════════════════════════════════════════
        // STEP 3: TOPIC SELECTION (1 focused call)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "topics", status: "loading" });

        const topicSystemPrompt = topicSelectionSystemPrompt(activeDays.length);
        const topicTool = TOPIC_SELECTION_TOOL(
          activeDays,
          pillarNames,
          allContentTypes.map(t => t.name),
          allFormats.map(f => f.name),
        );

        const topicUserPrompt = `<content_strategy>
CONTENT PILLARS:
${pillarBlock}

WOCHENPLAN (${postsPerWeek}×/Woche):
${weekSchedule.map(s => `${s.day}: Content-Type "${s.contentType}" | Format "${s.format}" | Pillar "${s.pillar}"`).join("\n")}
</content_strategy>

${auditBlock}

${ownPerformanceBlock}

${competitorHooksBlock ? `<competitor_videos>\n${competitorHooksBlock}\n</competitor_videos>` : ""}

${trendBlock}

${crossNicheBlock}

${recentBlock}

<client>
${clientContext}
Nische: ${config.creatorsCategory || ""}
</client>

AUFTRAG: Wähle ${activeDays.length} strategisch optimale Themen für diese Woche. Eines pro Tag. Nutze die Trend-Themen und Cross-Nische-Inspiration als frische Ideen — mindestens 1-2 Themen sollten aktuelle Trends aufgreifen.`;

        const topicMessage = await claude.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: topicSystemPrompt,
          tools: [topicTool],
          tool_choice: { type: "tool", name: "submit_topics" },
          messages: [{ role: "user", content: topicUserPrompt }],
        });

        const topicToolUse = topicMessage.content.find(b => b.type === "tool_use");
        if (!topicToolUse || topicToolUse.type !== "tool_use") {
          sendEvent(controller, { step: "error", message: "KI konnte keine Themen auswählen." });
          controller.close();
          return;
        }

        const topicResult = topicToolUse.input as {
          topics: Array<{
            day: string; pillar: string; contentType: string; format: string;
            title: string; description: string; reasoning: string;
          }>;
        };

        // Ensure schedule alignment
        const topics = topicResult.topics.map((t, i) => ({
          ...t,
          day: weekSchedule[i]?.day || t.day,
          pillar: t.pillar || weekSchedule[i]?.pillar || "",
          contentType: t.contentType || weekSchedule[i]?.contentType || "",
          format: t.format || weekSchedule[i]?.format || "",
        }));

        sendEvent(controller, {
          step: "topics",
          status: "done",
          topics: topics.map(t => ({ day: t.day, title: t.title, pillar: t.pillar })),
        });

        // ════════════════════════════════════════════════════════════════════
        // STEP 4: HOOK GENERATION (N parallel calls)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "hooks", status: "loading", total: topics.length });

        const voiceToneBlock = voiceProfile
          ? `\nSTIMMPROFIL:\nTon: ${voiceProfile.tone}\nEnergie: ${voiceProfile.energy}\nLieblingswörter: ${voiceProfile.favoriteWords.slice(0, 5).join(", ")}`
          : "";

        // Script structure hook patterns for reference
        const structureHookBlock = scriptStructure
          ? `\nSKRIPT-STRUKTUR HOOK-MUSTER (aus Training gelernt — bevorzuge diese):\n${scriptStructure.hookPatterns.map(h => `- ${h.pattern}: "${h.example}"`).join("\n")}`
          : "";

        const hookPromises = topics.map(async (topic, idx) => {
          const userPrompt = `THEMA: ${topic.title}
BESCHREIBUNG: ${topic.description}
Content-Type: ${topic.contentType} | Format: ${topic.format}

${competitorHooksBlock ? `COMPETITOR-HOOKS (was in der Nische funktioniert):\n${competitorHooksBlock}` : ""}
${usedPatternsBlock ? `\nBEREITS VERWENDETE HOOK-MUSTER (vermeide Wiederholung, wähle ANDERE):\n${usedPatternsBlock}` : ""}
${structureHookBlock}
${voiceToneBlock}

Erstelle 3 Hook-Optionen für dieses Thema. Nutze Hook-Muster die NOCH NICHT oft verwendet wurden.`;

          try {
            const msg = await claude.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 500,
              system: HOOK_GENERATION_SYSTEM,
              tools: [HOOK_GENERATION_TOOL],
              tool_choice: { type: "tool", name: "submit_hooks" },
              messages: [{ role: "user", content: userPrompt }],
            });

            const tu = msg.content.find(b => b.type === "tool_use");
            if (tu && tu.type === "tool_use") {
              const result = tu.input as {
                options: Array<{ hook: string; pattern: string }>;
                selected: number;
                selectionReason: string;
              };
              const selectedIdx = result.selected ?? 0;
              const selectedHook = result.options[selectedIdx]?.hook || result.options[0]?.hook || "";
              const selectedPattern = result.options[selectedIdx]?.pattern || result.options[0]?.pattern || "";
              sendEvent(controller, { step: "hooks", status: "done", index: idx, hook: selectedHook });
              return { hook: selectedHook, pattern: selectedPattern, allOptions: result.options, reason: result.selectionReason };
            }
          } catch {
            // Fallback: simple hook
          }

          // Fallback hook
          const fallback = topic.title;
          sendEvent(controller, { step: "hooks", status: "done", index: idx, hook: fallback });
          return { hook: fallback, pattern: "", allOptions: [], reason: "fallback" };
        });

        const hookResults = await Promise.all(hookPromises);
        sendEvent(controller, { step: "hooks", status: "all_done" });

        // ════════════════════════════════════════════════════════════════════
        // STEP 5: BODY WRITING (N parallel calls)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "bodies", status: "loading", total: topics.length });

        const bodySystemPrompt = bodyWritingSystemPrompt({
          maxWords,
          durationLabel: avgDuration > 0 ? fmtDuration(avgDuration) : "",
        });

        const bodyPromises = topics.map(async (topic, idx) => {
          const hook = hookResults[idx].hook;

          const userPrompt = `<client>
${clientContext}
${brandContext}
</client>

${voiceBlock}

${structureBlock}

THEMA: ${topic.title}
BESCHREIBUNG: ${topic.description}
HOOK (bereits fertig): "${hook}"

Schreibe jetzt Body und CTA. Der Hook steht — baue darauf auf. Folge den Strukturmustern aus dem Skript-Aufbau-Profil.`;

          try {
            const msg = await claude.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 1500,
              system: bodySystemPrompt,
              tools: [BODY_WRITING_TOOL(maxWords)],
              tool_choice: { type: "tool", name: "submit_body" },
              messages: [{ role: "user", content: userPrompt }],
            });

            const tu = msg.content.find(b => b.type === "tool_use");
            if (tu && tu.type === "tool_use") {
              const result = tu.input as { body: string; cta: string };
              sendEvent(controller, {
                step: "bodies",
                status: "done",
                index: idx,
                title: topic.title,
                day: topic.day,
              });
              return { body: result.body, cta: result.cta };
            }
          } catch {
            // Fallback
          }

          sendEvent(controller, { step: "bodies", status: "done", index: idx, title: topic.title, day: topic.day });
          return { body: "", cta: "" };
        });

        const bodyResults = await Promise.all(bodyPromises);
        sendEvent(controller, { step: "bodies", status: "all_done" });

        // ════════════════════════════════════════════════════════════════════
        // STEP 6: QUALITY REVIEW (1 call reviewing all scripts)
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, { step: "review", status: "loading" });

        // Assemble scripts for review
        const assembledScripts = topics.map((topic, i) => ({
          day: topic.day,
          pillar: topic.pillar,
          contentType: topic.contentType,
          format: topic.format,
          title: topic.title,
          hook: hookResults[i].hook,
          hookPattern: hookResults[i].pattern || "",
          body: bodyResults[i].body,
          cta: bodyResults[i].cta,
          reasoning: topic.reasoning,
        }));

        const reviewUserPrompt = `${voiceBlock ? voiceBlock + "\n\n" : ""}${structureBlock ? structureBlock + "\n\n" : ""}${assembledScripts.map((s, i) => `--- SKRIPT ${i + 1} (${s.day}) ---
TITEL: ${s.title}
HOOK: ${s.hook}
BODY: ${s.body}
CTA: ${s.cta}`).join("\n\n")}

Prüfe alle ${assembledScripts.length} Skripte.`;

        let finalScripts = assembledScripts;
        let reviewIssues: string[] = [];

        try {
          const reviewPromise = claude.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4000,
            system: QUALITY_REVIEW_SYSTEM,
            tools: [QUALITY_REVIEW_TOOL(assembledScripts.length)],
            tool_choice: { type: "tool", name: "submit_review" },
            messages: [{ role: "user", content: reviewUserPrompt }],
          });

          // 60s timeout for review — if it takes longer, skip and use scripts as-is
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 60000));
          const reviewMsg = await Promise.race([reviewPromise, timeoutPromise]);

          if (reviewMsg) {
            const tu = reviewMsg.content.find(b => b.type === "tool_use");
            if (tu && tu.type === "tool_use") {
              const review = tu.input as {
                scripts: Array<{
                  index: number;
                  issues: string[];
                  revised?: { hook?: string; body?: string; cta?: string } | null;
                }>;
                weekCoherence: string;
              };

              // Apply revisions
              for (const r of review.scripts) {
                if (r.revised && finalScripts[r.index]) {
                  if (r.revised.hook) finalScripts[r.index].hook = r.revised.hook;
                  if (r.revised.body) finalScripts[r.index].body = r.revised.body;
                  if (r.revised.cta) finalScripts[r.index].cta = r.revised.cta;
                }
                if (r.issues.length > 0) {
                  reviewIssues.push(...r.issues.map(issue => `Skript ${r.index + 1}: ${issue}`));
                }
              }
            }
          } else {
            console.log("Quality review timed out after 60s — using scripts as-is");
          }
        } catch (reviewErr) {
          console.error("Quality review failed:", reviewErr instanceof Error ? reviewErr.message : reviewErr);
          // Review failed — use scripts as-is
        }

        sendEvent(controller, {
          step: "review",
          status: "done",
          issueCount: reviewIssues.length,
          issues: reviewIssues.slice(0, 10),
        });

        // ════════════════════════════════════════════════════════════════════
        // STEP 7: DONE
        // ════════════════════════════════════════════════════════════════════
        sendEvent(controller, {
          step: "done",
          scripts: finalScripts,
          _meta: {
            hasAudit: auditBlock.length > 0,
            hasVoiceProfile: !!voiceProfile,
            ownVideosUsed: ownTopVideos.length,
            creatorVideosUsed: creatorVideos.length,
            avgViralDurationSeconds: avgDuration || null,
            targetWords: maxWords || null,
            reviewIssuesFixed: reviewIssues.length,
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
