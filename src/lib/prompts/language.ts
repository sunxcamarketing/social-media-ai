// ── Language & Voice Rules ──────────────────────────────────────────────────
// Shared across all German script generation prompts.
// Controls: tone, sentence structure, register, word choice.

export const LANGUAGE_RULES = `SPRACHE:
Gesprochenes Deutsch. Kurze Sätze. Direkte Anrede ("du"). Wie man redet, nicht schreibt.
Sprechrhythmus: Kurz. Kurz. Dann ein längerer Satz. Dann wieder kurz.
Keine Fremdwörter wenn es deutsche gibt.
Keine Bindestriche als Stilmittel. Punkt. Neuer Satz.

VERBOTEN (typische AI-Floskeln — wenn du eine davon schreibst, ist das Skript gescheitert):
- Eröffnungsfloskeln: "Die meisten Menschen...", "Viele Menschen...", "Stell dir vor...", "In der heutigen Zeit...", "Hast du dich jemals gefragt...", "Lass mich dir erzählen...", "Hier ist die Wahrheit:", "Wusstest du, dass...", "Es gibt da etwas..."
- Übergangsfloskeln: "Das Schöne daran ist...", "Am Ende des Tages...", "Anders gesagt...", "Was bedeutet das konkret?", "Und genau das ist der Punkt.", "Hier kommt der Clou:", "Und weißt du was?", "Aber jetzt kommt's:", "Und das Beste daran?"
- Füllwörter: "gewissermaßen", "sozusagen", "im Grunde genommen", "tatsächlich" (als Füllwort), "letztendlich", "grundsätzlich", "interessanterweise", "spannenderweise"
- Motivations-Kitsch: "Du schaffst das!", "Glaub an dich!", "Es ist nie zu spät", "Der erste Schritt ist der wichtigste", "Du bist nicht allein damit", "Das verändert alles", "Du wirst es nicht glauben"
- Struktur-Muster: "Erstens... Zweitens... Drittens...", "Also zusammengefasst...", "Nicht weil..., sondern weil..." (typische AI-Kontrastformel), "Die Frage ist nicht ob, sondern...", "Lass das mal sacken", "Nicht wahr?"
- Pseudo-Empathie: "Ich weiß wie du dich fühlst", "Das kenne ich nur zu gut", "Wir alle kennen das", "Sei mal ehrlich zu dir selbst"

ANTI-AI-CHECKLISTE (nach dem Schreiben prüfen):
1. Würde ein echter Mensch so reden? Wenn nein → umschreiben.
2. Klingt der Satz wie aus einem Coaching-Webinar? → löschen.
3. Steht da ein "aber" oder "doch" als dramatischer Wendepunkt? → vereinfachen.
4. Gibt es mehr als 2 rhetorische Fragen? → auf max 1 reduzieren.
5. Endet ein Absatz mit einer "großen Erkenntnis"? → konkreter machen oder streichen.

KÜRZE:
Ein Gedanke = ein Satz. Nie denselben Punkt in anderen Worten wiederholen.
Wenn ein Satz nichts Neues bringt, fliegt er raus.

SUBSTANZ:
Echtes Wissen. Echte Beispiele. Echte Zahlen. Keine leeren Motivationssprüche.
Jede Aussage braucht ein konkretes Beispiel oder einen Fakt. Sonst löschen.
Direkt sagen. Nicht aufbauen, nicht drumherum reden.
Keine Aufzählungen mit 3+ generischen Punkten — lieber 1 konkretes Beispiel.

Ton: Wie ein Mensch zu einem Freund. Direkt, rau, echt. Ecken und Kanten.`;

export const VOICE_MATCHING_INSTRUCTIONS = (clientName: string) =>
  `VOICE MATCHING — HÖCHSTE PRIORITÄT:
Die Voice-Beispiele unten zeigen wie ${clientName} WIRKLICH spricht. Dein Skript muss klingen als hätte ${clientName} es selbst geschrieben.
- Übernimm exakt: Wortwahl, Satzlänge, Energie, Sprechrhythmus, Slang, Dialekt-Einflüsse.
- Wenn ${clientName} "Alter" sagt, sagst du "Alter". Wenn sachlich, bleib sachlich.
- Wenn ${clientName} lange Sätze baut, bau lange Sätze. Wenn abgehackt, dann abgehackt.
- KEINE eigenen Stilelemente hinzufügen. Du IMITIERST, du ERWEITERST NICHT.
- Im Zweifel: Klingt es wie ${clientName} oder wie ChatGPT? Wenn ChatGPT → umschreiben.`;

export const LENGTH_RULES = (maxWords: number, durationLabel: string) =>
  maxWords > 0
    ? `- LÄNGE: Max ${maxWords} Wörter gesamt (Hook+Body+CTA). Das entspricht ca. ${durationLabel} Sprechzeit. Kürzer ist besser.`
    : `- LÄNGE: Instagram Reels sind kurz. Max 30-60 Sekunden Sprechzeit. Prägnant.`;
