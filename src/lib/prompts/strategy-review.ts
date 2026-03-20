// ── Strategy Review Prompt ───────────────────────────────────────────────────
// Step 3 of strategy pipeline: Quality check the complete strategy.
// Context: complete strategy (goal, pillars, weekly), voice profile (optional), client brand summary.

export const STRATEGY_REVIEW_SYSTEM = `Du bist ein Strategie-Reviewer. Prüfe diese Content-Strategie auf Konsistenz, Vollständigkeit und Praxistauglichkeit.

DEIN PROZESS:
1. Lies das strategische Ziel und die Begründung.
2. Prüfe jeden Pillar: Unterstützt er das Ziel? Sind die SubTopics konkret und filmbar?
3. Prüfe den Wochenplan: Deckt er alle Pillars ab? Ist die Abwechslung gegeben?
4. Wenn ein Stimmprofil vorhanden: Passen die Formate zur Energie des Kunden?
5. Identifiziere Probleme und schlage Korrekturen vor.

PRÜF-KRITERIEN:
- ZIEL-KOHÄRENZ: Unterstützt jeder Pillar das gewählte Ziel? Ein "reach"-Ziel braucht andere Pillars als "trust" oder "revenue".
- FILMBARKEIT: Kann der Kunde morgen aufstehen und dieses Video drehen? Wenn nicht → zu abstrakt.
- PILLAR-ABDECKUNG: Jeder Pillar muss mindestens 1x in der Woche vorkommen. Kein Pillar darf ignoriert werden.
- CONTENT-TYPE-VIELFALT: Kein gleicher Content-Type an aufeinanderfolgenden Tagen.
- FORMAT-PASSUNG: Wenn Stimmprofil vorhanden — passt die Energie? Ein ruhiger, sachlicher Kunde braucht keine High-Energy-Challenges.
- ZIEL-COVERAGE: Für "reach" genug Viralitäts-Formate? Für "trust" genug Tiefe? Für "revenue" genug Offer-Sichtbarkeit?
- SUBTOPIC-QUALITÄT: Sind Titel spezifisch genug? "Trading Fehler" ist schlecht, "Warum dein Stop-Loss bei 2% Quatsch ist" ist gut.

BEWERTUNG:
- Wenn alles passt: Keine Korrekturen nötig, nur Assessment.
- Wenn Korrekturen nötig: Liefere die korrigierten Pillars und/oder Wochenplan.
- Kleine Probleme: Korrigiere sie direkt.
- Große Probleme (falsches Ziel, Pillars am Ziel vorbei): Klar benennen und komplett korrigieren.`;

export const STRATEGY_REVIEW_TOOL = (activeDays: string[]) => ({
  name: "submit_strategy_review",
  description: "Strategie-Review mit optionalen Korrekturen einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      issues: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            area: {
              type: "string" as const,
              enum: ["goal", "pillars", "weekly", "coherence"],
              description: "Bereich des Problems",
            },
            issue: {
              type: "string" as const,
              description: "Was ist das Problem? 1-2 Sätze.",
            },
            suggestion: {
              type: "string" as const,
              description: "Konkreter Verbesserungsvorschlag. 1-2 Sätze.",
            },
          },
          required: ["area", "issue", "suggestion"],
        },
        description: "Gefundene Probleme. Leeres Array wenn alles passt.",
      },
      revisedPillars: {
        type: ["array", "null"] as const,
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
            },
          },
          required: ["name", "why", "subTopics"],
        },
        description: "Korrigierte Pillars — nur wenn Korrekturen nötig, sonst null",
      },
      revisedWeekly: {
        type: ["object", "null"] as const,
        properties: Object.fromEntries(
          activeDays.map((day) => [
            day,
            {
              type: "object" as const,
              properties: {
                type: {
                  type: "string" as const,
                  description: "Content-Type für diesen Tag",
                },
                format: {
                  type: "string" as const,
                  description: "Format(e) für diesen Tag",
                },
                pillar: {
                  type: "string" as const,
                  description: "Welcher Pillar wird bedient",
                },
                reason: {
                  type: "string" as const,
                  description: "Datengestützte Begründung",
                },
              },
              required: ["type", "format", "pillar", "reason"],
            },
          ])
        ),
        description: "Korrigierter Wochenplan — nur wenn Korrekturen nötig, sonst null",
      },
      overallAssessment: {
        type: "string" as const,
        description: "Gesamtbewertung der Strategie in 2-3 Sätzen",
      },
    },
    required: ["issues", "revisedPillars", "revisedWeekly", "overallAssessment"],
  },
});
