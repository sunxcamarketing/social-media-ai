import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, readVideos, readScripts, readTrainingScripts, readAnalyses, readStrategyConfig } from "@/lib/csv";
import { getAuditBlock } from "@/app/api/configs/[id]/generate-week-scripts/route";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import { buildPrompt } from "@prompts";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";
import type { TopicPlanItem } from "@/lib/types";

export const maxDuration = 60;

function parseInsights(raw: string): PerformanceInsights | null {
  try { return JSON.parse(raw) || null; } catch { return null; }
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = await readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  // ── Client context ────────────────────────────────────────────────────────
  const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();
  const clientContext = [
    config.name              && `Name: ${config.name}`,
    config.role              && `Rolle: ${config.role}`,
    config.company           && `Unternehmen: ${config.company}`,
    config.creatorsCategory  && `Nische: ${config.creatorsCategory}`,
    config.businessContext   && `Business-Kontext: ${config.businessContext}`,
    config.brandFeeling      && `Marken-Gefühl: ${config.brandFeeling}`,
    config.brandProblem      && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.providerRole      && `Anbieter-Rolle: ${config.providerRole}`,
    config.authenticityZone  && `Authentizitätszone: ${config.authenticityZone}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
  ].filter(Boolean).join("\n");

  // ── Strategy ──────────────────────────────────────────────────────────────
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

  // Round-robin pillar assignment
  function getPillarForDay(dayIndex: number): string {
    if (pillarNames.length > 0) return pillarNames[dayIndex % pillarNames.length];
    return "Allgemein";
  }

  // Build the weekly schedule with assigned pillars
  const weekSchedule = activeDays.map((day, i) => {
    const d = weekly[day];
    return {
      day,
      contentType: d?.type || allContentTypes[i % allContentTypes.length]?.name || "Education / Value",
      format: d?.format || allFormats[i % allFormats.length]?.name || "Face to Camera",
      pillar: getPillarForDay(i),
    };
  });

  // ── Performance data (brief) ──────────────────────────────────────────────
  const insights = parseInsights(config.performanceInsights || "");
  const ownTopVideos: VideoInsight[] = [
    ...(insights?.top30Days || []),
    ...(insights?.topAllTime || []),
  ].slice(0, 3);

  const allVideos = await readVideos();
  const creatorVideos = allVideos
    .filter(v => v.configName === config.configName && v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 4);

  const performanceBlock = [
    ...ownTopVideos.map(v => v.topic ? `- Eigenes Video: "${v.topic}" (${fmt(v.views)} Views)` : null),
    ...creatorVideos.map(v => {
      const hookMatch = v.analysis?.match(/HOOK[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
      const hook = hookMatch ? hookMatch[1].trim().slice(0, 80) : "";
      return `- @${v.creator}: ${fmt(v.views)} Views${hook ? ` — Hook: "${hook}"` : ""}`;
    }),
  ].filter(Boolean);

  // ── Audit report ─────────────────────────────────────────────────────────
  const auditBlock = await getAuditBlock(id);

  // ── Existing scripts (avoid repetition) ───────────────────────────────────
  const existingScripts = (await readScripts()).filter(s => s.clientId === id);
  const recentTitles = existingScripts.slice(-20).map(s => s.title).filter(Boolean);

  // ── Pillar details ────────────────────────────────────────────────────────
  const pillarBlock = pillars.map(p => {
    let line = `- ${p.name}`;
    if (p.subTopics) line += `: ${p.subTopics}`;
    return line;
  }).join("\n");

  // ── Tool schema ───────────────────────────────────────────────────────────
  const TOPIC_PLAN_TOOL = {
    name: "submit_topic_plan",
    description: "Den Wochenplan mit Themen einreichen",
    input_schema: {
      type: "object" as const,
      properties: {
        topics: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              day:         { type: "string", enum: activeDays },
              pillar:      { type: "string", enum: pillarNames.length > 0 ? pillarNames : undefined },
              contentType: { type: "string", enum: allContentTypes.map(t => t.name) },
              format:      { type: "string", enum: allFormats.map(f => f.name) },
              title:       { type: "string", description: "Konkreter Arbeitstitel (max 10 Wörter). Beschreibt genau worum es im Video geht." },
              description: { type: "string", description: "1 Satz: Was passiert in diesem Video? Was ist die Kernaussage?" },
              reasoning:   { type: "string", description: "1-2 Sätze: Warum dieses Thema? Welche Daten aus dem Audit oder der Performance stützen es?" },
            },
            required: ["day", "pillar", "contentType", "format", "title", "description", "reasoning"],
          },
          minItems: activeDays.length,
          maxItems: activeDays.length,
        },
      },
      required: ["topics"],
    },
  };

  const client = new Anthropic({ apiKey });

  const systemPrompt = buildPrompt("topic-plan");

  const userPrompt = `<client>
${clientContext}
</client>

<pillars>
${pillarBlock}
</pillars>

<weekly_schedule>
${weekSchedule.map(s => `${s.day}: Content-Type "${s.contentType}" | Format "${s.format}" | Pillar "${s.pillar}"`).join("\n")}
</weekly_schedule>

${performanceBlock.length > 0 ? `<performance>\n${performanceBlock.join("\n")}\n</performance>` : ""}

${auditBlock}

${recentTitles.length > 0 ? `<already_covered>\nDiese Themen wurden bereits behandelt — vermeide sie:\n${recentTitles.map(t => `- ${t}`).join("\n")}\n</already_covered>` : ""}

Erstelle den Themenplan für diese Woche. ${activeDays.length} Videos, eines pro Tag.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: systemPrompt,
    tools: [TOPIC_PLAN_TOOL],
    tool_choice: { type: "tool", name: "submit_topic_plan" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "KI hat keinen Plan generiert." }, { status: 500 });
  }

  const input = toolUse.input as { topics: TopicPlanItem[] };

  // Ensure day/pillar/type/format from schedule are used (override any AI mistakes)
  const topics: TopicPlanItem[] = input.topics.map((t, i) => ({
    ...t,
    day: weekSchedule[i]?.day || t.day,
    pillar: t.pillar || weekSchedule[i]?.pillar || "",
    contentType: t.contentType || weekSchedule[i]?.contentType || "",
    format: t.format || weekSchedule[i]?.format || "",
  }));

  return NextResponse.json({ topics });
}
