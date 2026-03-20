// ── Strategy Analysis Prompt ─────────────────────────────────────────────────
// Step 1 of strategy pipeline: Analyze all data and determine the strategic goal.
// Context: full audit report, full performance data, full competitor data, client profile.

import { AUDIT_USAGE_RULES } from "./scripting";

export const STRATEGY_ANALYSIS_SYSTEM = `Du bist ein Daten-Analyst und Strategie-Berater für Instagram. Deine Aufgabe: Analysiere alle verfügbaren Daten und bestimme das strategische Ziel.

DEIN PROZESS:
1. Lies den KOMPLETTEN Audit-Report — nicht überfliegen, jede Sektion.
2. Lies die Performance-Daten: Welche eigenen Videos liefen am besten? Welche Formate, Längen, Themen?
3. Lies die Competitor-Daten: Was funktioniert in der Nische? Welche Muster gibt es?
4. Identifiziere Lücken: Was machen Competitor aber der Kunde nicht?
5. Bestimme das strategische Ziel basierend auf den Daten.

ANALYSE-REGELN:
${AUDIT_USAGE_RULES}
- Jedes Insight braucht einen KONKRETEN Datenpunkt. "Videos unter 25s haben 3x mehr Views" nicht "Kurze Videos sind besser".
- Keine vagen Aussagen. Zahlen, Prozente, Vergleiche.
- Muster erkennen: Was haben die Top-Videos gemeinsam? Was haben die Flops gemeinsam?
- Competitor-Muster: Welche Hooks, Formate, Themen dominieren die Nische?

ZIEL-ENTSCHEIDUNG:
- "reach" → Wenn Sichtbarkeit das Hauptproblem ist: niedrige Views, wenig Reichweite, kaum neue Follower.
- "trust" → Wenn Engagement das Hauptproblem ist: Views sind okay aber Kommentare/Saves/Shares fehlen. Community interagiert nicht.
- "revenue" → Wenn Community stark ist aber kein Angebot sichtbar: gutes Engagement, loyale Follower, aber keine Conversion-Inhalte.
- Das Ziel muss sich aus den DATEN ergeben — nicht geraten werden.`;

export const STRATEGY_ANALYSIS_TOOL = {
  name: "submit_analysis",
  description: "Daten-Analyse und strategisches Ziel einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      insights: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            category: {
              type: "string" as const,
              enum: ["performance", "audit", "competitor", "gap"],
              description: "Kategorie des Insights",
            },
            insight: {
              type: "string" as const,
              description: "Das Insight in 1-2 Sätzen",
            },
            dataPoint: {
              type: "string" as const,
              description: "Der konkrete Datenpunkt der dieses Insight stützt (Zahl, Prozent, Vergleich)",
            },
            implication: {
              type: "string" as const,
              description: "Was bedeutet das für die Strategie? 1 Satz.",
            },
          },
          required: ["category", "insight", "dataPoint", "implication"],
        },
        minItems: 5,
        description: "Mindestens 5 datengestützte Insights",
      },
      topPerformingFormats: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Die 2-4 Formate die am besten performen (aus eigenen + Competitor-Daten)",
      },
      topPerformingTypes: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Die 2-4 Content-Types die am besten performen",
      },
      avgViralDuration: {
        type: ["number", "null"] as const,
        description: "Durchschnittliche Dauer der Top-Videos in Sekunden, oder null wenn keine Daten",
      },
      nichePatterns: {
        type: "string" as const,
        description: "2-3 Sätze: Welche übergreifenden Muster gibt es in der Nische?",
      },
      goal: {
        type: "string" as const,
        enum: ["reach", "trust", "revenue"],
        description: "Das strategische Ziel basierend auf der Analyse",
      },
      goalReasoning: {
        type: "string" as const,
        description: "2-3 Sätze: Warum dieses Ziel? Welche Daten sprechen dafür?",
      },
    },
    required: ["insights", "topPerformingFormats", "topPerformingTypes", "avgViralDuration", "nichePatterns", "goal", "goalReasoning"],
  },
};
