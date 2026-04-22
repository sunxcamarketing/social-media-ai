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

// ── Weekly Scripts (One-Shot) ─────────────────────────────────────────────
// Single Opus call produces the entire week — topics, hooks, bodies, CTAs —
// in one coherent output. Replaces the old 4-step pipeline
// (topic-selection → hook-generation → body-writing → quality-review).

export const WEEKLY_SCRIPTS_TOOL = (numScripts: number) => ({
  name: "submit_weekly_scripts",
  description: "Reiche die fertige Content-Woche ein. Alle Skripte auf einmal — Themen, Hooks, Bodies, CTAs kohärent über die ganze Woche geplant.",
  input_schema: {
    type: "object" as const,
    properties: {
      week_reasoning: {
        type: "string",
        description: "2-3 Sätze: Welcher strategische Winkel für die Woche, welche Variation ist bewusst geplant.",
      },
      scripts: {
        type: "array" as const,
        minItems: numScripts,
        maxItems: numScripts,
        items: {
          type: "object" as const,
          properties: {
            day: {
              type: "string",
              description: "Mon/Tue/Wed/Thu/Fri/Sat/Sun — aus dem Wochenplan",
            },
            pillar: {
              type: "string",
              description: "Content-Pillar aus der Strategie",
            },
            content_type: {
              type: "string",
              description: "Content-Typ aus dem Wochenplan (z.B. Education, Authority, Story)",
            },
            format: {
              type: "string",
              description: "Format aus dem Wochenplan (z.B. Face-to-camera, Storytelling)",
            },
            title: {
              type: "string",
              description: "Titel, max 10 Wörter, exakt was das Video behandelt",
            },
            text_hook: {
              type: "string",
              description: "Text-Hook für Screen-Overlay — 3-5 Wörter, komprimierte Version des gesprochenen Hooks",
            },
            hook: {
              type: "string",
              description: "Gesprochener Hook, 1-2 Sätze. Erster Satz vor der Kamera.",
            },
            hook_pattern: {
              type: "string",
              description: "Eins der 8 Muster: Kontrast, Provokation, Neugier-Gap, Enttarnung, Direkt-Ansprache, Persönliche Szene, Listicle, Kontroverse Meinung",
            },
            body: {
              type: "string",
              description: "Gesprochener Body. Absätze mit \\n trennen. Jeder Absatz ein Gedanke. Zielwortzahl aus dem Prompt.",
            },
            cta: {
              type: "string",
              description: "Call to Action, 1-2 Sätze, eine konkrete Aktion.",
            },
            post_type: {
              type: "string",
              enum: ["core", "variant", "test"],
              description: "core = Haupt-These der Woche, variant = alternativer Winkel zu einer core-These, test = Experiment",
            },
            reasoning: {
              type: "string",
              description: "1-2 Sätze: Warum dieses Thema + warum dieser Hook basierend auf Audit/Performance/Strategie.",
            },
          },
          required: ["day", "pillar", "content_type", "format", "title", "text_hook", "hook", "hook_pattern", "body", "cta", "post_type", "reasoning"],
        },
      },
    },
    required: ["week_reasoning", "scripts"],
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

// ── Strategy Creation ─────────────────────────────────────────────────────

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
      textHookShort: { type: "string", description: "Text-Hook der kurzen Version — der Text der AUF DEM VIDEO eingeblendet wird. MAX 5 WÖRTER, knackig, Fragment statt Satz. Dieser Text wird als erstes gelesen und muss zum Stoppen zwingen." },
      textHookLong: { type: "string", description: "Text-Hook der langen Version — der Text der AUF DEM VIDEO eingeblendet wird. MAX 5 WÖRTER. Kann gleich oder leicht anders als Short sein." },
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
      textHookShort: { type: "string", description: "Text-Hook der kurzen Version (MAX 5 Wörter, Fragment)" },
      textHookLong: { type: "string", description: "Text-Hook der langen Version (MAX 5 Wörter, Fragment)" },
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
  description: "Liste alle Clients mit Name, Nische und Social-Media-Profilen. Nur für Admins.",
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
  description: "Generiere ein neues Skript (kurz + lang) mit dem Script Agent. Der Agent denkt über den besten Winkel nach, craftet Hooks, schreibt und reviewt das Skript selbst. Übergib conversation_context wenn du im Chat kreative Ideen oder Winkel erarbeitet hast.",
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
      conversation_context: { type: "string" as const, description: "Kreative Ideen, Winkel oder Analysen aus dem bisherigen Chat-Gespräch. Der Script Agent nutzt diese als Ausgangspunkt." },
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

export const AGENT_CHECK_LEARNINGS_TOOL = {
  name: "check_learnings",
  description: "Lade datengestützte Erkenntnisse: welche Hook-Patterns, Formate und Pillars performen gut oder schlecht. Nur statistisch verifizierte Insights.",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_SEARCH_WEB_TOOL = {
  name: "search_web",
  description: "Durchsuche das Web nach aktuellen Informationen. Nutze dies für: aktuelle Trends, News, saisonale Events, Branchenentwicklungen, Wettbewerber-News.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string" as const, description: "Suchbegriff — spezifisch und auf Deutsch" },
      market: { type: "string" as const, description: "Markt: de-DE (default), de-AT, de-CH" },
    },
    required: ["query"] as string[],
  },
};

export const AGENT_RESEARCH_TRENDS_TOOL = {
  name: "research_trends",
  description: "Recherchiere aktuelle Nischen-Trends aus dem Web. Liefert Ergebnisse aus mehreren Suchanfragen. Nutze dies wenn der Client nach Content-Ideen, aktuellen Themen oder Trends fragt.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      niche: { type: "string" as const, description: "Nische (z.B. 'Trading', 'Fitness', 'Business Coaching'). Wird automatisch aus dem Client-Profil geladen wenn nicht angegeben." },
    },
    required: [] as string[],
  },
};

