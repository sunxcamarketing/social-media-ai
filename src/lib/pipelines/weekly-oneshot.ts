// ── Weekly Script Pipeline — One-Shot (Opus) ──────────────────────────────
// Replaces the 4-step pipeline (topic → hook → body → review) with a single
// Opus call. The model sees ALL context and decides the entire week coherently:
// topics, hooks, bodies, CTAs all in one output. Better coherence, fewer
// handoffs, no context loss between steps.

import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, WEEKLY_SCRIPTS_TOOL } from "@prompts";
import type {
  PipelineContext,
  VoiceContext,
  ResearchContext,
  AssembledScript,
  PostType,
  CtaType,
  FunnelStage,
} from "./weekly-steps";
import type { PatternType } from "@/lib/week-seed";

// ── Output schema (what Opus returns via tool_use) ──────────────────────

interface RawWeeklyScript {
  day: string;
  pillar: string;
  content_type: string;
  format: string;
  title: string;
  text_hook: string;
  hook: string;
  hook_pattern: string;
  body: string;
  cta: string;
  post_type: string; // "core" | "variant" | "test"
  reasoning: string;
}

interface RawWeeklyOutput {
  week_reasoning: string;
  scripts: RawWeeklyScript[];
}

// ── Build the user-prompt block — dense context dump ────────────────────

function buildUserPrompt(
  ctx: PipelineContext,
  voice: VoiceContext,
  research: ResearchContext,
): string {
  const lang = ctx.lang;
  const header = lang === "en"
    ? `# WEEK TO WRITE\n\nYou are writing ${ctx.activeDays.length} scripts for ${ctx.clientName}. One script per day, pillar + content type + format are fixed (see schedule). Everything else is yours to decide.`
    : `# WOCHE DIE DU SCHREIBST\n\nDu schreibst ${ctx.activeDays.length} Skripte für ${ctx.clientName}. Ein Skript pro Tag, Pillar + Content-Typ + Format sind fix (siehe Zeitplan). Alles andere entscheidest du.`;

  const scheduleHeader = lang === "en" ? "## WEEK SCHEDULE (fixed)" : "## WOCHENPLAN (fix)";
  const schedule = ctx.weekSchedule.map(s =>
    `- **${s.day}** — Pillar: "${s.pillar}"${s.pillarType ? ` [${s.pillarType}]` : ""} · Type: ${s.contentType} · Format: ${s.format} · CTA-Style: ${s.ctaType}/${s.funnelStage}${s.ctaExample ? ` (Beispiel: ${s.ctaExample})` : ""}`
  ).join("\n");

  const sections: string[] = [header, `\n${scheduleHeader}\n${schedule}`];

  // Client profile + brand
  if (ctx.clientContext) sections.push(`## CLIENT\n${ctx.clientContext}`);
  if (ctx.brandContext) sections.push(`## BRAND\n${ctx.brandContext}`);

  // Strategy
  if (ctx.pillarBlock) sections.push(`## CONTENT PILLARS\n${ctx.pillarBlock}`);

  // Voice
  if (voice.voiceBlock) sections.push(`## VOICE PROFILE\n${voice.voiceBlock}`);
  if (voice.structureBlock) sections.push(`## SCRIPT STRUCTURE PROFILE\n${voice.structureBlock}`);
  if (voice.voiceOnboardingBlock) sections.push(voice.voiceOnboardingBlock);

  // Audit
  if (ctx.auditBlock) sections.push(`## AUDIT\n${ctx.auditBlock}`);

  // Performance
  if (ctx.ownPerformanceBlock) sections.push(`## PERFORMANCE (own top videos)\n${ctx.ownPerformanceBlock}`);
  if (ctx.competitorHooksBlock) sections.push(`## COMPETITOR HOOKS\n${ctx.competitorHooksBlock}`);
  if (ctx.crossNicheBlock) sections.push(ctx.crossNicheBlock);
  if (ctx.anchorBlock) sections.push(ctx.anchorBlock);

  // Recent scripts (to avoid recycling)
  if (ctx.recentBlock) sections.push(`## RECENT SCRIPTS\n${ctx.recentBlock}`);
  if (ctx.usedPatternsBlock) {
    sections.push(
      lang === "en"
        ? `## HOOK-PATTERNS USED RECENTLY (prefer FRESH patterns)\n${ctx.usedPatternsBlock}`
        : `## HOOK-MUSTER DIE ZULETZT GENUTZT WURDEN (bevorzuge FRISCHE Muster)\n${ctx.usedPatternsBlock}`,
    );
  }

  // Research
  if (research.trendBlock) sections.push(research.trendBlock);
  if (research.learningsBlock) sections.push(research.learningsBlock);

  // Duration constraint
  if (ctx.avgDuration > 0) {
    const durationNote = ctx.durationIsAuditOverride
      ? (lang === "en"
        ? `## DURATION TARGET (from audit)\nTarget ~${ctx.avgDuration}s per video (${ctx.maxWords} words body+CTA max). Audit-defined — respect as hard ceiling.`
        : `## DAUER-ZIEL (aus Audit)\nZiel ~${ctx.avgDuration}s pro Video (${ctx.maxWords} Wörter Body+CTA max). Audit-definiert — als harte Obergrenze beachten.`)
      : (lang === "en"
        ? `## DURATION TARGET\nTarget ~${ctx.avgDuration}s per video (${ctx.maxWords} words body+CTA max).`
        : `## DAUER-ZIEL\nZiel ~${ctx.avgDuration}s pro Video (${ctx.maxWords} Wörter Body+CTA max).`);
    sections.push(durationNote);
  }

  const closingHeader = lang === "en"
    ? `## NOW WRITE\nCall submit_weekly_scripts with exactly ${ctx.activeDays.length} scripts, one per day in order (${ctx.activeDays.join(", ")}). Follow the week schedule — day, pillar, content_type and format must match exactly.`
    : `## JETZT SCHREIBEN\nRufe submit_weekly_scripts mit exakt ${ctx.activeDays.length} Skripten auf, eins pro Tag in Reihenfolge (${ctx.activeDays.join(", ")}). Folge dem Wochenplan — day, pillar, content_type und format müssen exakt übereinstimmen.`;
  sections.push(closingHeader);

  return sections.join("\n\n");
}

