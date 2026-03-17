import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, readVideos, readScripts, readTrainingScripts, readAnalyses } from "@/lib/csv";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";

export const maxDuration = 120;

// ── Audit report extraction ─────────────────────────────────────────────────

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

export function getAuditBlock(clientId: string): string {
  const analyses = readAnalyses()
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

function readStrategyJson() {
  const file = path.join(process.cwd(), "..", "data", "strategy.json");
  if (!existsSync(file)) return { customContentTypes: [], customFormats: [] };
  try { return JSON.parse(readFileSync(file, "utf-8")); } catch { return { customContentTypes: [], customFormats: [] }; }
}

// ── Main endpoint ───────────────────────────────────────────────────────────

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  // ── Client context ──────────────────────────────────────────────────────
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
    config.brandProblem && `Kernproblem das gelöst wird: ${config.brandProblem}`,
    config.brandingStatement && `Branding-Statement: ${config.brandingStatement}`,
    config.humanDifferentiation && `Menschliche Differenzierung: ${config.humanDifferentiation}`,
    config.providerRole && `Anbieter-Rolle: ${config.providerRole}`,
    config.providerBeliefs && `Überzeugungen: ${config.providerBeliefs}`,
    config.providerStrengths && `Stärken: ${config.providerStrengths}`,
    config.authenticityZone && `Authentizitätszone: ${config.authenticityZone}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession && `Traumkunden-Beruf: ${dreamCustomer.profession}`,
    dreamCustomer.values && `Traumkunden-Werte: ${dreamCustomer.values}`,
    customerProblems.mental && `Mentale Probleme: ${customerProblems.mental}`,
    customerProblems.financial && `Finanzielle Probleme: ${customerProblems.financial}`,
    customerProblems.social && `Soziale Probleme: ${customerProblems.social}`,
  ].filter(Boolean).join("\n");

  // ── Strategy ────────────────────────────────────────────────────────────
  const pillars: { name: string; subTopics?: string }[] = (() => {
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
    if (p.subTopics) line += `\n  Unterthemen: ${p.subTopics}`;
    return line;
  }).join("\n");

  // ── Audit report ────────────────────────────────────────────────────────
  const auditBlock = getAuditBlock(id);

  // ── Performance data ────────────────────────────────────────────────────
  const insights = parseInsights(config.performanceInsights || "");
  const ownTopVideos: VideoInsight[] = [
    ...(insights?.top30Days || []),
    ...(insights?.topAllTime || []),
  ];

  const allVideos = readVideos();
  const creatorVideos = allVideos
    .filter(v => v.configName === config.configName && v.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 6);

  const ownPerformanceBlock = ownTopVideos.length > 0
    ? `<own_top_videos>\n${ownTopVideos.slice(0, 5).map((v, i) => videoInsightBlock(v, i)).join("\n\n")}\n</own_top_videos>`
    : "";

  const creatorBlock = creatorVideos.length > 0
    ? `<competitor_videos>\n${creatorVideos.map((v, i) => {
        const lines = [`[${i + 1}] @${v.creator} · ${fmt(v.views)} Views${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""}`];
        if (v.analysis) {
          const getSection = (label: string) => {
            const m = v.analysis.match(new RegExp(`${label}[:\\s]+([\\s\\S]*?)(?=\\n[A-Z][\\w /]+[:\\s]|$)`, "i"));
            return m ? m[1].trim().slice(0, 150) : "";
          };
          const hook = getSection("HOOK");
          if (hook) lines.push(`Hook: ${hook}`);
        }
        return lines.join("\n");
      }).join("\n\n")}\n</competitor_videos>`
    : "";

  // ── Voice training ──────────────────────────────────────────────────────
  const clientTrainingScripts = readTrainingScripts().filter(ts => ts.clientId === id);
  const voiceBlock = clientTrainingScripts.length > 0
    ? `<voice_examples>\nSo spricht ${config.name || "der Kunde"} wirklich. Imitiere diesen Stil exakt — Wortwahl, Satzlänge, Energie, Sprechrhythmus.\n${clientTrainingScripts.slice(0, 6).map((ts, i) => `--- Beispiel ${i + 1}${ts.format ? ` (${ts.format})` : ""} ---\n${ts.script?.slice(0, 500) || ""}`).join("\n\n")}\n</voice_examples>`
    : "";

  // ── Existing scripts (avoid repetition) ─────────────────────────────────
  const existingScripts = readScripts().filter(s => s.clientId === id);
  const recentTitles = existingScripts.slice(-20).map(s => s.title).filter(Boolean);
  const recentBlock = recentTitles.length > 0
    ? `<already_covered>\nDiese Themen wurden bereits behandelt — vermeide sie:\n${recentTitles.map(t => `- ${t}`).join("\n")}\n</already_covered>`
    : "";

  // ── Duration info ───────────────────────────────────────────────────────
  const allDurations: number[] = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];
  const avgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;
  const maxWords = avgDuration > 0 ? Math.round(avgDuration * 2) : 0;

  // ── Tool schema ─────────────────────────────────────────────────────────
  const WEEK_SCRIPTS_TOOL = {
    name: "submit_week_scripts",
    description: "Die komplette Woche mit strategischen Video-Skripten einreichen",
    input_schema: {
      type: "object" as const,
      properties: {
        scripts: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: {
              day: { type: "string", enum: activeDays },
              pillar: { type: "string", enum: pillarNames.length > 0 ? pillarNames : undefined },
              contentType: { type: "string", enum: allContentTypes.map(t => t.name) },
              format: { type: "string", enum: allFormats.map(f => f.name) },
              title: { type: "string", description: "Konkreter Arbeitstitel (max 10 Wörter)" },
              hook: { type: "string", description: "Gesprochener Einstieg — max 1-2 Sätze. Muss sofort packen." },
              body: { type: "string", description: `Hauptteil als gesprochener Text. Absätze mit \\n trennen. Jeder Absatz = ein neuer Gedanke.${maxWords > 0 ? ` MAX ${maxWords} Wörter für Hook+Body+CTA zusammen.` : ""}` },
              cta: { type: "string", description: "Call to Action mit konkreter Kommentar-Aufforderung — max 1-2 Sätze." },
              reasoning: { type: "string", description: "STRATEGISCHE BEGRÜNDUNG: Welche Daten aus dem Audit/der Performance stützen dieses Skript? Warum genau dieses Thema, dieser Hook-Stil, dieses Format? 2-3 Sätze." },
            },
            required: ["day", "pillar", "contentType", "format", "title", "hook", "body", "cta", "reasoning"],
          },
          minItems: activeDays.length,
          maxItems: activeDays.length,
        },
      },
      required: ["scripts"],
    },
  };

  // ── Prompts ─────────────────────────────────────────────────────────────
  const systemPrompt = `Du bist ein Elite-Content-Stratege für Instagram Reels. Du erstellst eine KOMPLETTE strategische Woche — nicht einzelne Skripte im Vakuum.

DEIN ANSATZ:
1. Analysiere ALLE verfügbaren Daten: Audit-Report, Performance-Daten, Top-Videos, Competitor-Hooks, Brand-Positionierung.
2. Erstelle ${activeDays.length} Skripte die als WOCHE strategisch zusammenpassen: Abwechslung in Pillars, Hook-Stilen, emotionalen Registern.
3. Jedes Skript muss ein WARUM haben: Welche konkreten Daten aus dem Audit stützen diese Entscheidung?

QUALITÄTSREGELN:
- HOOK: Erste 1-2 Sätze. Muss den Zuschauer in 3 Sekunden packen. Provokante These, konkrete Zahl, oder direktes Problem ansprechen. KEINE Floskeln.
- BODY: Gesprochener Text. Jeder Absatz = ein NEUER Gedanke. Keine Wiederholungen. Konkrete Zahlen, Beispiele, Situationen.
- CTA: JEDES Skript braucht eine Kommentar-Aufforderung die Interaktion erzwingt. Nicht "Was denkst du?" sondern "A oder B? Schreib's in die Kommentare."
- SPRACHE: Gesprochenes Deutsch. Kurze Sätze. Direkte Anrede. Wie man redet, nicht schreibt.
- REASONING: Verweise auf KONKRETE Audit-Erkenntnisse. "Laut Audit performen Videos unter 25s 3x besser" statt "Kurze Videos sind gut".${maxWords > 0 ? `
- LÄNGE: Max ${maxWords} Wörter pro Skript (ca. ${fmtDuration(avgDuration)} Sprechzeit). Kürzer = besser.` : `
- LÄNGE: Max 30-60 Sekunden Sprechzeit pro Skript. Prägnant.`}`;

  const userPrompt = `<client_profile>
${clientContext}
</client_profile>

<brand_positioning>
${brandContext}
</brand_positioning>

<content_strategy>
CONTENT PILLARS:
${pillarBlock}

WOCHENPLAN (${postsPerWeek}×/Woche):
${weekSchedule.map(s => `${s.day}: Content-Type "${s.contentType}" | Format "${s.format}" | Pillar "${s.pillar}"`).join("\n")}
</content_strategy>

${auditBlock}

${ownPerformanceBlock}

${creatorBlock}

${voiceBlock}

${recentBlock}

AUFTRAG: Erstelle ${activeDays.length} strategische Video-Skripte für diese Woche. Eines pro Tag. Halte dich an den Wochenplan (Tag → Content-Type → Format → Pillar). Jedes Skript muss datenbasiert begründet sein.`;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: systemPrompt,
    tools: [WEEK_SCRIPTS_TOOL],
    tool_choice: { type: "tool", name: "submit_week_scripts" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "KI hat keine Skripte generiert." }, { status: 500 });
  }

  const input = toolUse.input as {
    scripts: Array<{
      day: string; pillar: string; contentType: string; format: string;
      title: string; hook: string; body: string; cta: string; reasoning: string;
    }>;
  };

  // Ensure day/pillar/type/format from schedule are used
  const scripts = input.scripts.map((s, i) => ({
    ...s,
    day: weekSchedule[i]?.day || s.day,
    pillar: s.pillar || weekSchedule[i]?.pillar || "",
    contentType: s.contentType || weekSchedule[i]?.contentType || "",
    format: s.format || weekSchedule[i]?.format || "",
  }));

  return NextResponse.json({
    scripts,
    _meta: {
      hasAudit: auditBlock.length > 0,
      ownVideosUsed: ownTopVideos.length,
      creatorVideosUsed: creatorVideos.length,
      trainingScriptsUsed: clientTrainingScripts.length,
      avgViralDurationSeconds: avgDuration || null,
      targetWords: maxWords || null,
    },
  });
}
