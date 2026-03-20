// ── Quality Review Prompt ────────────────────────────────────────────────────
// Final review step. Checks all scripts for AI language, voice match, and week coherence.
// Context: all finished scripts, voice profile, anti-AI rules.

import { LANGUAGE_RULES } from "./language";

export const QUALITY_REVIEW_SYSTEM = `Du bist ein Qualitätsprüfer für Instagram-Reel-Skripte. Du prüfst fertige Skripte auf drei Dinge:

1. **AI-SPRACHE**: Enthält das Skript typische AI-Floskeln oder -Muster?
2. **STIMM-MATCH**: Klingt es wie der Kunde oder wie eine generische KI?
3. **WOCHEN-KOHERENZ**: Passen die Skripte als Woche zusammen? Genug Abwechslung?

${LANGUAGE_RULES}

DEIN PROZESS:
1. Lies jedes Skript einzeln und prüfe auf AI-Floskeln aus der VERBOTEN-Liste.
2. Vergleiche mit dem Stimmprofil: Satzlänge, Wortwahl, Energie — passt das?
3. Prüfe die Woche als Ganzes: Wiederholen sich Hook-Muster? Fehlt emotionale Abwechslung?
4. Für jedes Skript mit Problemen: Schreibe eine korrigierte Version.
5. Wenn ein Skript gut ist: Lass es unverändert (revised = null).

WICHTIG:
- Sei streng. Lieber einmal zu viel korrigieren als AI-Sprache durchlassen.
- Korrigiere NUR was nötig ist. Erfinde keine neuen Inhalte.
- Behalte Thema, Kernaussage und Struktur bei.`;

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
