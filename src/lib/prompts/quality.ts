// ── Script Quality Rules ────────────────────────────────────────────────────
// Controls: body structure, CTA style, concreteness, variety.
// Shared across single-script and week-script generation.

export const BODY_RULES = `- BODY: Jeder Absatz bringt einen NEUEN Gedanken. Keine Wiederholungen. Keine Umformulierungen desselben Punkts.
- Wenn du den gleichen Gedanken zweimal sagst, lösch einen.
- Absätze mit Zeilenumbrüchen trennen. Jeder Absatz = ein Schritt im Argument.`;

export const CTA_RULES = `- CTA: JEDES Skript braucht eine Kommentar-Aufforderung die Interaktion erzwingt.
- Nicht "Was denkst du?" (zu vage) sondern "A oder B? Schreib's in die Kommentare." (konkret).
- Variiere CTAs: Frage mit 2 Optionen, "Schreib X wenn...", "Markier jemanden der...", "Speicher das für...".`;

export const CONCRETENESS_RULES = `- KONKRETION: Nenne Zahlen, Beispiele, Situationen.
- "Viele Menschen scheitern" ist SCHWACH.
- "Du stehst morgens auf, schaust aufs Konto und denkst: Schon wieder" ist STARK.
- Jede Aussage braucht ein Bild im Kopf des Zuschauers.`;

export const VARIETY_RULES = `- ABWECHSLUNG: Nicht jedes Skript ist ein emotionaler Monolog.
- Variiere: Tipps, Geschichten, kontroverse Meinungen, Anleitungen, Mythen entlarven, Fehler aufdecken.
- Variiere die emotionalen Register: Wut, Humor, Empathie, Autorität, Verletzlichkeit.`;

export const TITLE_RULES = `- TITEL: Beschreibt exakt worum es im Skript geht. Max 10 Wörter.
- Kein Clickbait der nichts mit dem Inhalt zu tun hat.
- Nicht "Mindset-Tipps" sondern "Warum du immer um 22 Uhr den Kühlschrank aufmachst".`;

// Negative examples — what NOT to do
export const ANTI_PATTERNS = `VERMEIDE DIESE FEHLER:
- Generische Titel wie "5 Tipps für...", "Mindset-Tipps", "Erfolg beginnt im Kopf"
- Hooks die mit "Wusstest du...", "In der heutigen Zeit...", "Lass mich dir erzählen..." anfangen
- Body der 3x dasselbe sagt in anderen Worten
- CTA: "Was denkst du?", "Lass einen Like da", "Folg mir für mehr"
- Abstrakte Philosophie ohne konkretes Beispiel`;
