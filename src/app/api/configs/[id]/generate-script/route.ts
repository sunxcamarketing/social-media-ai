import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs, readVideosByConfig, readTrainingScripts, readScripts, readStrategyConfig } from "@/lib/csv";
import { getCurrentUser } from "@/lib/auth";
import { trackClaudeCost, type Initiator } from "@/lib/cost-tracking";
import { getVoiceProfile, voiceProfileToPromptBlock, getScriptStructure, scriptStructureToPromptBlock } from "@/lib/voice-profile";
import { getAuditBlock } from "@/lib/audit";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import { buildPrompt } from "@prompts";
import { safeJsonParse } from "@/lib/safe-json";
import { fmt, fmtDuration, secondsToWords } from "@/lib/format";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";

export const maxDuration = 90;

function parseInsights(raw: string): PerformanceInsights | null {
  return safeJsonParse<PerformanceInsights | null>(raw, null);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function videoInsightBlock(v: VideoInsight, index: number): string {
  return [
    `[${index + 1}] ${fmt(v.views)} Views · ${fmt(v.likes)} Likes · ${v.datePosted}${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""}`,
    v.topic         && `Thema: ${v.topic}`,
    v.audioHook && v.audioHook !== "none" && `Audio-Hook: "${v.audioHook}"`,
    v.textHook  && v.textHook  !== "none" && `Text-Hook: "${v.textHook}"`,
    v.scriptSummary  && `Zusammenfassung: ${v.scriptSummary}`,
    v.whyItWorked    && `Warum erfolgreich: ${v.whyItWorked}`,
  ].filter(Boolean).join("\n");
}


function buildScriptTool(opts: {
  withTypeFields: boolean;
  pillarNames?: string[];
  contentTypeNames?: string[];
  formatNames?: string[];
  maxWords?: number;
}) {
  const { withTypeFields, pillarNames, contentTypeNames, formatNames, maxWords } = opts;
  return {
    name: "submit_script",
    description: "Das fertige Video-Skript einreichen",
    input_schema: {
      type: "object" as const,
      properties: {
        ...(withTypeFields ? {
          pillar:      {
            type: "string",
            description: "Einer der definierten Content-Pillars",
            ...(pillarNames?.length ? { enum: pillarNames } : {}),
          },
          contentType: {
            type: "string",
            description: "Der Content-Typ aus der Strategie",
            ...(contentTypeNames?.length ? { enum: contentTypeNames } : {}),
          },
          format:      {
            type: "string",
            description: "Das Video-Format aus der Strategie",
            ...(formatNames?.length ? { enum: formatNames } : {}),
          },
        } : {}),
        title: {
          type: "string",
          description: "Kurzer Arbeitstitel (max 10 Wörter) der das konkrete Thema des Skripts beschreibt. MUSS zum Inhalt passen.",
        },
        hook: {
          type: "string",
          description: "Der gesprochene Einstieg — max 1-2 Sätze. Muss sofort Aufmerksamkeit erzeugen. Keine Floskeln.",
        },
        body: {
          type: "string",
          description: `Der Hauptteil des Skripts als gesprochener Text. Absätze mit \\n trennen. Jeder Absatz = ein Gedanke. Keine Wiederholungen. Konkret und spezifisch, nicht abstrakt.${maxWords ? ` MAX ${maxWords} Wörter für Hook+Body+CTA zusammen.` : ""}`,
        },
        cta: {
          type: "string",
          description: "Call to Action — max 1-2 Sätze. Klare Handlungsaufforderung.",
        },
        reasoning: {
          type: "string",
          description: "1 Satz: Warum dieses Thema und dieser Ansatz gewählt wurde",
        },
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
  const configs = await readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getCurrentUser();
  const initiator: Initiator = user?.role === "client" ? "client" : "admin";
  const userId = user?.id || null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const hint: string = body.hint || "";
  const topicOverride: { day: string; pillar: string; contentType: string; format: string; title: string; description: string } | null =
    body.topicOverride || null;
  const dayOverride: { day: string; contentType: string; format: string; pillar: string } | null =
    body.dayOverride || null;

  // ══════════════════════════════════════════════════════════════════════════
  // TOPIC-BASED GENERATION (from 2-step flow: topic plan → script)
  // Returns a single "script" field — the complete spoken text.
  // ══════════════════════════════════════════════════════════════════════════
  if (topicOverride) {
    return handleTopicScript(id, config, topicOverride, hint, apiKey, initiator, userId);
  }

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
    config.providerRole      && `Anbieter-Rolle: ${config.providerRole}`,
    config.providerBeliefs   && `Überzeugungen: ${config.providerBeliefs}`,
    config.authenticityZone  && `Authentizitätszone: ${config.authenticityZone}`,
    config.humanDifferentiation && `Einzigartigkeit: ${config.humanDifferentiation}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
    dreamCustomer.profession  && `Traumkunden-Beruf: ${dreamCustomer.profession}`,
  ].filter(Boolean).join("\n");

  // ── Strategy ──────────────────────────────────────────────────────────────
  const pillars: { name: string; subTopics?: string; description?: string }[] = safeJsonParse(config.strategyPillars, []);
  const weekly: Record<string, { type: string; format: string }> = safeJsonParse(config.strategyWeekly);

  const strategyJson = await readStrategyConfig();
  const allContentTypes = [...BUILT_IN_CONTENT_TYPES, ...(strategyJson.customContentTypes || [])];
  const allFormats = [...BUILT_IN_FORMATS, ...(strategyJson.customFormats || [])];

  const pillarNames = pillars.map(p => p.name);
  const contentTypeNames = allContentTypes.map(t => t.name);
  const formatNames = allFormats.map(f => f.name);

  const postsPerWeek = parseInt(config.postsPerWeek || "5", 10);

  const pillarBlock = pillars.length > 0
    ? pillars.map(p => {
        let line = `- ${p.name}`;
        if (p.subTopics) line += `\n  Unterthemen: ${p.subTopics}`;
        if (p.description) line += `\n  ${p.description}`;
        return line;
      }).join("\n")
    : "(keine Pillars definiert)";

  // ── Performance data ──────────────────────────────────────────────────────
  const insights = parseInsights(config.performanceInsights || "");
  const ownTopVideos: VideoInsight[] = [
    ...(insights?.top30Days  || []),
    ...(insights?.topAllTime || []),
  ];

  const creatorVideos = (await readVideosByConfig(config.configName))
    .filter(v => v.views > 0)
    .slice(0, 6);

  // ── Duration: compute hard word limit ────────────────────────────────────
  const allDurations: number[] = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];

  const avgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;

  const maxWords = avgDuration > 0 ? secondsToWords(avgDuration) : 0;

  // ── Audit report ─────────────────────────────────────────────────────────
  const auditBlock = await getAuditBlock(id);

  // ── Existing scripts to avoid repetition ──────────────────────────────────
  const existingScripts = (await readScripts()).filter(s => s.clientId === id);
  const recentTitles = existingScripts.slice(-15).map(s => s.title).filter(Boolean);
  const recentTopics = recentTitles.length > 0
    ? `\nBEREITS ERSTELLT (vermeide diese Themen):\n${recentTitles.map(t => `- ${t}`).join("\n")}`
    : "";

  // ── Voice + Script Structure: prefer cached profiles ─────────────────────
  const voiceProfile = await getVoiceProfile(id);
  const scriptStructure = await getScriptStructure(id);
  const clientTrainingScripts = voiceProfile ? [] : (await readTrainingScripts()).filter(ts => ts.clientId === id);
  const voiceBlock = voiceProfile
    ? voiceProfileToPromptBlock(voiceProfile, config.name || "der Kunde")
    : clientTrainingScripts.length > 0 ? `
<voice_examples>
Die folgenden Transkripte zeigen, wie ${config.name || "der Kunde"} wirklich spricht. Imitiere diesen Stil exakt — Wortwahl, Satzlänge, Energie, Sprechrhythmus.
${clientTrainingScripts.slice(0, 8).map((ts, i) => {
  return `--- Beispiel ${i + 1}${ts.format ? ` (${ts.format})` : ""} ---
${(ts.script || "").slice(0, 2000)}`;
}).join("\n\n")}
</voice_examples>` : "";
  const structureBlock = scriptStructure
    ? scriptStructureToPromptBlock(scriptStructure)
    : "";

  // ── Performance context blocks ────────────────────────────────────────────
  const ownPerformanceBlock = ownTopVideos.length > 0 ? `
<own_performance>
${ownTopVideos.slice(0, 5).map((v, i) => videoInsightBlock(v, i)).join("\n\n")}
</own_performance>` : "";

  const creatorBlock = creatorVideos.length > 0 ? `
<competitor_videos>
${creatorVideos.map((v, i) => {
  const lines = [
    `[${i + 1}] @${v.creator} · ${fmt(v.views)} Views${v.durationSeconds ? ` · ${fmtDuration(v.durationSeconds)}` : ""}`,
  ];
  if (v.analysis) {
    const getSection = (label: string) => {
      const m = v.analysis.match(new RegExp(`${label}[:\\s]+([\\s\\S]*?)(?=\\n[A-Z][\\w /]+[:\\s]|$)`, "i"));
      return m ? m[1].trim().slice(0, 150) : "";
    };
    const hook = getSection("HOOK");
    if (hook) lines.push(`Hook: ${hook}`);
  }
  return lines.join("\n");
}).join("\n\n")}
</competitor_videos>` : "";

  const client = new Anthropic({ apiKey });

  // ── Build tool with enum constraints ────────────────────────────────────
  const withTypeFields = !dayOverride;
  const SCRIPT_TOOL = buildScriptTool({
    withTypeFields,
    pillarNames: withTypeFields ? pillarNames : undefined,
    contentTypeNames: withTypeFields ? contentTypeNames : undefined,
    formatNames: withTypeFields ? formatNames : undefined,
    maxWords: maxWords || undefined,
  });

  // ── System prompt: role + rules ─────────────────────────────────────────
  const durationLabel = avgDuration > 0 ? fmtDuration(avgDuration) : "";
  const laengeRegeln = maxWords > 0
    ? `- LÄNGE: Max ${maxWords} Wörter gesamt (Hook+Body+CTA). Das entspricht ca. ${durationLabel} Sprechzeit. Kürzer ist besser.`
    : `- LÄNGE: Instagram Reels sind kurz. Max 30-60 Sekunden Sprechzeit. Prägnant.`;
  const lang: "de" | "en" = config.language === "en" ? "en" : "de";
  const systemPrompt = buildPrompt("single-script", {
    laenge_regeln: laengeRegeln,
  }, lang);

  // ── User prompt: context + task ─────────────────────────────────────────
  const dayOverrideBlock = dayOverride
    ? `AUFTRAG: Schreibe ein Skript für ${dayOverride.day}.
Content-Type: ${dayOverride.contentType}
Format: ${dayOverride.format}
Pillar: ${dayOverride.pillar}
Wähle ein konkretes Unterthema aus diesem Pillar.`
    : `AUFTRAG: Wähle den besten Pillar, Content-Type und Format für das nächste Skript. Basiere die Entscheidung auf den Performance-Daten und was noch nicht abgedeckt wurde.`;

  const userPrompt = `<client>
${clientContext}
</client>

<strategy>
CONTENT PILLARS (wähle NUR aus diesen):
${pillarBlock}

WOCHENPLAN (${postsPerWeek}×/Woche):
${Object.entries(weekly).map(([day, d]) => `${day}: ${d.type} | ${d.format}`).join("\n")}
</strategy>
${ownPerformanceBlock}${creatorBlock}${auditBlock}${voiceBlock}${structureBlock}${recentTopics}
${hint ? `\nHINWEIS: ${hint}` : ""}

${dayOverrideBlock}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: systemPrompt,
    tools: [SCRIPT_TOOL],
    tool_choice: { type: "tool", name: "submit_script" },
    messages: [{ role: "user", content: userPrompt }],
  });
  trackClaudeCost({ usage: message.usage, model: "claude-sonnet-4-6", clientId: id, userId, operation: "script_gen", initiator });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "KI hat kein Skript generiert. Bitte erneut versuchen." }, { status: 500 });
  }

  let result = toolUse.input as {
    pillar?: string; contentType?: string; format?: string; title: string;
    hook: string; body: string; cta: string; reasoning: string;
  };

  if (dayOverride) {
    result = {
      ...result,
      pillar:      dayOverride.pillar,
      contentType: dayOverride.contentType,
      format:      dayOverride.format,
    };
  }

  // ── Auto-shorten if over limit ──────────────────────────────────────────
  if (maxWords > 0) {
    const totalWords = countWords(result.hook) + countWords(result.body) + countWords(result.cta);
    if (totalWords > maxWords * 1.1) {
      const shortenMsg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: systemPrompt,
        tools: [SCRIPT_TOOL],
        tool_choice: { type: "tool", name: "submit_script" },
        messages: [
          { role: "user", content: userPrompt },
          { role: "assistant", content: message.content },
          {
            role: "user", content: [{
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: lang === "en"
              ? `Accepted, but too long: ${totalWords} words (max ${maxWords}). Shorten it radically. Cut repetition and filler. Keep title, hook angle and CTA.`
              : `Akzeptiert, aber zu lang: ${totalWords} Wörter (max ${maxWords}). Kürze es radikal. Streiche Wiederholungen und Füllwörter. Behalte Titel, Hook-Ansatz und CTA.`,
            }],
          },
        ],
      });
      trackClaudeCost({ usage: shortenMsg.usage, model: "claude-sonnet-4-6", clientId: id, userId, operation: "script_shorten", initiator });

      const shortenedTool = shortenMsg.content.find((b) => b.type === "tool_use");
      if (shortenedTool && shortenedTool.type === "tool_use") {
        result = shortenedTool.input as typeof result;
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
      trainingScriptsUsed: clientTrainingScripts.length,
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Topic-based script generation (2-step flow)
// ══════════════════════════════════════════════════════════════════════════════

async function handleTopicScript(
  clientId: string,
  config: Awaited<ReturnType<typeof readConfigs>>[0],
  topic: { day: string; pillar: string; contentType: string; format: string; title: string; description: string },
  hint: string,
  apiKey: string,
  initiator: Initiator,
  userId: string | null,
) {
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
    config.providerRole      && `Anbieter-Rolle: ${config.providerRole}`,
    config.authenticityZone  && `Authentizitätszone: ${config.authenticityZone}`,
    dreamCustomer.description && `Traumkunde: ${dreamCustomer.description}`,
  ].filter(Boolean).join("\n");

  // Voice + Structure: prefer cached profiles
  const topicVoiceProfile = await getVoiceProfile(clientId);
  const topicScriptStructure = await getScriptStructure(clientId);
  const topicTrainingScripts = topicVoiceProfile ? [] : (await readTrainingScripts()).filter(ts => ts.clientId === clientId);
  const voiceBlock = topicVoiceProfile
    ? "\n" + voiceProfileToPromptBlock(topicVoiceProfile, config.name || "der Kunde")
    : topicTrainingScripts.length > 0
      ? `\n<voice_examples>\nSo spricht ${config.name || "der Kunde"} wirklich. Imitiere diesen Stil exakt:\n${topicTrainingScripts.slice(0, 6).map((ts, i) => `--- ${i + 1} ---\n${(ts.script || "").slice(0, 2000)}`).join("\n\n")}\n</voice_examples>`
      : "";
  const topicStructureBlock = topicScriptStructure
    ? "\n" + scriptStructureToPromptBlock(topicScriptStructure)
    : "";

  // Audit report
  const topicAuditBlock = await getAuditBlock(clientId);

  // Duration
  const insights = parseInsights(config.performanceInsights || "");
  const ownTopVideos: VideoInsight[] = [...(insights?.top30Days || []), ...(insights?.topAllTime || [])];
  const creatorVideos = (await readVideosByConfig(config.configName))
    .filter(v => v.views > 0)
    .slice(0, 6);
  const allDurations = [
    ...ownTopVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
    ...creatorVideos.filter(v => v.durationSeconds > 0).map(v => v.durationSeconds),
  ];
  const avgDuration = allDurations.length > 0
    ? Math.round(allDurations.reduce((a, b) => a + b, 0) / allDurations.length)
    : 0;
  const maxWords = avgDuration > 0 ? secondsToWords(avgDuration) : 0;

  const TOPIC_SCRIPT_TOOL = {
    name: "submit_script",
    description: "Das fertige gesprochene Skript einreichen",
    input_schema: {
      type: "object" as const,
      properties: {
        script: {
          type: "string",
          description: `Das KOMPLETTE gesprochene Skript. Alles was man auf Kamera vorliest — vom ersten bis zum letzten Wort. Absätze mit \\n trennen.${maxWords > 0 ? ` MAX ${maxWords} Wörter.` : ""}`,
        },
      },
      required: ["script"],
    },
  };

  const topicDurationLabel = avgDuration > 0 ? fmtDuration(avgDuration) : "";
  const topicLaengeRegeln = maxWords > 0
    ? `- LÄNGE: Max ${maxWords} Wörter gesamt (Hook+Body+CTA). Das entspricht ca. ${topicDurationLabel} Sprechzeit. Kürzer ist besser.`
    : `- LÄNGE: Instagram Reels sind kurz. Max 30-60 Sekunden Sprechzeit. Prägnant.`;
  const topicLang: "de" | "en" = config.language === "en" ? "en" : "de";
  const systemPrompt = buildPrompt("topic-script", {
    laenge_regeln: topicLaengeRegeln,
  }, topicLang);

  const userPrompt = `<client>
${clientContext}
</client>
${topicAuditBlock}
${voiceBlock}${topicStructureBlock}
${hint ? `\nHINWEIS: ${hint}` : ""}

THEMA: ${topic.title}
BESCHREIBUNG: ${topic.description}
Content-Type: ${topic.contentType} | Format: ${topic.format} | Pillar: ${topic.pillar}

Schreibe jetzt das Skript zu genau diesem Thema.`;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    system: systemPrompt,
    tools: [TOPIC_SCRIPT_TOOL],
    tool_choice: { type: "tool", name: "submit_script" },
    messages: [{ role: "user", content: userPrompt }],
  });
  trackClaudeCost({ usage: message.usage, model: "claude-sonnet-4-6", clientId, userId, operation: "script_gen_topic", initiator });

  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return NextResponse.json({ error: "KI hat kein Skript generiert." }, { status: 500 });
  }

  const input = toolUse.input as { script: string };
  let scriptText = input.script || "";

  // Auto-shorten if needed
  if (maxWords > 0 && countWords(scriptText) > maxWords * 1.1) {
    const shortenMsg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      tools: [TOPIC_SCRIPT_TOOL],
      tool_choice: { type: "tool", name: "submit_script" },
      messages: [
        { role: "user", content: userPrompt },
        { role: "assistant", content: message.content },
        {
          role: "user", content: [{
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: topicLang === "en"
              ? `Too long: ${countWords(scriptText)} words (max ${maxWords}). Shorten radically.`
              : `Zu lang: ${countWords(scriptText)} Wörter (max ${maxWords}). Kürze radikal.`,
          }],
        },
      ],
    });
    trackClaudeCost({ usage: shortenMsg.usage, model: "claude-sonnet-4-6", clientId, userId, operation: "script_shorten_topic", initiator });
    const shortened = shortenMsg.content.find((b) => b.type === "tool_use");
    if (shortened && shortened.type === "tool_use") {
      scriptText = (shortened.input as { script: string }).script || scriptText;
    }
  }

  return NextResponse.json({
    title: topic.title,
    pillar: topic.pillar,
    contentType: topic.contentType,
    format: topic.format,
    script: scriptText,
    hook: "",
    body: scriptText,
    cta: "",
    _meta: {
      actualWords: countWords(scriptText),
      targetWords: maxWords || null,
      avgViralDurationSeconds: avgDuration || null,
      trainingScriptsUsed: topicTrainingScripts.length,
    },
  });
}
