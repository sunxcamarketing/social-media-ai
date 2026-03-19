// ── Language & Voice Rules ──────────────────────────────────────────────────
// Shared across all German script generation prompts.
// Controls: tone, sentence structure, register, word choice.

export const LANGUAGE_RULES = `SPRACHE:
Gesprochenes Deutsch. Kurze Sätze. Direkte Anrede ("du"). Wie man redet, nicht schreibt.
Sprechrhythmus: Kurz. Kurz. Dann ein längerer Satz. Dann wieder kurz.
Keine Fremdwörter wenn es deutsche gibt.
Keine Bindestriche als Stilmittel. Punkt. Neuer Satz.

VERBOTEN (typische AI-Floskeln, sofort löschen):
"Die meisten Menschen...", "Viele Menschen...", "Stell dir vor...", "In der heutigen Zeit...",
"Es ist kein Geheimnis...", "Lass mich dir erzählen...", "Hier ist die Wahrheit:",
"Das Schöne daran ist...", "Am Ende des Tages...", "Lass das mal sacken",
"Nicht wahr?", "gewissermaßen", "sozusagen", "Anders gesagt...",
"Das verändert alles", "Du wirst es nicht glauben", "Du schaffst das!",
"Erstens... Zweitens... Drittens...", "Also zusammengefasst...",
"Nicht weil..., sondern weil..." (diese Kontrastformel ist typisch AI)

KÜRZE:
Ein Gedanke = ein Satz. Nie denselben Punkt in anderen Worten wiederholen.
Wenn ein Satz nichts Neues bringt, fliegt er raus.

SUBSTANZ:
Echtes Wissen. Echte Beispiele. Echte Zahlen. Keine leeren Motivationssprüche.
Jede Aussage braucht ein konkretes Beispiel oder einen Fakt. Sonst löschen.
Direkt sagen. Nicht aufbauen, nicht drumherum reden.

Ton: Wie ein Mensch zu einem Freund. Direkt, rau, echt.`;

export const VOICE_MATCHING_INSTRUCTIONS = (clientName: string) =>
  `So spricht ${clientName} wirklich. Imitiere diesen Stil exakt — Wortwahl, Satzlänge, Energie, Sprechrhythmus. Wenn der Kunde "Alter" sagt, sagst du "Alter". Wenn der Kunde sachlich spricht, bleib sachlich.`;

export const LENGTH_RULES = (maxWords: number, durationLabel: string) =>
  maxWords > 0
    ? `- LÄNGE: Max ${maxWords} Wörter gesamt (Hook+Body+CTA). Das entspricht ca. ${durationLabel} Sprechzeit. Kürzer ist besser.`
    : `- LÄNGE: Instagram Reels sind kurz. Max 30-60 Sekunden Sprechzeit. Prägnant.`;
