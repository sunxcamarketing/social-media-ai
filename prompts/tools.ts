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

// ── Viral Script: Structure Extraction ───────────────────────────────────

export const VIRAL_STRUCTURE_TOOL = {
  name: "submit_structure",
  description: "Die Satz-für-Satz-Struktur des Referenz-Videos einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      sentences: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            text: { type: "string", description: "Der Original-Satz (oder Paraphrase wenn nicht verfügbar)" },
            role: {
              type: "string",
              enum: ["HOOK", "SOCIAL_PROOF", "PROBLEM", "AGITATION", "BRIDGE", "VALUE", "DOPAMINE_HIT", "ESCALATION", "CTA"],
              description: "Strukturelle Funktion dieses Satzes",
            },
            technique: { type: "string", description: "Welche psychologische Technik wird genutzt (z.B. Kontrasteffekt, Social Proof, Open Loop)" },
            contentDescription: { type: "string", description: "Was sagt der Satz INHALTLICH? Konkret beschreiben was der Satz thematisch tut. Z.B. 'Nennt 3 konkrete Fehler', 'Zeigt ein Vorher/Nachher-Ergebnis mit Zahlen', 'Stellt eine rhetorische Frage über das Kernproblem', 'Gibt Schritt 1 der Lösung'. Diese Beschreibung wird benutzt um den INHALT für eine andere Nische zu adaptieren." },
          },
          required: ["text", "role", "technique", "contentDescription"],
        },
        description: "Alle Sätze des Referenz-Videos in Reihenfolge",
      },
      pattern: {
        type: "string",
        description: "Das übergeordnete Strukturmuster (z.B. 'Hook → Proof → 3 Steps → CTA')",
      },
      hookType: {
        type: "string",
        description: "Art des Hooks (z.B. 'Provokative Behauptung', 'Kontrast', 'Versprechen', 'Neugier-Lücke')",
      },
      hookAnalysis: {
        type: "string",
        description: "Warum funktioniert dieser Hook? Was macht ihn stark? 1-2 Sätze.",
      },
      videoType: {
        type: "string",
        description: "Video-Art: z.B. 'Talking Head', 'Talking Head mit B-Roll', 'Screen Recording mit Voiceover', 'Listicle', 'Story/Anekdote', 'Vorher/Nachher'",
      },
      energy: {
        type: "string",
        description: "Energie und Tempo des Creators: z.B. 'schnell und energisch', 'ruhig und autoritär', 'locker und casual', 'ernst und direkt'",
      },
    },
    required: ["sentences", "pattern", "hookType", "hookAnalysis", "videoType", "energy"],
  },
};

// ── Viral Script: Adapted Script ─────────────────────────────────────────

export const VIRAL_ADAPT_TOOL = {
  name: "submit_adapted_script",
  description: "Das adaptierte Skript in kurzer und langer Version einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      textHookShort: { type: "string", description: "Text-Hook der kurzen Version — der Text der AUF DEM VIDEO eingeblendet wird (max 8 Wörter, groß, knackig). Dieser Text wird als erstes gelesen und muss zum Stoppen zwingen." },
      textHookLong: { type: "string", description: "Text-Hook der langen Version — der Text der AUF DEM VIDEO eingeblendet wird (max 8 Wörter). Kann gleich oder leicht anders als Short sein." },
      hookShort: { type: "string", description: "Gesprochener Hook der kurzen Version (1-2 Sätze, max 20 Wörter)" },
      bodyShort: { type: "string", description: "Body der kurzen Version. Nutze echte Zeilenumbrüche für Absätze." },
      ctaShort: { type: "string", description: "CTA der kurzen Version (1-2 Sätze)" },
      hookLong: { type: "string", description: "Gesprochener Hook der langen Version (1-2 Sätze)" },
      bodyLong: { type: "string", description: "Body der langen Version. Nutze echte Zeilenumbrüche für Absätze." },
      ctaLong: { type: "string", description: "CTA der langen Version (1-2 Sätze)" },
      title: { type: "string", description: "Arbeitstitel für das Skript (max 10 Wörter)" },
      videoType: { type: "string", description: "Video-Art die vom Original kopiert wird (z.B. 'Talking Head mit B-Roll Cuts', 'Screen Recording mit Voiceover', 'Listicle: 3 Tipps', 'Story/Anekdote'). MUSS identisch zum Original sein." },
      reasoning: { type: "string", description: "Welche Elemente des Originals wurden übernommen und warum (1-2 Sätze)" },
    },
    required: ["textHookShort", "textHookLong", "hookShort", "bodyShort", "ctaShort", "hookLong", "bodyLong", "ctaLong", "title", "videoType", "reasoning"],
  },
};

