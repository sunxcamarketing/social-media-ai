// ── Consolidated Tool Schemas ──────────────────────────────────────────────
// All Anthropic tool schemas for structured output, consolidated from
// individual prompt files. Tool schemas need TypeScript constructs
// (type: "object" as const), so they stay in code while prompt text
// lives in markdown files.

// ── Strategy Pipeline Types ───────────────────────────────────────────────

export interface StrategyPromptContext {
  clientContext: string;
  contentTypeList: string;
  formatList: string;
  postsPerWeek: number;
  activeDays: string[];
  auditBlock: string;
  performanceBlock: string;
  competitorBlock: string;
  trainingBlock: string;
}

export interface StrategyOutput {
  strategyGoal: "reach" | "trust" | "revenue";
  reasoning: string;
  pillars: { name: string; subTopics: string }[];
  weekly: Record<string, { type: string; format: string; reason: string }>;
}

// ── Topic Selection ───────────────────────────────────────────────────────

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

// ── Hook Generation ───────────────────────────────────────────────────────

export const HOOK_GENERATION_TOOL = {
  name: "submit_hooks",
  description: "Die 3 Hook-Optionen und die Auswahl einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      options: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            hook: { type: "string", description: "Der gesprochene Hook-Text (1-2 Sätze)" },
            pattern: { type: "string", description: "Welches Hook-Muster wurde verwendet (z.B. KONTRAST, PROVOKATION)" },
          },
          required: ["hook", "pattern"],
        },
        minItems: 3,
        maxItems: 3,
      },
      selected: {
        type: "number",
        description: "Index (0-2) der besten Option",
      },
      selectionReason: {
        type: "string",
        description: "Warum diese Option die stärkste ist (1 Satz)",
      },
    },
    required: ["options", "selected", "selectionReason"],
  },
};

// ── Body Writing ──────────────────────────────────────────────────────────

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

// ── Quality Review ────────────────────────────────────────────────────────

export const QUALITY_REVIEW_TOOL = (numScripts: number) => ({
  name: "submit_review",
  description: "Das Review-Ergebnis für alle Skripte einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      scripts: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            index: { type: "number", description: "Index des Skripts (0-basiert)" },
            issues: {
              type: "array" as const,
              items: { type: "string" },
              description: "Gefundene Probleme (leer wenn keine)",
            },
            revised: {
              type: "object" as const,
              properties: {
                hook: { type: "string", description: "Korrigierter Hook (nur wenn nötig)" },
                body: { type: "string", description: "Korrigierter Body (nur wenn nötig)" },
                cta: { type: "string", description: "Korrigierter CTA (nur wenn nötig)" },
              },
              description: "Korrigierte Version — null/undefined wenn keine Korrektur nötig",
            },
          },
          required: ["index", "issues"],
        },
        minItems: numScripts,
        maxItems: numScripts,
      },
      weekCoherence: {
        type: "string",
        description: "Bewertung der Woche als Ganzes: Abwechslung, Balance, Verbesserungsvorschläge (1-2 Sätze)",
      },
    },
    required: ["scripts", "weekCoherence"],
  },
});

// ── Voice Profile ─────────────────────────────────────────────────────────

export const VOICE_PROFILE_TOOL = {
  name: "submit_voice_profile",
  description: "Das extrahierte Stimmprofil einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      avgSentenceLength: {
        type: "number",
        description: "Durchschnittliche Wörter pro Satz (aus den Transkripten gezählt)",
      },
      favoriteWords: {
        type: "array" as const,
        items: { type: "string" },
        description: "Lieblingswörter und -phrasen die häufig vorkommen (10-20 Stück)",
      },
      avoidedPatterns: {
        type: "array" as const,
        items: { type: "string" },
        description: "Muster die diese Person NICHT nutzt (z.B. 'kein Konjunktiv', 'keine Fremdwörter')",
      },
      tone: {
        type: "string",
        description: "Tonalität in 2-3 präzisen Adjektiven mit Erklärung (z.B. 'konfrontativ-locker: stellt Behauptungen auf, relativiert dann mit Humor')",
      },
      energy: {
        type: "string",
        description: "Energie-Level und Rhythmus (z.B. 'hoch, schnell, stakkato-artig mit kurzen Pausen')",
      },
      sentencePatterns: {
        type: "string",
        description: "Typische Satzbau-Muster (z.B. 'Startet mit Behauptung, dann Beispiel, dann rhetorische Frage')",
      },
      slangMarkers: {
        type: "array" as const,
        items: { type: "string" },
        description: "Slang, Dialekt, Jugendsprache, Anglizismen die verwendet werden",
      },
      exampleSentences: {
        type: "array" as const,
        items: { type: "string" },
        description: "5 besonders charakteristische Original-Sätze aus den Transkripten (wörtlich zitiert)",
      },
      summary: {
        type: "string",
        description: "2-3 Sätze die den Sprechstil so beschreiben, dass jemand ihn imitieren könnte",
      },
    },
    required: [
      "avgSentenceLength", "favoriteWords", "avoidedPatterns", "tone",
      "energy", "sentencePatterns", "slangMarkers", "exampleSentences", "summary",
    ],
  },
};

