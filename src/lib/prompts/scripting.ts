// ── Scripting & Reasoning Rules ─────────────────────────────────────────────
// Controls: audit-based reasoning, week coherence, data-driven decisions.
// Used in week-script and topic-plan generation.

export const WEEK_COHERENCE_RULES = (numDays: number) =>
  `Du erstellst eine KOMPLETTE strategische Woche mit ${numDays} Videos — nicht einzelne Skripte im Vakuum.
Die Woche als Ganzes muss strategisch sinnvoll sein: Abwechslung in Pillars, Hook-Stilen, und emotionalen Registern.
Kein Pillar darf dominieren. Kein Hook-Muster darf sich wiederholen.`;

export const REASONING_RULES = `- REASONING: Jedes Skript braucht eine STRATEGISCHE BEGRÜNDUNG.
- Verweise auf KONKRETE Audit-Erkenntnisse: "Laut Audit performen Videos unter 25s 3x besser" statt "Kurze Videos sind gut".
- Erkläre WARUM dieses Thema, WARUM dieser Hook-Stil, WARUM dieses Format.
- Die Begründung muss zeigen dass du die Daten gelesen hast — nicht nur geraten.`;

export const AUDIT_USAGE_RULES = `- Analysiere den Audit-Report gründlich: Was funktioniert? Was nicht? Welche Muster gibt es?
- Nutze die Performance-Daten: Welche Videos hatten die meisten Views? Warum?
- Nutze Competitor-Daten: Welche Hooks und Themen funktionieren in der Nische?
- Mehr von dem was funktioniert — aber mit NEUEM Winkel, nicht kopieren.`;

export const TOPIC_SPECIFICITY_RULES = `- Jedes Thema muss KONKRET und SPEZIFISCH sein.
- Nicht "Trading Fehler" sondern "Warum dein Stop-Loss bei 2% Quatsch ist".
- Nicht "Motivation" sondern "Was ich meinem 22-jährigen Ich sagen würde".
- Der Zuschauer muss am Titel erkennen was er lernt oder fühlt.`;