export const AGENT_SAVE_IDEA_TOOL = {
  name: "save_idea",
  description: "Speichere eine Video-Idee (noch nicht ausgeschrieben) in die Ideen-Liste des Clients. Nur für frühe Ideen ohne Skript-Text. Wenn du ein fertiges Skript hast, nutze save_script.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      title: { type: "string" as const, description: "Titel der Video-Idee (kurz, max 10 Wörter)" },
      description: { type: "string" as const, description: "Beschreibung: Was soll das Video behandeln, welcher Angle?" },
      content_type: { type: "string" as const, description: "Optional: Content-Typ (z.B. Education, Storytelling, Authority)" },
    },
    required: ["title", "description"] as string[],
  },
};

export const AGENT_LIST_IDEAS_TOOL = {
  name: "list_ideas",
  description: "Liste alle gespeicherten Video-Ideen des Clients. Nutze das wenn der User auf eine bestehende Idee zurückgreifen will ('zeig mir meine Ideen', 'ich will die Idee von letzter Woche ausformulieren'). Optional nach Status filtern (idea, in-progress, done).",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      status: { type: "string" as const, description: "Optional: Status-Filter (idea, in-progress, done). Leer lassen für alle." },
      query: { type: "string" as const, description: "Optional: Stichwortsuche in Titel oder Beschreibung." },
    },
    required: [] as string[],
  },
};

export const AGENT_SAVE_SCRIPT_TOOL = {
  name: "save_script",
  description: "Speichere ein fertiges Skript direkt in den Skripte-Tab des Clients (NICHT nur als Idee). Nutze das nachdem du ein Skript im Chat ausgeschrieben hast und der User es behalten will, oder wenn der User selbst einen Skript-Text liefert und sagt 'speicher das'. Immer beide Versionen (short_script + long_script) mitgeben wenn vorhanden.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      title: { type: "string" as const, description: "Skript-Titel (max 10 Wörter)" },
      short_script: { type: "string" as const, description: "Kurzversion 30-40 Sek (ohne '── KURZ ──'-Marker, nur der reine Text inkl. Absätze)" },
      long_script: { type: "string" as const, description: "Langversion 60+ Sek (ohne '── LANG ──'-Marker, nur der reine Text inkl. Absätze)" },
      body: { type: "string" as const, description: "Alternative zu short_script/long_script: vollständiger Body mit beiden Versionen bereits formatiert. Nur nutzen wenn du den Rohtext 1:1 übernehmen sollst." },
      text_hook: { type: "string" as const, description: "Text-Hook der auf dem Screen eingeblendet wird (ein kurzer Satz)" },
      hook_pattern: { type: "string" as const, description: "Optional: Hook-Muster (z.B. Kontrast, Provokation, Neugier)" },
      pillar: { type: "string" as const, description: "Optional: Content-Pillar" },
      content_type: { type: "string" as const, description: "Optional: Content-Typ (Storytelling, Education, ...)" },
      format: { type: "string" as const, description: "Optional: Format (Reel, Talking Head, ...)" },
      cta: { type: "string" as const, description: "Optional: Call-to-Action Text" },
    },
    required: ["title"] as string[],
  },
};

// ── Voice Agent Tools (Gemini Function Declarations) ────────────────────
// Gemini Live API uses a different tool format than Anthropic.
// These are the subset of tools available during a voice session.

export const VOICE_AGENT_GEMINI_TOOLS = [
  {
    name: "load_client_context",
    description: "Lade das vollständige Client-Profil mit Brand, Strategie und Zielgruppe. Ruf das am Anfang der Session auf.",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "load_audit",
    description: "Lade den neuesten Audit-Report mit Stärken, Schwächen und Empfehlungen",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "check_performance",
    description: "Lade Performance-Daten: Top-Videos, Views, Hook-Patterns",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "check_learnings",
    description: "Lade datengestützte Erkenntnisse: welche Patterns funktionieren gut oder schlecht",
    parameters: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "save_idea",
    description: "Speichere eine Content-Idee die aus dem Gespräch entstanden ist",
    parameters: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const, description: "Titel der Video-Idee (max 10 Wörter)" },
        description: { type: "string" as const, description: "Beschreibung mit Kontext aus dem Gespräch" },
        content_type: { type: "string" as const, description: "Art des Contents: Storytelling, Meinung, Tipp, Erfahrung, Aufklärung" },
      },
      required: ["title", "description"],
    },
  },
];

export const AGENT_UPDATE_PROFILE_TOOL = {
  name: "update_profile",
  description: "Aktualisiere ein bestimmtes Feld im Client-Profil. Nutze das wenn der Client neue Infos über sich teilt und will dass du sie im Profil ergänzt.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      field_name: {
        type: "string" as const,
        description: "Welches Feld aktualisiert werden soll",
        enum: [
          "businessContext", "professionalBackground", "keyAchievements",
          "brandFeeling", "brandProblem", "brandingStatement",
          "humanDifferentiation", "providerRole", "providerBeliefs",
          "providerStrengths", "authenticityZone",
        ],
      },
      value: { type: "string" as const, description: "Neuer Wert für das Feld" },
    },
    required: ["field_name", "value"] as string[],
  },
};
