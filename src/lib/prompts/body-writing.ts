// ── Body Writing Prompt ──────────────────────────────────────────────────────
// Focused prompt for writing the script body + CTA.
// Context: topic, hook (already chosen), voice profile, brand context, length rules.
// Does NOT receive: audit data, competitor data, hook patterns.

import { BODY_RULES, CTA_RULES, CONCRETENESS_RULES } from "./quality";
import { LANGUAGE_RULES, LENGTH_RULES } from "./language";

export function bodyWritingSystemPrompt(opts: { maxWords: number; durationLabel: string }) {
  return `Du schreibst den Hauptteil eines Instagram-Reel-Skripts. Der Hook steht bereits fest — du schreibst NUR Body und CTA.

DEINE AUFGABE:
1. Der Hook zieht den Zuschauer rein. Dein Body LÖST das offene Loop ein.
2. Jeder Absatz = ein neuer Gedanke. Keine Wiederholungen.
3. Am Ende: ein CTA der zur Interaktion zwingt.
4. Der Kunde liest den Text 1:1 auf Kamera vor.

QUALITÄTSREGELN:
${BODY_RULES}
${CTA_RULES}
${CONCRETENESS_RULES}
${LANGUAGE_RULES}
${LENGTH_RULES(opts.maxWords, opts.durationLabel)}

VOICE MATCHING:
Wenn ein Stimmprofil vorhanden ist, hat es HÖCHSTE PRIORITÄT.
Imitiere exakt: Wortwahl, Satzlänge, Energie, Sprechrhythmus.
Im Zweifel: Klingt es wie der Kunde oder wie ChatGPT? Wenn ChatGPT → umschreiben.`;
}

export const BODY_WRITING_TOOL = (maxWords: number) => ({
  name: "submit_body",
  description: "Body und CTA des Skripts einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      body: {
        type: "string",
        description: `Der Hauptteil als gesprochener Text. Absätze mit \\n trennen. Jeder Absatz = ein Gedanke.${maxWords > 0 ? ` MAX ${maxWords} Wörter für Body+CTA zusammen.` : ""}`,
      },
      cta: {
        type: "string",
        description: "Call to Action — max 1-2 Sätze. Konkrete Handlungsaufforderung die Interaktion erzwingt.",
      },
    },
    required: ["body", "cta"],
  },
});
