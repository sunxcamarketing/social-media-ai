// ── Voice & Script Structure Tool Schemas ──────────────────────────────────
// Tools for extracting a client's voice profile and script structure from
// training transcripts, plus the Gemini Live function declarations for the
// voice-interview agent (which uses a different tool format than Anthropic).

// ── Voice Profile ──────────────────────────────────────────────────────────

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

// ── Script Structure ───────────────────────────────────────────────────────

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

// ── Voice Agent Tools (Gemini Function Declarations) ───────────────────────
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
