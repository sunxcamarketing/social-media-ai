import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, writeConfigs, readTrainingScripts, readVideos, readAnalyses, readStrategyConfig } from "@/lib/csv";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS, type ContentType, type ContentFormat } from "@/lib/strategy";
import type { PerformanceInsights, VideoInsight } from "../performance/route";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildClientContext(config: Record<string, string>): string {
  const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();
  const customerProblems = (() => { try { return JSON.parse(config.customerProblems || "{}"); } catch { return {}; } })();

  return [
    config.name && `Name: ${config.name}`,
    config.role && `Role: ${config.role}`,
    config.company && `Company: ${config.company}`,
    config.creatorsCategory && `Niche/Category: ${config.creatorsCategory}`,
    config.businessContext && `Business Context: ${config.businessContext}`,
    config.professionalBackground && `Background: ${config.professionalBackground}`,
    config.keyAchievements && `Key Achievements: ${config.keyAchievements}`,
    config.brandFeeling && `Feeling they sell: ${config.brandFeeling}`,
    config.brandProblem && `Core problem they solve: ${config.brandProblem}`,
    config.brandingStatement && `Branding Statement: ${config.brandingStatement}`,
    config.providerRole && `Their role: ${config.providerRole}`,
    config.providerBeliefs && `Their beliefs: ${config.providerBeliefs}`,
    config.providerStrengths && `Their strengths: ${config.providerStrengths}`,
    config.authenticityZone && `Authenticity zone: ${config.authenticityZone}`,
    config.humanDifferentiation && `AND factor: ${config.humanDifferentiation}`,
    dreamCustomer.description && `Dream customer: ${dreamCustomer.description}`,
    dreamCustomer.profession && `Dream customer profession: ${dreamCustomer.profession}`,
    dreamCustomer.values && `Dream customer values: ${dreamCustomer.values}`,
    customerProblems.mental && `Mental problems: ${customerProblems.mental}`,
    customerProblems.financial && `Financial problems: ${customerProblems.financial}`,
    customerProblems.social && `Social problems: ${customerProblems.social}`,
    // Instagram profile data
    config.igBio && `Instagram Bio: ${config.igBio}`,
    config.igFollowers && `Instagram Followers: ${config.igFollowers}`,
    config.igCategory && `Instagram Category: ${config.igCategory}`,
  ].filter(Boolean).join("\n");
}

function buildPerformanceBlock(insights: PerformanceInsights): string {
  const formatVideo = (v: VideoInsight, i: number) => [
    `  Video ${i + 1}: ${v.url}`,
    `  Views: ${v.views.toLocaleString()} | Likes: ${v.likes.toLocaleString()} | Posted: ${v.datePosted}`,
    v.topic && `  Topic: ${v.topic}`,
    v.audioHook && `  Audio Hook: "${v.audioHook}"`,
    v.textHook && `  Text Hook: "${v.textHook}"`,
    v.scriptSummary && `  Script Summary: ${v.scriptSummary}`,
    v.whyItWorked && `  Why it worked: ${v.whyItWorked}`,
    v.howToReplicate && `  How to replicate: ${v.howToReplicate}`,
  ].filter(Boolean).join("\n");

  const sections: string[] = [];

  if (insights.top30Days.length > 0) {
    sections.push(`TOP PERFORMING VIDEOS (Last 30 Days):\n${insights.top30Days.map(formatVideo).join("\n\n")}`);
  }
  if (insights.topAllTime.length > 0) {
    sections.push(`TOP PERFORMING VIDEOS (All Time):\n${insights.topAllTime.map(formatVideo).join("\n\n")}`);
  }

  return sections.length > 0
    ? `<performance_data>\n${sections.join("\n\n")}\n</performance_data>`
    : "";
}

function buildAuditBlock(report: string): string {
  if (!report) return "";
  // Truncate very long reports to keep context focused
  const trimmed = report.length > 3000 ? report.slice(0, 3000) + "\n...[truncated]" : report;
  return `<audit_report>\n${trimmed}\n</audit_report>`;
}

function buildCompetitorBlock(videos: { creator: string; views: number; likes: number; analysis: string; link: string }[]): string {
  if (videos.length === 0) return "";

  const formatted = videos.slice(0, 10).map((v, i) => [
    `  ${i + 1}. @${v.creator} — ${v.views.toLocaleString()} views, ${v.likes.toLocaleString()} likes`,
    `  Link: ${v.link}`,
    v.analysis && `  Analysis: ${v.analysis.slice(0, 400)}${v.analysis.length > 400 ? "…" : ""}`,
  ].filter(Boolean).join("\n")).join("\n\n");

  return `<competitor_data>\nTOP COMPETITOR VIDEOS IN THIS NICHE (sorted by views — these show what works in this market):\n\n${formatted}\n</competitor_data>`;
}