// ── Main entry point ────────────────────────────────────────────────────

export async function generateWeekScripts(
  ctx: PipelineContext,
  voice: VoiceContext,
  research: ResearchContext,
  claude: Anthropic,
): Promise<{ scripts: AssembledScript[]; weekReasoning: string }> {
  const numScripts = ctx.activeDays.length;
  const targetWords = ctx.maxWords || 180;

  const systemPrompt = buildPrompt("weekly-scripts", {
    platform_context: ctx.platformContext,
    num_scripts: String(numScripts),
    target_words: String(targetWords),
  }, ctx.lang);

  const userPrompt = buildUserPrompt(ctx, voice, research);

  const tool = WEEKLY_SCRIPTS_TOOL(numScripts);

  const response = await claude.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 16000, // Enough for ~5 full scripts with reasoning
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });

  const toolUseBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUseBlock) {
    throw new Error("Opus did not return a tool_use block");
  }

  const output = toolUseBlock.input as unknown as RawWeeklyOutput;
  if (!output.scripts || !Array.isArray(output.scripts)) {
    throw new Error("Opus tool output missing scripts array");
  }
  if (output.scripts.length !== numScripts) {
    console.warn(`[weekly-oneshot] expected ${numScripts} scripts, got ${output.scripts.length} — using what we have`);
  }

  // Map raw output onto AssembledScript — enrich with metadata from week schedule
  // (ctaType, funnelStage, patternType) that the schedule defines, not the model.
  const scripts: AssembledScript[] = output.scripts.map((raw, i) => {
    const scheduleSlot = ctx.weekSchedule[i];
    const normalizedPostType: PostType =
      raw.post_type === "core" || raw.post_type === "variant" || raw.post_type === "test"
        ? raw.post_type
        : "core";

    return {
      day: raw.day || scheduleSlot?.day || ctx.activeDays[i] || "",
      pillar: raw.pillar || scheduleSlot?.pillar || "",
      contentType: raw.content_type || scheduleSlot?.contentType || "",
      format: raw.format || scheduleSlot?.format || "",
      patternType: (scheduleSlot?.patternType || "contrast") as PatternType,
      postType: normalizedPostType,
      anchorRef: "",
      ctaType: (scheduleSlot?.ctaType || "soft") as CtaType,
      funnelStage: (scheduleSlot?.funnelStage || "MOF") as FunnelStage,
      title: raw.title || "",
      hook: raw.hook || "",
      hookPattern: raw.hook_pattern || "",
      body: raw.body || "",
      cta: raw.cta || "",
      reasoning: raw.reasoning || "",
    };
  });

  return { scripts, weekReasoning: output.week_reasoning || "" };
}