// ── Script Structure ──────────────────────────────────────────────────────

export const SCRIPT_STRUCTURE_TOOL = {
  name: "submit_script_structure",
  description: "Das extrahierte Skript-Struktur-Profil einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      hookPatterns: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            pattern: { type: "string", description: "Name des Hook-Musters (z.B. 'Provokative Behauptung', 'Alltags-Situation')" },
            description: { type: "string", description: "Wie dieses Muster funktioniert, mit Beispiel aus den Skripten" },
            frequency: { type: "string", description: "Wie oft kommt es vor? (häufig/mittel/selten)" },
            example: { type: "string", description: "Wörtliches Beispiel aus einem Skript" },
          },
          required: ["pattern", "description", "frequency", "example"],
        },
        description: "Die 3-6 häufigsten Hook-Einstiegsmuster",
      },
      bodyStructures: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string", description: "Name der Struktur (z.B. 'Problem → Lösung → Beweis')" },
            steps: {
              type: "array" as const,
              items: { type: "string" },
              description: "Die einzelnen Schritte/Abschnitte dieser Struktur",
            },
            example: { type: "string", description: "Zusammenfassung eines konkreten Skripts das diesem Muster folgt" },
          },
          required: ["name", "steps", "example"],
        },
        description: "Die 2-4 häufigsten Body-Aufbau-Muster",
      },
      transitionPatterns: {
        type: "array" as const,
        items: { type: "string" },
        description: "Typische Übergangstechniken zwischen Abschnitten (z.B. 'Rhetorische Frage als Brücke', 'Direkter Kontrast mit Aber')",
      },
      ctaPatterns: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            pattern: { type: "string", description: "CTA-Muster (z.B. 'Zwei-Optionen-Frage')" },
            example: { type: "string", description: "Wörtliches Beispiel" },
          },
          required: ["pattern", "example"],
        },
        description: "Die 2-4 häufigsten CTA-Muster",
      },
      avgParagraphs: {
        type: "number",
        description: "Durchschnittliche Anzahl Absätze/Gedanken pro Skript (Body ohne Hook und CTA)",
      },
      dramaturgicFlow: {
        type: "string",
        description: "Der typische emotionale Bogen über ein Skript hinweg (z.B. 'Spannung → Schmerz → Erleichterung → Handlung')",
      },
      keyRules: {
        type: "array" as const,
        items: { type: "string" },
        description: "5-8 konkrete Regeln die sich aus den Mustern ableiten lassen (z.B. 'Nie mehr als 2 Absätze ohne konkretes Beispiel', 'CTA immer als Frage mit 2 Optionen')",
      },
      summary: {
        type: "string",
        description: "3-4 Sätze die den Skript-Aufbau so beschreiben, dass jemand ein neues Skript im gleichen Stil strukturieren könnte",
      },
    },
    required: [
      "hookPatterns", "bodyStructures", "transitionPatterns", "ctaPatterns",
      "avgParagraphs", "dramaturgicFlow", "keyRules", "summary",
    ],
  },
};

// ── Trend Research ────────────────────────────────────────────────────────

export const TREND_RESEARCH_TOOL = {
  name: "submit_trends",
  description: "Die identifizierten Trend-Themen einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      trends: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            topic: { type: "string", description: "Konkretes Thema (max 10 Wörter)" },
            angle: { type: "string", description: "Spezifischer Winkel/Perspektive für ein Video" },
            whyNow: { type: "string", description: "Warum ist das JETZT relevant? (1 Satz)" },
            hookIdea: { type: "string", description: "Beispiel-Hook der dazu passen würde (1 Satz)" },
          },
          required: ["topic", "angle", "whyNow", "hookIdea"],
        },
        minItems: 5,
        maxItems: 8,
      },
    },
    required: ["trends"],
  },
};

// ── Strategy Analysis ─────────────────────────────────────────────────────

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

// ── Strategy Creation ─────────────────────────────────────────────────────

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

// ── Strategy Review ───────────────────────────────────────────────────────

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