// ── Viral Script: Production Notes ───────────────────────────────────────

export const VIRAL_PRODUCTION_TOOL = {
  name: "submit_production_notes",
  description: "Einfache Shot-Liste: welche Shots müssen aufgenommen werden",
  input_schema: {
    type: "object" as const,
    properties: {
      shots: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            nr: { type: "number", description: "Shot-Nummer (1, 2, 3...)" },
            text: { type: "string", description: "Was wird gesagt in diesem Shot (der gesprochene Text)" },
            action: { type: "string", description: "Was tun? Konkretes Visual — z.B. 'Face to Camera, energisch', 'B-Roll: Laptop zeigen', 'Screenshot von App einblenden'" },
            onScreen: { type: "string", description: "Text der auf dem Video eingeblendet wird (Caption/Overlay). Leer wenn keiner." },
            duration: { type: "string", description: "Empfohlene Dauer (z.B. '2s', '3-4s')" },
          },
          required: ["nr", "text", "action", "duration"],
        },
        description: "Alle Shots die aufgenommen werden müssen, in Reihenfolge",
      },
      musicMood: {
        type: "string",
        description: "Empfohlene Musik-Stimmung (z.B. 'locker und motivierend', 'ruhig und ernst')",
      },
    },
    required: ["shots", "musicMood"],
  },
};

// ── Viral Script: Critic Agent ──────────────────────────────────────────

export const VIRAL_CRITIC_TOOL = {
  name: "submit_critique",
  description: "Bewertung des adaptierten Skripts einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      scoreShort: { type: "number", description: "Gesamtnote für die kurze Version (1-10)" },
      scoreLong: { type: "number", description: "Gesamtnote für die lange Version (1-10)" },
      issuesShort: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            what: { type: "string", description: "WAS ist falsch? Konkreter Satz oder Stelle zitieren." },
            why: { type: "string", description: "WARUM ist es falsch? Welches Kriterium wird verletzt?" },
            fix: { type: "string", description: "WIE sollte es besser sein? Konkreter Verbesserungsvorschlag." },
          },
          required: ["what", "why", "fix"],
        },
        description: "Konkrete Probleme in der kurzen Version",
      },
      issuesLong: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            what: { type: "string", description: "WAS ist falsch?" },
            why: { type: "string", description: "WARUM ist es falsch?" },
            fix: { type: "string", description: "WIE sollte es besser sein?" },
          },
          required: ["what", "why", "fix"],
        },
        description: "Konkrete Probleme in der langen Version",
      },
      passedShort: { type: "boolean", description: "true wenn scoreShort >= 8" },
      passedLong: { type: "boolean", description: "true wenn scoreLong >= 8" },
      summary: { type: "string", description: "1-2 Sätze Gesamtbewertung" },
    },
    required: ["scoreShort", "scoreLong", "issuesShort", "issuesLong", "passedShort", "passedLong", "summary"],
  },
};

// ── Viral Script: Revise (Writer reagiert auf Critic) ───────────────────

