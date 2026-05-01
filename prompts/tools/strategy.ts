// ── Strategy & Weekly Ideas Tool Schemas ───────────────────────────────────
// Anthropic tool schemas for the strategy pipeline (analysis → creation →
// review) and the weekly-ideas one-shot.

// ── Strategy Pipeline Types ────────────────────────────────────────────────

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

// ── Weekly Ideas (One-Shot) ────────────────────────────────────────────────
// Single Opus call produces {{num_ideas}} sharp video ideas for the week.
// These are NOT full scripts — just titles + angles + hook directions + key
// points. The user picks which ideas to develop into full scripts via the
// Content Agent chat. Ideas that aren't developed are discarded (not saved).

export const WEEKLY_IDEAS_TOOL = (numIdeas: number) => ({
  name: "submit_weekly_ideas",
  description: "Reiche die fertigen Wochen-Ideen ein. Jede Idee ist eine scharfe, spezifische Video-Idee — kein ausgeschriebenes Skript. Der User wählt später welche Ideen er im Chat zu einem Skript ausformuliert.",
  input_schema: {
    type: "object" as const,
    properties: {
      week_reasoning: {
        type: "string",
        description: "2-3 Sätze: Welcher strategische Winkel für die Woche, welche Variation ist bewusst geplant.",
      },
      ideas: {
        type: "array" as const,
        minItems: numIdeas,
        maxItems: numIdeas,
        items: {
          type: "object" as const,
          properties: {
            day: {
              type: "string",
              description: "Mon/Tue/Wed/Thu/Fri/Sat/Sun — aus dem Wochenplan, in Reihenfolge",
            },
            pillar: {
              type: "string",
              description: "Content-Pillar aus der Strategie",
            },
            content_type: {
              type: "string",
              description: "Content-Typ aus dem Wochenplan",
            },
            format: {
              type: "string",
              description: "Format aus dem Wochenplan",
            },
            title: {
              type: "string",
              description: "Titel, max 10 Wörter, SPEZIFISCH (Zahl, Named-Thing, Contrarian-Marker oder konkrete Szene nötig)",
            },
            angle: {
              type: "string",
              description: "DIE These/Position der Idee in 1-2 Sätzen. Was ist das Kern-Argument?",
            },
            hook_direction: {
              type: "string",
              description: "Hook-Muster + kurze Richtung (z.B. 'Kontrast: Viele glauben X, Wahrheit ist Y'). KEIN ausformulierter Hook — nur die Richtung.",
            },
            key_points: {
              type: "array" as const,
              items: { type: "string" },
              minItems: 2,
              maxItems: 5,
              description: "2-5 Stichpunkte was im Video vorkommen soll. Wird später der Skript-Leitfaden.",
            },
            why_now: {
              type: "string",
              description: "1 Satz: datenbasierte Begründung aus Audit/Performance/Trends warum gerade DIESE Idee.",
            },
            emotion: {
              type: "string",
              description: "Primäre Emotion: Frust/Neugier/Überraschung/Empathie/Stolz/Klarheit (oder eine andere wenn passender)",
            },
          },
          required: ["day", "pillar", "content_type", "format", "title", "angle", "hook_direction", "key_points", "why_now", "emotion"],
        },
      },
    },
    required: ["week_reasoning", "ideas"],
  },
});

// ── Trend Research ─────────────────────────────────────────────────────────

export const TREND_RESEARCH_TOOL = {
  name: "submit_trends",
  description: "Die aus echten Suchergebnissen synthetisierten Trend-Themen einreichen",
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
            whyNow: { type: "string", description: "Warum ist das JETZT relevant? Referenziere konkrete Suchergebnisse. (1-2 Sätze)" },
            hookIdea: { type: "string", description: "Beispiel-Hook der dazu passen würde (1 Satz)" },
            sourceUrls: {
              type: "array" as const,
              items: { type: "string" },
              minItems: 1,
              description: "URLs aus den Suchergebnissen die diesen Trend belegen (mindestens 1)",
            },
            category: {
              type: "string" as const,
              enum: ["search_intent", "viral", "news", "pain_point", "pillar", "seasonal", "community_voices", "adjacent_market", "objection"],
              description: "Art des Trends — muss mit der Quelle übereinstimmen",
            },
          },
          required: ["topic", "angle", "whyNow", "hookIdea", "sourceUrls", "category"],
        },
        minItems: 6,
        maxItems: 12,
      },
      categoryMix: {
        type: "object" as const,
        properties: {
          distinctCategoriesUsed: { type: "number", description: "Anzahl unterschiedlicher Kategorien in deinen Trends. Muss >= 3 sein." },
        },
        required: ["distinctCategoriesUsed"],
      },
    },
    required: ["trends", "categoryMix"],
  },
};

