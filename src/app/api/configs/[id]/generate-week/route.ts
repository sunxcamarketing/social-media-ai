import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, readVideos, readStrategyConfig } from "@/lib/csv";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import { safeJsonParse } from "@/lib/safe-json";
import { fmt, fmtDuration, secondsToWords } from "@/lib/format";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";

export const maxDuration = 120;

function parseInsights(raw: string): PerformanceInsights | null {
  return safeJsonParse<PerformanceInsights | null>(raw, null);
}

function videoInsightBlock(v: VideoInsight, index: number): string {
  return [
    `  [${index + 1}] ${fmt(v.views)} Views · ${fmt(v.likes)} Likes · ${v.datePosted}${v.durationSeconds ? ` · Länge: ${fmtDuration(v.durationSeconds)}` : ""}`,
    v.topic         && `  Thema: ${v.topic}`,
    v.audioHook && v.audioHook !== "none" && `  Audio-Hook: "${v.audioHook}"`,
    v.textHook  && v.textHook  !== "none" && `  Text-Hook: "${v.textHook}"`,
    v.whyItWorked    && `  Warum es funktioniert hat: ${v.whyItWorked}`,
  ].filter(Boolean).join("\n");
}


const WEEK_SCRIPT_TOOL = {
  name: "submit_script",
  description: "Submit the complete generated video script",
  input_schema: {
    type: "object" as const,
    properties: {
      title:     { type: "string" },
      hook:      { type: "string", description: "Opening hook, max 2 sentences" },
      body:      { type: "string", description: "Main script body, paragraphs separated by \\n" },
      cta:       { type: "string", description: "Call to action, max 1-2 sentences" },
      reasoning: { type: "string", description: "Why this topic was chosen (1 sentence)" },
    },
    required: ["title", "hook", "body", "cta", "reasoning"],
  },
};

export interface WeekScript {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  reasoning: string;
  error?: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = await readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  // ── Client brand context ──────────────────────────────────────────────────
  const dreamCustomer = safeJsonParse(config.dreamCustomer);
  const clientContext = [
    config.name              && `Name: ${config.name}`,
    config.role              && `Rolle: ${config.role}`,
    config.company           && `Unternehmen: ${config.company}`,
    config.creatorsCategory  && `Nische: ${config.creatorsCategory}`,
    config.businessContext   && `Business-Kontext: ${config.businessContext}`,
    config.brandFeeling      && `Marken-Gefühl: ${config.brandFeeling}`,
    config.brandProblem      && `Kernproblem: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.providerRole      && `Rolle als Anbieter: ${config.providerRole}`,
    config.providerBeliefs   && `Überzeugungen: ${config.providerBeliefs}`,
    config.authenticityZone  && `Authentizitätszone: ${config.authenticityZone}`,
    config.humanDifferentiation && `Einzigartigkeit: ${config.humanDifferentiation}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession  && `Traumkunden-Beruf: ${dreamCustomer.profession}`,
  ].filter(Boolean).join("\n");

  // ── Strategy ──────────────────────────────────────────────────────────────
  const pillars: { name: string; description?: string }[] = safeJsonParse(config.strategyPillars, []);
  const weekly: Record<string, { type: string; format: string; pillar?: string }> = safeJsonParse(config.strategyWeekly);

  const strategyJson = await readStrategyConfig();
  const allContentTypes = [...BUILT_IN_CONTENT_TYPES, ...(strategyJson.customContentTypes || [])];
  const allFormats = [...BUILT_IN_FORMATS, ...(strategyJson.customFormats || [])];