function buildTrainingBlock(scripts: { format: string; textHook: string; visualHook: string; audioHook: string; script: string; cta: string }[]): string {
  if (scripts.length === 0) return "";

  const formatted = scripts.map(s => [
    `[Format: ${s.format || "–"}]`,
    s.textHook && `Text Hook: ${s.textHook}`,
    s.visualHook && `Visual Hook: ${s.visualHook}`,
    s.audioHook && `Audio Hook: ${s.audioHook}`,
    s.script && `Script: ${s.script.slice(0, 300)}${s.script.length > 300 ? "…" : ""}`,
    s.cta && `CTA: ${s.cta}`,
  ].filter(Boolean).join("\n")).join("\n\n---\n\n");

  return `<training_examples>\nREAL SUCCESSFUL SCRIPTS (use these to understand tone, style, and format combinations that work):\n\n${formatted}\n</training_examples>`;
}

// ── Main Route ───────────────────────────────────────────────────────────────

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = await readConfigs();
  const index = configs.findIndex((c) => c.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = configs[index];
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  // ── 1. Client context ──────────────────────────────────────────────────────
  const clientContext = buildClientContext(config as unknown as Record<string, string>);

  // ── 2. Performance data (own top videos) ───────────────────────────────────
  let performanceBlock = "";
  try {
    const insights: PerformanceInsights = JSON.parse(config.performanceInsights || "{}");
    if (insights.top30Days || insights.topAllTime) {
      performanceBlock = buildPerformanceBlock(insights);
    }
  } catch { /* no performance data */ }

  // ── 3. Audit report (most recent for this client) ──────────────────────────
  let auditBlock = "";
  try {
    const analyses = await readAnalyses();
    const clientAnalysis = analyses
      .filter((a) => a.clientId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (clientAnalysis?.report) {
      auditBlock = buildAuditBlock(clientAnalysis.report);
    }
  } catch { /* no audit data */ }

  // ── 4. Competitor videos (from pipeline runs for this config) ──────────────
  let competitorBlock = "";
  try {
    const allVideos = await readVideos();
    const configName = config.configName || config.name || "";
    const competitorVideos = allVideos
      .filter((v) => v.configName === configName && v.analysis)
      .sort((a, b) => b.views - a.views);
    if (competitorVideos.length > 0) {
      competitorBlock = buildCompetitorBlock(competitorVideos);
    }
  } catch { /* no competitor data */ }

  // ── 5. Training scripts ────────────────────────────────────────────────────
  const trainingScripts = await readTrainingScripts();
  const trainingBlock = buildTrainingBlock(trainingScripts);

  // ── 6. Content types & formats (built-in + custom) ─────────────────────────
  let allTypes: ContentType[] = [...BUILT_IN_CONTENT_TYPES];
  let allFormats: ContentFormat[] = [...BUILT_IN_FORMATS];
  try {
    const strategyConfig = await readStrategyConfig();
    if (strategyConfig.customContentTypes?.length) {
      allTypes = [...allTypes, ...strategyConfig.customContentTypes];
    }
    if (strategyConfig.customFormats?.length) {
      allFormats = [...allFormats, ...strategyConfig.customFormats];
    }
  } catch { /* use defaults */ }

  const contentTypeList = allTypes.map(t => `- ${t.name}: ${t.goal} (best for: ${t.bestFor})`).join("\n");
  const formatList = allFormats.map(f => `- ${f.name}: ${f.description} (${f.platform})`).join("\n");

  // ── 7. Posting schedule ────────────────────────────────────────────────────
  const postsPerWeek = Math.min(7, Math.max(1, parseInt(config.postsPerWeek || "5", 10)));
  const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);

  // ── 8. Assemble prompt ─────────────────────────────────────────────────────

  const dataContext = [performanceBlock, auditBlock, competitorBlock, trainingBlock]
    .filter(Boolean)
    .join("\n\n");

  const hasData = !!performanceBlock || !!auditBlock || !!competitorBlock;

  const prompt = `Du bist ein erfahrener Content-Stratege für Instagram. Du erstellst datenbasierte Content-Strategien.

FRAMEWORK: Content = Pillar + Type + Format

VERFÜGBARE CONTENT TYPES:
${contentTypeList}

VERFÜGBARE FORMATS:
${formatList}

<client_profile>
${clientContext}
</client_profile>

${dataContext}

AUFTRAG: Erstelle eine Content-Strategie für ${postsPerWeek}× pro Woche (Tage: ${activeDays.join(", ")}).

REGELN:

1. STRATEGIE-ZIEL:
   - "reach" wenn Reichweite/Sichtbarkeit fehlt
   - "trust" wenn Vertrauen/Community aufgebaut werden muss
   - "revenue" wenn es um Conversion/Verkauf geht
   ${hasData ? "- Nutze die vorhandenen Daten (Audit, Performance, Competitor) um das Ziel datenbasiert zu bestimmen." : "- Leite das Ziel aus dem Client-Profil ab."}

2. CONTENT PILLARS (3–5):
   - Jeder Pillar muss direkt mit Expertise, Angebot oder Traumkunden-Problemen zusammenhängen
   - Pillar-Name: kurz (2–4 Wörter)
   - SubTopics: 3–4 KONKRETE Themenideen pro Pillar
   - Nicht "Trading Fehler" sondern "Warum dein Stop-Loss bei 2% Quatsch ist"
   - Der Zuschauer muss am Titel erkennen was er lernt oder fühlt
   ${performanceBlock ? "- Orientiere dich an den Themen der erfolgreichsten eigenen Videos — mehr davon, aber mit NEUEM Winkel." : ""}
   ${competitorBlock ? "- Nutze Competitor-Daten: Welche Themen und Hooks funktionieren in der Nische? Adaptiere für diesen Client." : ""}

3. WOCHENPLAN:
   - Pro Tag: ein Content Type + ein oder mehrere Formats
   - Content Types DÜRFEN sich wiederholen wenn strategisch sinnvoll
   - Formate können kombiniert werden mit " + " (z.B. "Face to Camera + Voice Over + B-Roll")
   - Nutze EXAKTE Namen aus den Listen oben
   ${trainingBlock ? "- Lerne aus den Training Examples welche Format-Kombinationen gut funktionieren." : ""}

${hasData ? `4. DATEN-NUTZUNG (KRITISCH):
   ${auditBlock ? "- AUDIT: Analysiere gründlich — Was funktioniert? Was nicht? Welche Muster? Mehr von dem was funktioniert, vermeiden was nicht funktioniert." : ""}
   ${performanceBlock ? "- PERFORMANCE: Welche eigenen Videos hatten die meisten Views? Warum? Welche Content Types und Formate performen am besten? Orientiere die Strategie daran." : ""}
   ${competitorBlock ? "- COMPETITOR: Welche Hooks und Themen gehen in der Nische viral? Adaptiere bewährte Konzepte für diesen Client — nicht kopieren, sondern mit eigenem Winkel neu interpretieren." : ""}
   - Verweise in deiner Begründung auf KONKRETE Datenpunkte: "Laut Audit performen Videos unter 25s 3x besser" statt "Kurze Videos sind gut".
   - Die Strategie muss zeigen dass du die Daten gelesen und verstanden hast.` : ""}

Antworte NUR mit validem JSON:

{
  "strategyGoal": "reach" | "trust" | "revenue",
  "reasoning": "2-4 Sätze WARUM dieses Ziel und diese Strategie — mit konkreten Daten-Verweisen falls vorhanden",
  "pillars": [
    { "name": "Pillar-Name", "subTopics": "3-4 konkrete Themenideen" }
  ],
  "weekly": {
    ${activeDays.map(d => `"${d}": { "type": "Content Type Name", "format": "Format Name(s)", "reason": "Warum dieser Type+Format an diesem Tag" }`).join(",\n    ")}
  }
}`;

  // ── 9. Call Claude ─────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey, timeout: 110_000 });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "AI did not return valid JSON" }, { status: 500 });

  let generated: {
    strategyGoal: string;
    reasoning: string;
    pillars: { name: string; subTopics: string }[];
    weekly: Record<string, { type: string; format: string; reason: string }>;
  };
  try {
    generated = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  // ── 10. Save to config ─────────────────────────────────────────────────────
  // Embed reasoning into weekly JSON so we don't need a new DB column
  const weeklyWithReasoning = {
    ...(generated.weekly || {}),
    _reasoning: generated.reasoning || "",
  };

  configs[index] = {
    ...config,
    strategyGoal: generated.strategyGoal || config.strategyGoal,
    strategyPillars: JSON.stringify(generated.pillars || []),
    strategyWeekly: JSON.stringify(weeklyWithReasoning),
  };
  await writeConfigs(configs);

  return NextResponse.json({ generated });
}
