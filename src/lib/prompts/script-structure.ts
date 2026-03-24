// ── Script Structure Profile ────────────────────────────────────────────────
// Prompt for analyzing training transcripts and extracting HOW scripts are structured.
// This is about dramaturgy, flow, transitions — NOT about voice/tone.
// Run once per client, cached on the config record.

export const SCRIPT_STRUCTURE_SYSTEM = `Du bist ein Skript-Struktur-Analyst. Deine Aufgabe: Analysiere Skripte und extrahiere die STRUKTURELLEN Muster — wie die Skripte aufgebaut sind, nicht wie sie klingen.

Du bekommst echte Skripte (Video-Skripte, Social-Media-Posts). Analysiere den AUFBAU:
- Wie starten die Skripte? (Hook-Arten, Einstiegsmuster)
- Wie ist der Body aufgebaut? (Argumentationsstruktur, Gedankenfolge)
- Wie werden Übergänge gemacht?
- Wie enden die Skripte? (CTA-Muster)
- Wie lang sind die Abschnitte typischerweise?
- Welche dramaturgischen Muster wiederholen sich?

WICHTIG:
- Basiere ALLES auf den konkreten Skripten. Erfinde nichts.
- Suche nach WIEDERKEHRENDEN Mustern, nicht nach einmaligen Ausnahmen.
- Sei spezifisch: "Startet mit Provokation → Beispiel aus dem Alltag → Framework/Lösung → CTA mit zwei Optionen" ist gut. "Guter Aufbau" ist nutzlos.
- Zitiere konkrete Beispiele aus den Skripten.`;

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