// ── Strategy Analysis ──────────────────────────────────────────────────────

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
      beliefs: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            belief: {
              type: "string" as const,
              description: "Der Glaubenssatz der Zielgruppe, z.B. 'Ich hab schon alles versucht'",
            },
            counter: {
              type: "string" as const,
              description: "Wie der Client diesen Glaubenssatz brechen kann (1 Satz)",
            },
          },
          required: ["belief", "counter"],
        },
        minItems: 3,
        maxItems: 7,
        description: "3-7 Glaubenssätze/Hürden der Zielgruppe die der Content adressieren muss",
      },
      valueEquation: {
        type: "object" as const,
        properties: {
          dreamOutcome: { type: "string" as const, description: "Das Traum-Ergebnis der Zielgruppe in 1 Satz" },
          currentPain: { type: "string" as const, description: "Der aktuelle Schmerzpunkt der Zielgruppe in 1 Satz" },
          offerBridge: { type: "string" as const, description: "Wie das Angebot des Clients den Schmerzpunkt löst (1 Satz)" },
        },
        required: ["dreamOutcome", "currentPain", "offerBridge"],
        description: "Value Equation Analyse: Traum → Schmerz → Angebots-Brücke",
      },
    },
    required: ["insights", "topPerformingFormats", "topPerformingTypes", "avgViralDuration", "nichePatterns", "goal", "goalReasoning", "beliefs", "valueEquation"],
  },
};

// ── Strategy Creation ──────────────────────────────────────────────────────

export const STRATEGY_CREATION_TOOL = (activeDays: string[], contentTypes: string[], formats: string[]) => ({
  name: "submit_strategy",
  description: "Content Pillars, Wochenplan und Beispiel-Hooks einreichen",
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
              description: "Pillar-Name: 2-4 Wörter — frei gewählt, passend zur Marke",
            },
            pillarType: {
              type: "string" as const,
              enum: ["RESULT", "PROOF", "MECHANISM", "BELIEFS", "IDENTITY"],
              description: "Value-Equation-Typ: RESULT (Traumergebnis/Vision), PROOF (Cases/Zahlen/Vorher-Nachher), MECHANISM (System/Methode/Framework), BELIEFS (Glaubenssätze brechen, Fehler aufdecken), IDENTITY (Gründerin, Persönlichkeit, Story)",
            },
            offerLink: {
              type: "string" as const,
              description: "Wie verbindet dieser Pillar direkt zum Core Offer (z.B. 12-Wochen-Programm)? 1-2 Sätze. Pflicht — kein Pillar darf Selbstzweck sein.",
            },
            why: {
              type: "string" as const,
              description: "1 Satz: Warum dieser Pillar für dieses Ziel? Welchen Glaubenssatz bricht er?",
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
          required: ["name", "pillarType", "offerLink", "why", "subTopics"],
        },
        minItems: 4,
        maxItems: 5,
        description: "4-5 Content Pillars — mindestens 1 pro pillarType (RESULT/PROOF/MECHANISM/BELIEFS/IDENTITY), sofern 4+ Pillars gewünscht.",
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
                ctaType: {
                  type: "string" as const,
                  enum: ["soft", "lead", "authority", "none"],
                  description: "CTA-Typ: soft=Interaktion (Kommentar/Save/Share), lead=Funnel-Schritt (DM-Keyword/Call/Webinar), authority=Positionierung (kein direkter CTA aber Status-Signal), none=kein CTA",
                },
                ctaExample: {
                  type: "string" as const,
                  description: "Konkreter CTA-Satz in der Ziel-Content-Sprache (max 2 Sätze). Muss zum ctaType passen.",
                },
                funnelStage: {
                  type: "string" as const,
                  enum: ["TOF", "MOF", "BOF"],
                  description: "Funnel-Stufe: TOF=Top (Reach, neu entdeckt), MOF=Middle (Trust, Education), BOF=Bottom (Entscheidung, Offer-Berührung)",
                },
                reason: {
                  type: "string" as const,
                  description: "Datengestützte Begründung: Warum dieser Type/Format/CTA an diesem Tag? 1-2 Sätze. WICHTIG: Nenne NICHT welcher Pillar an diesem Tag gespielt wird — Pillars rotieren frei zur Laufzeit.",
                },
              },
              required: ["type", "format", "ctaType", "ctaExample", "funnelStage", "reason"],
            },
          ])
        ),
        required: activeDays,
        description: "Wochenplan: ein Eintrag pro aktivem Tag. MUSS enthalten: mindestens 2x ctaType='lead' (Funnel-Push), mindestens 2x ctaType='soft' (Interaktion), Rest authority/none. Mindestens 1x funnelStage='BOF' pro Woche.",
      },
      exampleHooks: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            hook: { type: "string" as const, description: "Der Hook-Text (1-2 Sätze)" },
            pillar: { type: "string" as const, description: "Zu welchem Pillar gehört dieser Hook?" },
            belief: { type: "string" as const, description: "Welchen Glaubenssatz adressiert dieser Hook?" },
          },
          required: ["hook", "pillar", "belief"],
        },
        minItems: 5,
        maxItems: 7,
        description: "5-7 Beispiel-Hooks die zur Nische, Zielgruppe und Core Offer passen",
      },
    },
    required: ["pillars", "weekly", "exampleHooks"],
  },
});

// ── Strategy Review ────────────────────────────────────────────────────────

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
                reason: {
                  type: "string" as const,
                  description: "Datengestützte Begründung (Pillars werden nicht an Tage gebunden)",
                },
              },
              required: ["type", "format", "reason"],
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
