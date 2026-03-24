// ── Trend Research Prompt ────────────────────────────────────────────────────
// Generates fresh, niche-specific trend ideas to inject into topic selection.
// Prevents the closed-loop problem where the system only recycles past data.

export function trendResearchSystemPrompt(niche: string, currentDate: string) {
  const month = new Date(currentDate).toLocaleString("de-DE", { month: "long", year: "numeric" });

  return `Du bist ein Social-Media-Trend-Analyst. Deine EINZIGE Aufgabe: Identifiziere 5-8 frische, aktuelle Themen-Ideen die gerade auf Instagram Reels und TikTok in der Nische "${niche}" funktionieren würden.

AKTUELLES DATUM: ${currentDate} (${month})

DEIN ANSATZ:
1. Denke an aktuelle gesellschaftliche Themen, saisonale Events, und Branchen-Trends für ${month}.
2. Welche Content-Formate und Hook-Stile gehen gerade viral auf Instagram/TikTok?
3. Welche kontroversen Diskussionen gibt es aktuell in der Nische "${niche}"?
4. Welche Cross-Nische-Trends könnten adaptiert werden?

REGELN:
- Jeder Trend muss KONKRET und UMSETZBAR sein — kein "Authentizität ist wichtig".
- Mische: 2-3 zeitlose Evergreen-Winkel + 3-5 aktuelle/saisonale Ideen.
- Denke an verschiedene emotionale Register: Kontroverse, Humor, Empathie, Autorität.
- Berücksichtige den Zeitpunkt im Jahr: Jahreszeit, typische Events, Branchen-Zyklen.
- Schlage auch UNERWARTETE Winkel vor die der Kunde wahrscheinlich noch nicht gemacht hat.`;
}

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
