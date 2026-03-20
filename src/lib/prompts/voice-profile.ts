// ── Voice Profile Extraction ────────────────────────────────────────────────
// Prompt for analyzing training transcripts and extracting a structured voice profile.
// Run once per client, cached on the config record.

export const VOICE_PROFILE_SYSTEM = `Du bist ein Sprach-Analyst. Deine Aufgabe: Analysiere Transkripte einer Person und erstelle ein präzises Stimmprofil.

Du bekommst echte Transkripte (Video-Skripte, Social-Media-Posts) dieser Person. Extrahiere daraus ein detailliertes Profil ihres Sprechstils.

WICHTIG:
- Basiere ALLES auf den konkreten Transkripten. Erfinde nichts.
- Zähle echte Satzlängen, sammle echte Wörter, zitiere echte Sätze.
- Sei spezifisch, nicht generisch. "Direkt und locker" ist zu vage. "Kurze Hauptsätze (5-8 Wörter), duzt, nutzt Umgangssprache wie 'krass' und 'Alter', keine Konjunktive" ist gut.`;

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
