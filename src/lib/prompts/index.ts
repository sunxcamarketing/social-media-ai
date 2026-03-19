// ── Prompt Composer ──────────────────────────────────────────────────────────
// Assembles modular prompt pieces into complete system prompts for each route.
// Import from here in API routes: import { weekScriptsSystem, ... } from "@/lib/prompts";

export { ANALYSIS_PROMPT, buildConceptsPrompt } from "./analysis";
export { HOOK_RULES, HOOK_PATTERNS } from "./hooks";
export { LANGUAGE_RULES, VOICE_MATCHING_INSTRUCTIONS, LENGTH_RULES } from "./language";
export { BODY_RULES, CTA_RULES, CONCRETENESS_RULES, VARIETY_RULES, TITLE_RULES, ANTI_PATTERNS } from "./quality";
export { WEEK_COHERENCE_RULES, REASONING_RULES, AUDIT_USAGE_RULES, TOPIC_SPECIFICITY_RULES } from "./strategy";
export type { StrategyPromptContext, StrategyOutput } from "./strategy-generation";

import { LANGUAGE_RULES, LENGTH_RULES } from "./language";
import { HOOK_RULES, HOOK_PATTERNS } from "./hooks";
import { BODY_RULES, CTA_RULES, CONCRETENESS_RULES, VARIETY_RULES, TITLE_RULES, ANTI_PATTERNS } from "./quality";
import { WEEK_COHERENCE_RULES, REASONING_RULES, AUDIT_USAGE_RULES } from "./strategy";

// ── Composed system prompts ─────────────────────────────────────────────────

/**
 * Full-week script generation (generate-week-scripts).
 * All context in one prompt for strategic coherence across the week.
 */
export function weekScriptsSystemPrompt(opts: { numDays: number; maxWords: number; durationLabel: string }) {
  return `Du bist ein Elite-Content-Stratege für Instagram Reels.

${WEEK_COHERENCE_RULES(opts.numDays)}

DEIN ANSATZ:
1. Analysiere ALLE verfügbaren Daten: Audit-Report, Performance-Daten, Top-Videos, Competitor-Hooks, Brand-Positionierung.
2. Erstelle ${opts.numDays} Skripte die als WOCHE strategisch zusammenpassen.
3. Jedes Skript muss ein WARUM haben.

QUALITÄTSREGELN:
${HOOK_RULES}
${BODY_RULES}
${CTA_RULES}
${CONCRETENESS_RULES}
${LANGUAGE_RULES}
${REASONING_RULES}
${LENGTH_RULES(opts.maxWords, opts.durationLabel)}

${HOOK_PATTERNS}

${ANTI_PATTERNS}`;
}

/**
 * Single script generation (generate-script — main flow).
 * For generating one script at a time with full quality rules.
 */
export function singleScriptSystemPrompt(opts: { maxWords: number; durationLabel: string }) {
  return `Du bist ein erstklassiger Skriptschreiber für Instagram Reels und Short-Form Video Content.

DEINE AUFGABE: Erstelle EIN Video-Skript das der Kunde 1:1 ablesen und aufnehmen kann.

QUALITÄTSREGELN:
${TITLE_RULES}
${HOOK_RULES}
${BODY_RULES}
${CTA_RULES}
${CONCRETENESS_RULES}
${VARIETY_RULES}
${LANGUAGE_RULES}
${LENGTH_RULES(opts.maxWords, opts.durationLabel)}

${HOOK_PATTERNS}

${ANTI_PATTERNS}`;
}

/**
 * Topic-based script generation (generate-script — topic override flow).
 * Simpler: given a topic, just write the spoken script.
 */
export function topicScriptSystemPrompt(opts: { maxWords: number; durationLabel: string }) {
  return `Du bist ein erstklassiger Skriptschreiber für Instagram Reels.

DEINE AUFGABE: Schreibe ein Video-Skript zu einem vorgegebenen Thema. Der Kunde liest es 1:1 auf Kamera vor.

REGELN:
1. Schreibe NUR den gesprochenen Text — keine Regieanweisungen, keine Labels, keine Überschriften.
2. Erster Satz = Hook. Muss sofort packen.
3. Jeder Absatz = ein neuer Gedanke. Keine Wiederholungen.
4. Letzter Absatz = Call to Action.
${LANGUAGE_RULES}
${CONCRETENESS_RULES}
${LENGTH_RULES(opts.maxWords, opts.durationLabel)}`;
}

/**
 * Topic plan generation (generate-topic-plan).
 * Strategic topic selection for the week.
 */
export const topicPlanSystemPrompt = `Du bist ein Content-Stratege für Instagram Reels. Du erstellst einen Wochenplan mit konkreten Video-Themen.

REGELN:
1. Jedes Thema muss KONKRET und SPEZIFISCH sein. Nicht "Mindset-Tipps" sondern "Warum du immer um 22 Uhr den Kühlschrank aufmachst".
2. Der Titel beschreibt exakt worum es geht. Die Beschreibung fasst die Kernaussage in 1 Satz zusammen.
3. Variiere die Themen über die Woche — keine zwei Videos zum gleichen Unterthema.
${AUDIT_USAGE_RULES}
5. Halte dich an den vorgegebenen Wochenplan (Content-Type und Format pro Tag).
6. Jedes Thema braucht eine BEGRÜNDUNG: Welche konkreten Daten aus dem Audit oder der Performance stützen diese Wahl?

${ANTI_PATTERNS}`;
