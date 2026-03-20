// ── Topic Selection Prompt ───────────────────────────────────────────────────
// Focused prompt for strategic topic selection.
// Context: audit + performance + strategy ONLY. No voice, no hooks, no body rules.

import { AUDIT_USAGE_RULES, TOPIC_SPECIFICITY_RULES } from "./scripting";
import { ANTI_PATTERNS } from "./quality";

export function topicSelectionSystemPrompt(numDays: number) {
  return `Du bist ein Content-Stratege für Instagram Reels. Deine EINZIGE Aufgabe: Wähle die ${numDays} strategisch besten Themen für diese Woche.

DEIN ANSATZ:
1. Lies den Audit-Report: Was funktioniert? Was nicht? Welche Sofort-Maßnahmen gibt es?
2. Lies die Performance-Daten: Welche eigenen Videos liefen am besten? Warum?
3. Lies die Competitor-Daten: Welche Themen und Hooks funktionieren in der Nische?
4. Wähle ${numDays} Themen die als WOCHE zusammenpassen: Abwechslung in Pillars, Emotionen und Formaten.

REGELN:
${TOPIC_SPECIFICITY_RULES}
${AUDIT_USAGE_RULES}
- Variiere die Themen über die Woche — keine zwei Videos zum gleichen Unterthema.
- Halte dich an den vorgegebenen Wochenplan (Content-Type und Format pro Tag).
- Jedes Thema braucht eine BEGRÜNDUNG: Welche konkreten Daten stützen diese Wahl?

${ANTI_PATTERNS}`;
}

export const TOPIC_SELECTION_TOOL = (days: string[], pillarNames: string[], contentTypeNames: string[], formatNames: string[]) => ({
  name: "submit_topics",
  description: "Die ausgewählten Wochenthemen einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      topics: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            day: { type: "string", enum: days },
            pillar: { type: "string", ...(pillarNames.length > 0 ? { enum: pillarNames } : {}) },
            contentType: { type: "string", ...(contentTypeNames.length > 0 ? { enum: contentTypeNames } : {}) },
            format: { type: "string", ...(formatNames.length > 0 ? { enum: formatNames } : {}) },
            title: { type: "string", description: "Konkreter Arbeitstitel (max 10 Wörter). SPEZIFISCH, nicht generisch." },
            description: { type: "string", description: "Kernaussage in 1 Satz — was lernt/fühlt der Zuschauer?" },
            reasoning: { type: "string", description: "Welche konkreten Daten aus Audit/Performance stützen diese Wahl? 1-2 Sätze." },
          },
          required: ["day", "pillar", "contentType", "format", "title", "description", "reasoning"],
        },
        minItems: days.length,
        maxItems: days.length,
      },
    },
    required: ["topics"],
  },
});
