// ── Strategy Creation Prompt ─────────────────────────────────────────────────
// Step 2 of strategy pipeline: Create content pillars with video ideas and weekly plan.
// Context: goal + insights from Step 1, client brand info, content types, formats, schedule.

import { TOPIC_SPECIFICITY_RULES } from "./scripting";
import { CONCRETENESS_RULES } from "./quality";

export function strategyCreationSystemPrompt(opts: {
  postsPerWeek: number;
  activeDays: string[];
  contentTypes: string[];
  formats: string[];
}) {
  return `Du bist ein Content-Architekt für Instagram. Erstelle Content Pillars mit konkreten Video-Ideen und einen optimalen Wochenplan.

KONTEXT:
- ${opts.postsPerWeek} Posts pro Woche
- Aktive Tage: ${opts.activeDays.join(", ")}
- Verfügbare Content-Types: ${opts.contentTypes.join(", ")}
- Verfügbare Formate: ${opts.formats.join(", ")}

DEIN PROZESS:
1. Lies das Ziel und die Analyse-Insights aus Step 1.
2. Erstelle 3-5 Content Pillars die das Ziel unterstützen.
3. Fülle jeden Pillar mit 4-6 konkreten Video-Ideen (Titel + Winkel).
4. Erstelle einen Wochenplan der alle Pillars abdeckt.

PILLAR-REGELN:
- Pillar-Namen: 2-4 Wörter. Klar und einprägsam.
- Jeder Pillar hat ein WARUM: Wie unterstützt er das strategische Ziel?
- Jeder Pillar verbindet sich mit Problemen des Traumkunden ODER Expertise des Kunden.
- SubTopics sind KONKRETE Video-Titel — nicht generische Ideen.
${TOPIC_SPECIFICITY_RULES}

WOCHENPLAN-REGELN:
- Nutze EXAKT die Namen aus Content-Types und Formate (keine eigenen erfinden).
- Formate können kombiniert werden mit " + " (z.B. "Talking Head + B-Roll").
- Jeder Pillar muss mindestens 1x in der Woche vorkommen.
- Kein gleicher Content-Type an aufeinanderfolgenden Tagen.
- Jeder Tag braucht eine datengestützte Begründung: WARUM dieser Type/Format an diesem Tag?

QUALITÄTSREGELN:
${CONCRETENESS_RULES}`;
}

export const STRATEGY_CREATION_TOOL = (activeDays: string[], contentTypes: string[], formats: string[]) => ({
  name: "submit_strategy",
  description: "Content Pillars und Wochenplan einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      pillars: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: {
              type: "string" as const,
              description: "Pillar-Name: 2-4 Wörter",
            },
            why: {
              type: "string" as const,
              description: "1 Satz: Warum dieser Pillar für dieses Ziel?",
            },
            subTopics: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  title: {
                    type: "string" as const,
                    description: "Konkreter Video-Titel, max 10 Wörter",
                  },
                  angle: {
                    type: "string" as const,
                    description: "Spezifischer Winkel in 1 Satz",
                  },
                },
                required: ["title", "angle"],
              },
              minItems: 4,
              maxItems: 6,
              description: "4-6 konkrete Video-Ideen pro Pillar",
            },
          },
          required: ["name", "why", "subTopics"],
        },
        minItems: 3,
        maxItems: 5,
        description: "3-5 Content Pillars",
      },
      weekly: {
        type: "object" as const,
        properties: Object.fromEntries(
          activeDays.map((day) => [
            day,
            {
              type: "object" as const,
              properties: {
                type: {
                  type: "string" as const,
                  ...(contentTypes.length > 0 ? { enum: contentTypes } : {}),
                  description: "Exakter Name aus der Content-Types-Liste",
                },
                format: {
                  type: "string" as const,
                  description: "Exakter Name aus der Formate-Liste. Mehrere mit ' + ' kombinierbar.",
                },
                pillar: {
                  type: "string" as const,
                  description: "Welcher Pillar wird an diesem Tag bedient",
                },
                reason: {
                  type: "string" as const,
                  description: "Datengestützte Begründung: Warum dieser Type/Format an diesem Tag?",
                },
              },
              required: ["type", "format", "pillar", "reason"],
            },
          ])
        ),
        required: activeDays,
        description: "Wochenplan: ein Eintrag pro aktivem Tag",
      },
    },
    required: ["pillars", "weekly"],
  },
});
