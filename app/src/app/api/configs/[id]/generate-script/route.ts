import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, readVideos } from "@/lib/csv";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";

export const maxDuration = 90;

function parseInsights(raw: string): PerformanceInsights | null {
  try { return JSON.parse(raw) || null; } catch { return null; }
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function fmtDuration(s: number): string {
  if (!s) return "?s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
}

// ~2 words per second spoken (125 words/min)
function secondsToWords(s: number): number {
  return Math.round(s * 2);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function videoInsightBlock(v: VideoInsight, index: number): string {
  return [
    `  [${index + 1}] ${fmt(v.views)} Views · ${fmt(v.likes)} Likes · ${v.datePosted}${v.durationSeconds ? ` · Länge: ${fmtDuration(v.durationSeconds)}` : ""}`,
    v.topic         && `  Thema: ${v.topic}`,
    v.audioHook && v.audioHook !== "none" && `  Audio-Hook: "${v.audioHook}"`,
    v.textHook  && v.textHook  !== "none" && `  Text-Hook: "${v.textHook}"`,
    v.scriptSummary  && `  Script-Zusammenfassung: ${v.scriptSummary}`,
    v.whyItWorked    && `  Warum es funktioniert hat: ${v.whyItWorked}`,
    v.howToReplicate && `  Wie replizierbar: ${v.howToReplicate}`,
  ].filter(Boolean).join("\n");
}

function readStrategyJson() {
  const file = path.join(process.cwd(), "..", "data", "strategy.json");
  if (!existsSync(file)) return { customContentTypes: [], customFormats: [] };
  try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return { customContentTypes: [], customFormats: [] }; }
}

function buildScriptTool(withTypeFields: boolean) {
  return {
    name: "submit_script",
    description: "Submit the complete generated video script",
    input_schema: {
      type: "object" as const,
      properties: {
        ...(withTypeFields ? {
          pillar:      { type: "string" },
          contentType: { type: "string" },
          format:      { type: "string" },
        } : {}),
        title:       { type: "string" },
        hook:        { type: "string", description: "Opening hook, max 1-2 sentences" },
        body:        { type: "string", description: "Main script body, paragraphs separated by \\n" },
        cta:         { type: "string", description: "Call to action, max 1-2 sentences" },
        reasoning:   { type: "string", description: "Why this topic, format and length was chosen (1 sentence)" },
      },
      required: [
        ...(withTypeFields ? ["pillar", "contentType", "format"] : []),
        "title", "hook", "body", "cta", "reasoning",
      ],
    },
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const hint: string = body.hint || "";
  const dayOverride: { day: string; contentType: string; format: string; pillar: string } | null =
    body.dayOverride || null;

  // ── Client brand context ──────────────────────────────────────────────────
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
    config.providerRole      && `Rolle als Anbieter: ${config.providerRole}`,
    config.providerBeliefs   && `Überzeugungen: ${config.providerBeliefs}`,
    config.authenticityZone  && `Authentizitätszone: ${config.authenticityZone}`,
    config.humanDifferentiation && `Einzigartigkeit: ${config.humanDifferentiation}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession  && `Traumkunden-Beruf: ${dreamCustomer.profession}`,
  ].filter(Boolean).join("\n");

  // ── Strategy ──────────────────────────────────────────────────────────────
  const pillars: { name: string; description?: string }[] = (() => {
    try { return JSON.parse(config.strategyPillars || "[]") || []; } catch { return []; }
  })();
  const weekly: Record<string, { type: string; format: string }> = (() => {
    try { return JSON.parse(config.strategyWeekly || "{}") || {}; } catch { return {}; }
  })();

  const strategyJson = readStrategyJson();
  const allContentTypes = [...BUILT_IN_CONTENT_TYPES, ...(strategyJson.customContentTypes || [])];
  const allFormats = [...BUILT_IN_FORMATS, ...(strategyJson.customFormats || [])];

  const postsPerWeek = parseInt(config.postsPerWeek || "5", 10);
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);

  const weeklyPlan = activeDays.map(day => {
    const d = weekly[day];
    return d ? `  ${day}: ${d.type || "—"} | Format: ${d.format || "—"}` : `  ${day}: (kein Plan)`;
  }).join("\n");

  const pillarList = pillars.length > 0
    ? pillars.map((p, i) => `  ${i + 1}. ${p.name}${p.description ? ` — ${p.description}` : ""}`).join("\n")
    : "  (keine Pillars definiert)";

  const contentTypeList = allContentTypes.map(t => `  - ${t.name}: ${t.goal}`).join("\n");
  const formatList = allFormats.slice(0, 10).map(f => `  - ${f.name}: ${f.description}`).join("\n");

  // ── Performance data ──────────────────────────────────────────────────────
  const insights = parseInsights(config.performanceInsights || "");
  const ownTopVideos: VideoInsight[] = [
    ...(insights?.top30Days  || []),
    ...(insights?.topAllTime || []),
  ];

  const allVideos = readVideos();
  const creatorVideos = allVideos
    .filter(v => v.configName === config.configName && v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  // ── Duration: compute hard word limit ────────────────────────────────────
  const allDurations: number[] = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];

  const avgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;

  // Hard limit: total spoken words (hook + body + cta) must stay under this
  const maxWords = avgDuration > 0 ? secondsToWords(avgDuration) : 0;

  const durationBlock = allDurations.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  HARTE LÄNGEN-VORGABE — ZWINGEND EINZUHALTEN
Virale Videos in dieser Nische: Ø ${fmtDuration(avgDuration)} (${allDurations.length} analysiert, Min: ${fmtDuration(Math.min(...allDurations))}, Max: ${fmtDuration(Math.max(...allDurations))})
→ MAX ${maxWords} WÖRTER GESAMT (Hook + Body + CTA zusammen)
→ Bei ~2 Wörtern/Sekunde = ${fmtDuration(avgDuration)} Sprechzeit
Zähle deine Wörter. Überschreite ${maxWords} Wörter NICHT.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : "";

  const ownPerformanceContext = ownTopVideos.length > 0 ? `
EIGENE BEST-PERFORMING VIDEOS:
${ownTopVideos.map((v, i) => videoInsightBlock(v, i)).join("\n\n")}` : "";

  const creatorContext = creatorVideos.length > 0 ? `
BEST-PERFORMING CREATOR-VIDEOS (Wettbewerber):
${creatorVideos.map((v, i) => {
  const lines = [
    `  [${i + 1}] @${v.creator} · ${fmt(v.views)} Views${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""} · ${v.datePosted}`,
  ];
  if (v.analysis) {
    const getSection = (label: string) => {
      const m = v.analysis.match(new RegExp(`${label}[:\\s]+([\\s\\S]*?)(?=\\n[A-Z][\\w /]+[:\\s]|$)`, "i"));
      return m ? m[1].trim().slice(0, 200) : "";
    };
    const hook = getSection("HOOK");
    const why  = getSection("WHY IT WORKED");
    if (hook) lines.push(`  Hook: ${hook}`);
    if (why)  lines.push(`  Warum erfolgreich: ${why}`);
  }
  if (v.newConcepts) lines.push(`  Konzeptideen: ${v.newConcepts.slice(0, 300)}`);
  return lines.filter(Boolean).join("\n");
}).join("\n\n")}` : "";

  const client = new Anthropic({ apiKey });

  // ── Step 1: Generate script ───────────────────────────────────────────────
  const withTypeFields = !dayOverride;
  const SCRIPT_TOOL = buildScriptTool(withTypeFields);

  const dayOverrideBlock = dayOverride
    ? `Du schreibst das Skript für ${dayOverride.day}. Content Type: ${dayOverride.contentType}. Format: ${dayOverride.format}. Pillar: ${dayOverride.pillar}.
Entscheide nur das Thema, den Hook, Body und CTA.`
    : "Wähle selbst: Pillar, Content Type, Format, Thema. Basiere es auf den Performance-Daten.";

  const mainPrompt = `Du bist ein erfahrener Social-Media-Texter. Erstelle selbstständig ein Video-Skript für diesen Kunden.
${durationBlock}

KUNDENPROFIL:
${clientContext}

STRATEGIE:
Pillars: ${pillarList}
Wochenplan (${postsPerWeek}×/Woche):
${weeklyPlan}
Content Types: ${contentTypeList}
Formate: ${formatList}
${ownPerformanceContext}
${creatorContext}
${hint ? `\nHINWEIS VOM USER: ${hint}` : ""}

${dayOverrideBlock}
${maxWords > 0 ? `ABSOLUTES LIMIT: Hook + Body + CTA zusammen = max ${maxWords} Wörter. Kürzer ist besser als länger.` : "Schreibe prägnant — Instagram Reels sind kurz."}

Regeln:
- Hook: max 2 Sätze, sofort fesselnd
- Body: kein Füllwort, wie echtes gesprochenes Deutsch
- CTA: max 1-2 Sätze`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    tools: [SCRIPT_TOOL],
    tool_choice: { type: "tool", name: "submit_script" },
    messages: [{ role: "user", content: mainPrompt }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "KI hat kein Skript generiert. Bitte erneut versuchen." }, { status: 500 });
  }

  let result = toolUse.input as {
    pillar?: string; contentType?: string; format?: string; title: string;
    hook: string; body: string; cta: string; reasoning: string;
  };

  // Merge dayOverride values when present
  if (dayOverride) {
    result = {
      ...result,
      pillar:      dayOverride.pillar,
      contentType: dayOverride.contentType,
      format:      dayOverride.format,
    };
  }

  // ── Step 2: Auto-shorten if over limit ───────────────────────────────────
  if (maxWords > 0) {
    const totalWords = countWords(result.hook) + countWords(result.body) + countWords(result.cta);
    if (totalWords > maxWords * 1.1) {
      // Script is >10% over limit — shorten automatically
      const shortenMsg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        tools: [SCRIPT_TOOL],
        tool_choice: { type: "tool", name: "submit_script" },
        messages: [
          { role: "user", content: mainPrompt },
          {
            role: "assistant",
            content: message.content,
          },
          {
            role: "user",
            content: `Das Skript hat ${totalWords} Wörter — zu lang. Es muss auf maximal ${maxWords} Wörter gekürzt werden (Hook + Body + CTA zusammen).

Kürze das Skript auf max ${maxWords} Wörter. Behalte:
- Den gleichen Pillar, Content Type, Format und Titel
- Den Kern der Message und den Hook-Ansatz
- Den CTA

Streiche alles was nicht zwingend nötig ist. Jedes Wort muss verdient sein.`,
          },
        ],
      });

      const shortenedTool = shortenMsg.content.find((b) => b.type === "tool_use");
      if (shortenedTool && shortenedTool.type === "tool_use") {
        result = shortenedTool.input as typeof result;
        // Re-merge dayOverride values if present (not included in shorten tool fields)
        if (dayOverride) {
          result = {
            ...result,
            pillar:      dayOverride.pillar,
            contentType: dayOverride.contentType,
            format:      dayOverride.format,
          };
        }
      }
    }
  }

  const finalWords = countWords(result.hook) + countWords(result.body) + countWords(result.cta);

  return NextResponse.json({
    ...result,
    _meta: {
      ownVideosUsed: ownTopVideos.length,
      creatorVideosUsed: creatorVideos.length,
      avgViralDurationSeconds: avgDuration || null,
      targetWords: maxWords || null,
      actualWords: finalWords,
    },
  });
}