export const VIRAL_REVISE_TOOL = {
  name: "submit_revised_script",
  description: "Überarbeitetes Skript einreichen basierend auf Critic-Feedback",
  input_schema: {
    type: "object" as const,
    properties: {
      textHookShort: { type: "string", description: "Text-Hook der kurzen Version (max 8 Wörter)" },
      textHookLong: { type: "string", description: "Text-Hook der langen Version (max 8 Wörter)" },
      hookShort: { type: "string", description: "Überarbeiteter Hook kurz" },
      bodyShort: { type: "string", description: "Überarbeiteter Body kurz. Nutze echte Zeilenumbrüche." },
      ctaShort: { type: "string", description: "Überarbeiteter CTA kurz" },
      hookLong: { type: "string", description: "Überarbeiteter Hook lang" },
      bodyLong: { type: "string", description: "Überarbeiteter Body lang. Nutze echte Zeilenumbrüche." },
      ctaLong: { type: "string", description: "Überarbeiteter CTA lang" },
      changesApplied: { type: "string", description: "Welche Änderungen wurden vorgenommen? (1-3 Sätze)" },
    },
    required: ["textHookShort", "textHookLong", "hookShort", "bodyShort", "ctaShort", "hookLong", "bodyLong", "ctaLong", "changesApplied"],
  },
};

// ── Agent Tools (Unified Chat Agent) ──────────────────────────────────────
// All tools accept an optional client_name parameter.
// For clients: auto-scoped, client_name is ignored.
// For admins: client_name identifies which client's data to access.

const CLIENT_NAME_PROP = {
  type: "string" as const,
  description: "Name des Clients (z.B. 'Elliott', 'Max'). Für Admins: PFLICHT. Für Clients: wird ignoriert.",
} as const;

export const AGENT_LIST_CLIENTS_TOOL = {
  name: "list_clients",
  description: "Liste alle Clients mit Name, Nische und Instagram. Nur für Admins.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

export const AGENT_LOAD_CONTEXT_TOOL = {
  name: "load_client_context",
  description: "Lade das vollständige Profil, Branding, Strategie und Zielgruppe eines Clients",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_LOAD_VOICE_TOOL = {
  name: "load_voice_profile",
  description: "Lade das Voice Profile und die Skript-Struktur eines Clients",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_SEARCH_SCRIPTS_TOOL = {
  name: "search_scripts",
  description: "Suche in den bisherigen Skripten eines Clients",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      query: { type: "string" as const, description: "Suchbegriff (Titel, Pillar, Hook)" },
      pillar: { type: "string" as const, description: "Optional: Filter nach Content-Pillar" },
      limit: { type: "number" as const, description: "Maximale Anzahl Ergebnisse (default 10)" },
    },
    required: [] as string[],
  },
};

export const AGENT_CHECK_PERFORMANCE_TOOL = {
  name: "check_performance",
  description: "Lade Performance-Daten: Top-Videos, Ø Views, beste Hooks, Hook-Pattern-Verteilung",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_LOAD_AUDIT_TOOL = {
  name: "load_audit",
  description: "Lade den neuesten Audit-Report mit Stärken, Schwächen und Empfehlungen",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_GENERATE_SCRIPT_TOOL = {
  name: "generate_script",
  description: "Generiere ein neues Skript (kurz + lang) basierend auf einem Thema. IMMER vorher load_voice_profile aufrufen.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      title: { type: "string" as const, description: "Skript-Titel (max 10 Wörter)" },
      description: { type: "string" as const, description: "Kurzbeschreibung was das Skript behandelt" },
      pillar: { type: "string" as const, description: "Content-Pillar (z.B. aus der Strategie)" },
      contentType: { type: "string" as const, description: "Content-Typ (z.B. Edutainment, Storytelling)" },
      format: { type: "string" as const, description: "Format (z.B. Talking Head, Listicle)" },
      tone: { type: "string" as const, description: "Optional: Gewünschte Tonalität (provokant, ruhig, motivierend)" },
    },
    required: ["title", "description"] as string[],
  },
};

export const AGENT_CHECK_COMPETITORS_TOOL = {
  name: "check_competitors",
  description: "Lade analysierte Competitor-Videos mit Hooks, Views und Konzepten",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      limit: { type: "number" as const, description: "Maximale Anzahl Videos (default 10)" },
    },
    required: [] as string[],
  },
};
