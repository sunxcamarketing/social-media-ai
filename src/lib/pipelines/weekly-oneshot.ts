// ── Weekly Ideas Pipeline — One-Shot (Opus) ───────────────────────────────
// Single Opus call produces the full week's *ideas* (not scripts). The
// model sees ALL context and decides the entire week coherently: topics,
// angles, hook directions, key points — all in one output.
//
// Ideas are NOT persisted to the Ideas tab. They appear inline on the
// Scripts page; the user chooses which ones to develop into full scripts
// via the Content Agent chat (see ideas/page.tsx for the chat-dialog pattern).

import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, WEEKLY_IDEAS_TOOL } from "@prompts";
import type { PipelineContext, VoiceContext, ResearchContext } from "./weekly-steps";

// ── Types ───────────────────────────────────────────────────────────────

export interface WeeklyIdea {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  angle: string;
  hookDirection: string;
  keyPoints: string[];
  whyNow: string;
  emotion: string;
}

interface RawWeeklyIdea {
  day: string;
  pillar: string;
  content_type: string;
  format: string;
  title: string;
  angle: string;
  hook_direction: string;
  key_points: string[];
  why_now: string;
  emotion: string;
}

interface RawWeeklyOutput {
  week_reasoning: string;
  ideas: RawWeeklyIdea[];
}

// ── Build the user-prompt block — dense context dump ────────────────────

function buildUserPrompt(
  ctx: PipelineContext,
  voice: VoiceContext,
  research: ResearchContext,
): string {
  const lang = ctx.lang;
  const header = lang === "en"
    ? `# WEEK TO PLAN\n\nYou are planning ${ctx.activeDays.length} video ideas for ${ctx.clientName}. One idea per day, pillar + content type + format are fixed (see schedule). Angle, title, hook direction are yours to decide.`
    : `# WOCHE DIE DU PLANST\n\nDu planst ${ctx.activeDays.length} Video-Ideen für ${ctx.clientName}. Eine Idee pro Tag, Pillar + Content-Typ + Format sind fix (siehe Zeitplan). Winkel, Titel, Hook-Richtung entscheidest du.`;

  const scheduleHeader = lang === "en" ? "## WEEK SCHEDULE (fixed)" : "## WOCHENPLAN (fix)";
  const schedule = ctx.weekSchedule.map(s =>
    `- **${s.day}** — Pillar: "${s.pillar}"${s.pillarType ? ` [${s.pillarType}]` : ""} · Type: ${s.contentType} · Format: ${s.format}`
  ).join("\n");

  const sections: string[] = [header, `\n${scheduleHeader}\n${schedule}`];

  if (ctx.clientContext) sections.push(`## CLIENT\n${ctx.clientContext}`);
  if (ctx.brandContext) sections.push(`## BRAND\n${ctx.brandContext}`);
  if (ctx.pillarBlock) sections.push(`## CONTENT PILLARS\n${ctx.pillarBlock}`);

  // Voice (lighter — ideas don't need to voice-match, scripts do)
  if (voice.voiceToneBlock) sections.push(`## VOICE SUMMARY\n${voice.voiceToneBlock}`);

  // Audit + performance
  if (ctx.auditBlock) sections.push(`## AUDIT\n${ctx.auditBlock}`);
  if (ctx.ownPerformanceBlock) sections.push(`## PERFORMANCE (own top videos)\n${ctx.ownPerformanceBlock}`);
  if (ctx.competitorHooksBlock) sections.push(`## COMPETITOR HOOKS\n${ctx.competitorHooksBlock}`);
  if (ctx.crossNicheBlock) sections.push(ctx.crossNicheBlock);
  if (ctx.anchorBlock) sections.push(ctx.anchorBlock);

  // Recent scripts (to avoid recycling ideas)
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

  const closingHeader = lang === "en"
    ? `## NOW DELIVER IDEAS\nCall submit_weekly_ideas with exactly ${ctx.activeDays.length} ideas, one per day in order (${ctx.activeDays.join(", ")}). Follow the week schedule — day, pillar, content_type and format must match exactly. Each idea must be SPECIFIC (number, named thing, contrarian marker, or concrete scene).`
    : `## JETZT IDEEN LIEFERN\nRufe submit_weekly_ideas mit exakt ${ctx.activeDays.length} Ideen auf, eine pro Tag in Reihenfolge (${ctx.activeDays.join(", ")}). Folge dem Wochenplan — day, pillar, content_type und format müssen exakt übereinstimmen. Jede Idee muss SPEZIFISCH sein (Zahl, Named-Thing, Contrarian-Marker oder konkrete Szene).`;
  sections.push(closingHeader);

  return sections.join("\n\n");
}

// ── Main entry point ────────────────────────────────────────────────────

export async function generateWeekIdeas(
  ctx: PipelineContext,
  voice: VoiceContext,
  research: ResearchContext,
  claude: Anthropic,
): Promise<{ ideas: WeeklyIdea[]; weekReasoning: string }> {
  const numIdeas = ctx.activeDays.length;

  const systemPrompt = buildPrompt("weekly-ideas", {
    platform_context: ctx.platformContext,
    num_ideas: String(numIdeas),
  }, ctx.lang);

  const userPrompt = buildUserPrompt(ctx, voice, research);

  const tool = WEEKLY_IDEAS_TOOL(numIdeas);

  const response = await claude.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 6000, // Ideas are much smaller than full scripts
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
  if (!output.ideas || !Array.isArray(output.ideas)) {
    throw new Error("Opus tool output missing ideas array");
  }

  const ideas: WeeklyIdea[] = output.ideas.map((raw, i) => {
    const slot = ctx.weekSchedule[i];
    return {
      day: raw.day || slot?.day || ctx.activeDays[i] || "",
      pillar: raw.pillar || slot?.pillar || "",
      contentType: raw.content_type || slot?.contentType || "",
      format: raw.format || slot?.format || "",
      title: raw.title || "",
      angle: raw.angle || "",
      hookDirection: raw.hook_direction || "",
      keyPoints: Array.isArray(raw.key_points) ? raw.key_points.slice(0, 5) : [],
      whyNow: raw.why_now || "",
      emotion: raw.emotion || "",
    };
  });

  return { ideas, weekReasoning: output.week_reasoning || "" };
}