  const postsPerWeek = parseInt(config.postsPerWeek || "5", 10);
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);

  const pillarList = pillars.length > 0
    ? pillars.map((p, i) => `  ${i + 1}. ${p.name}${p.description ? ` — ${p.description}` : ""}`).join("\n")
    : "  (keine Pillars definiert)";

  // ── Performance data ──────────────────────────────────────────────────────
  const insights = parseInsights(config.performanceInsights || "");
  const ownTopVideos: VideoInsight[] = [
    ...(insights?.top30Days  || []),
    ...(insights?.topAllTime || []),
  ].slice(0, 3);

  const allVideos = await readVideos();
  const creatorVideos = allVideos
    .filter(v => v.configName === config.configName && v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);

  // ── Duration: compute hard word limit ────────────────────────────────────
  const allDurations: number[] = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];

  const avgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;

  const maxWords = avgDuration > 0 ? secondsToWords(avgDuration) : 0;

  const durationInstruction = maxWords > 0
    ? `⚠️ HARTE LÄNGEN-VORGABE: MAX ${maxWords} WÖRTER GESAMT (Hook + Body + CTA). Bei ~2 Wörtern/Sekunde = ${fmtDuration(avgDuration)}. NICHT überschreiten.`
    : "Schreibe prägnant — Instagram Reels sind kurz.";

  // Brief performance context (shorter than generate-script to keep tokens low)
  const ownPerformanceContext = ownTopVideos.length > 0 ? `
EIGENE TOP-VIDEOS:
${ownTopVideos.map((v, i) => videoInsightBlock(v, i)).join("\n\n")}` : "";

  const creatorContext = creatorVideos.length > 0 ? `
TOP CREATOR-VIDEOS (Wettbewerb):
${creatorVideos.map((v, i) => {
  const lines = [
    `  [${i + 1}] @${v.creator} · ${fmt(v.views)} Views${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""}`,
  ];
  if (v.analysis) {
    const hookMatch = v.analysis.match(/HOOK[:\s]+([\s\S]*?)(?=\n[A-Z][\w /]+[:\s]|$)/i);
    if (hookMatch) lines.push(`  Hook: ${hookMatch[1].trim().slice(0, 150)}`);
  }
  return lines.filter(Boolean).join("\n");
}).join("\n\n")}` : "";

  // ── Map pillar assignments ─────────────────────────────────────────────────
  // Build a round-robin pillar assignment for days that don't have one set
  const pillarNames = pillars.map(p => p.name);

  function getPillarForDay(day: string, dayIndex: number): string {
    const d = weekly[day];
    if (d && (d as Record<string, string>).pillar) return (d as Record<string, string>).pillar;
    if (pillarNames.length > 0) return pillarNames[dayIndex % pillarNames.length];
    return "Allgemein";
  }

  const allContentTypeNames = allContentTypes.map(t => t.name);
  const allFormatNames = allFormats.map(f => f.name);

  function getTypeForDay(day: string, dayIndex: number): string {
    const d = weekly[day];
    if (d?.type) return d.type;
    if (allContentTypeNames.length > 0) return allContentTypeNames[dayIndex % allContentTypeNames.length];
    return "Education";
  }

  function getFormatForDay(day: string, dayIndex: number): string {
    const d = weekly[day];
    if (d?.format) return d.format;
    if (allFormatNames.length > 0) return allFormatNames[dayIndex % allFormatNames.length];
    return "Face to Camera";
  }

  const client = new Anthropic({ apiKey });

  // ── Generate all scripts in parallel ─────────────────────────────────────
  const results = await Promise.allSettled(
    activeDays.map(async (day, dayIndex) => {
      const contentType = getTypeForDay(day, dayIndex);
      const format = getFormatForDay(day, dayIndex);
      const pillar = getPillarForDay(day, dayIndex);

      const prompt = `Du bist ein erfahrener Social-Media-Texter. Schreibe ein Video-Skript für diesen Kunden.

${durationInstruction}

Du schreibst das Skript für ${day}. Content Type: ${contentType}. Format: ${format}. Pillar: ${pillar}.
Entscheide selbst: Thema, Hook, Body, CTA. Basiere es auf Performance-Daten und Kundenprofil.

KUNDENPROFIL:
${clientContext}

PILLARS:
${pillarList}
${ownPerformanceContext}
${creatorContext}

Regeln:
- Hook: max 2 Sätze, sofort fesselnd
- Body: kein Füllwort, wie echtes gesprochenes Deutsch
- CTA: max 1-2 Sätze
${maxWords > 0 ? `- ABSOLUTES LIMIT: Hook + Body + CTA zusammen = max ${maxWords} Wörter` : ""}`;

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        tools: [WEEK_SCRIPT_TOOL],
        tool_choice: { type: "tool", name: "submit_script" },
        messages: [{ role: "user", content: prompt }],
      });

      const toolUse = message.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        throw new Error("KI hat kein Skript generiert");
      }

      const input = toolUse.input as {
        title: string; hook: string; body: string; cta: string; reasoning: string;
      };

      const result: WeekScript = {
        day,
        pillar,
        contentType,
        format,
        title:     input.title     || "",
        hook:      input.hook      || "",
        body:      input.body      || "",
        cta:       input.cta       || "",
        reasoning: input.reasoning || "",
      };

      return result;
    })
  );

  const scripts: WeekScript[] = results.map((result, i) => {
    const day = activeDays[i];
    const contentType = getTypeForDay(day, i);
    const format = getFormatForDay(day, i);
    const pillar = getPillarForDay(day, i);

    if (result.status === "fulfilled") {
      return result.value;
    } else {
      const errMsg = result.reason instanceof Error ? result.reason.message : "Unbekannter Fehler";
      return {
        day,
        pillar,
        contentType,
        format,
        title: "",
        hook: "",
        body: "",
        cta: "",
        reasoning: "",
        error: errMsg,
      };
    }
  });

  return NextResponse.json({ scripts });
}
