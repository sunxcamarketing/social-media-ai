// ── Video Analysis & Concepts Prompts ────────────────────────────────────────
// Used by the pipeline: Gemini video analysis + Claude concept generation.
// Moved from lib/prompts.ts — the original location.

import type { Config } from "../src/lib/types";

export const ANALYSIS_PROMPT = `WICHTIG: Schreibe die gesamte Analyse auf DEUTSCH.

# KONZEPT
Was ist die eine Kernidee? Was wird in Frage gestellt, welcher Fehler aufgedeckt, welches Ergebnis versprochen? (1-3 Sätze)

# HOOK-STRUKTUR
Analysiere die ersten 3 Sekunden — das ist der wichtigste Teil:
VISUAL: Was sieht man bevor ein Wort gesagt wird? (Bewegung, Gesichtsausdruck, Setting, Pattern Break)
TEXT: On-Screen-Text der zum Stoppen zwingt (exakt abschreiben, max 6-8 Wörter)
AUDIO: Erste gesprochene Worte (Tonfall, Energie, Tempo)
HOOK-TYP: Welcher der 6 Typen? (Kontra-intuitiv, Identitäts-Trigger, Schock-Zahl, Geheimnis, Direkte Provokation, Ergebnis-first)
WARUM ES STOPPT: Welcher psychologische Trigger zwingt zum Stoppen? (Verlustangst, Neugier, Identifikation, Widerspruch)

# PACING-MUSTER
Wo sind die Energie-Spikes im Video? (Sekundenangaben wenn möglich)
Gibt es einen RE-HOOK (Rückbezug zum Anfang)?
Wo sind die Micro-Pattern-Interrupts? (Schnitte, Tonwechsel, rhetorische Fragen)
Wie oft wechselt die Energie? (monoton vs. dynamisch)

# MEINUNGS-WINKEL
Welche Aussage in diesem Video polarisiert?
Gibt es eine implizite "böse" Gegenposition? (Wer wird angegriffen oder in Frage gestellt?)
Ist die Meinung KLAR oder abgesichert/neutral?

# SHARE-MECHANISMUS
Warum würde jemand dieses Video teilen?
Welche Emotion löst es aus? (Identifikation, Empörung, "das muss mein Freund sehen", Inspiration)
An wen würde man es weiterleiten?

# REPLIKIERBARE ELEMENTE
Was davon kann auf ANDERE Themen übertragen werden? (2-4 Punkte)
Nicht das Thema kopieren — die psychologische STRUKTUR identifizieren.
Welches Element macht dieses Video viral, unabhängig vom Inhalt?

# RETENTION-MECHANISMEN
Open Loops, verzögerter Payoff, Micro-Eskalationen, Pattern Interrupts, Vorwärtsmomentum. (1-5 Sätze)

# REWARD
Was bekommt der Zuschauer am Ende? Was versteht, fühlt oder sieht er jetzt anders? (1-3 Sätze)

# SKRIPT
Vollständiges Skript mit Sekunden-Angaben:
[Sek. 0-3] Hook (Visual + Text + Audio)
[Sek. 3-X] Body (Satz für Satz, mit Szenen/Aktionen)
[Sek. X-Ende] Payoff + CTA
Exakter Wortlaut wenn möglich. Kurze Sätze. Gesprochene Sprache.

GRUNDREGEL: Klarheit > Cleverness. Die STRUKTUR ist wichtiger als der Inhalt — sie ist der Beweis für den Erfolg.`;

// ── Detailed analysis for Viral Script Builder ──────────────────────────────
// This prompt forces Gemini to transcribe sentence by sentence with all three layers.

export const VIRAL_SCRIPT_ANALYSIS_PROMPT = `Du analysierst ein virales Video. Deine Aufgabe ist eine VOLLSTÄNDIGE Satz-für-Satz-Dokumentation.

# CONCEPT
Was ist die Kernidee des Videos? (1-2 Sätze)

# TEXT HOOK (ON-SCREEN)
GANZ WICHTIG: Analysiere ob zu Beginn des Videos ein TEXT-HOOK auf dem Bildschirm eingeblendet wird.
- Text-Hooks sind große, auffällige Texte die AUF dem Video liegen (nicht Captions/Untertitel)
- Sie erscheinen meist in den ersten 1-3 Sekunden
- Sie sind kurz (3-8 Wörter) und provokant, neugierig machend oder schockierend
- Beispiele: "Das hat ALLES verändert", "3 Fehler die dich arm halten", "Niemand sagt dir das"
- Schreibe den EXAKTEN Text ab, genau wie er auf dem Video steht
- Wenn KEIN Text-Hook vorhanden: schreibe "KEINER"

# FULL TRANSCRIPT
Transkribiere das KOMPLETTE Video Satz für Satz. Für JEDEN Satz dokumentiere alle drei Ebenen:

Format pro Satz:
SATZ [Nummer]: "[Exakter gesprochener Text — so wörtlich wie möglich]"
- VISUAL: [Was sieht man? Talking Head, B-Roll, Screen Recording, Zoom, Schnitt, Gestik, Mimik]
- TEXT: [Was steht auf dem Bildschirm? Captions, Overlay-Text, Zahlen, Grafiken. "Keiner" wenn nichts]

REGELN:
- JEDEN Satz einzeln dokumentieren. Keinen überspringen.
- Gesprochenen Text so wörtlich wie möglich transkribieren
- Auch kurze Sätze ("Und das Beste?") als eigenen Eintrag
- Pausen, Betonungen, Tonwechsel in VISUAL notieren
- On-Screen-Text EXAKT abschreiben, nicht zusammenfassen
- Wenn der Creator etwas zeigt (Screenshot, App, Zahlen) → genau beschreiben WAS zu sehen ist
- TEXT-OVERLAYS die über längere Zeit sichtbar bleiben → bei JEDEM Satz dokumentieren wo sie sichtbar sind

# HOOK ANALYSE
- Was genau passiert in den ersten 1-3 Sekunden?
- TEXT HOOK: Was ist der Text-Overlay auf dem Screen? (Der große Text der zum Stoppen zwingt)
- VISUAL: Was sieht man? (Gesicht, Bewegung, Setting)
- AUDIO: Was sind die ersten gesprochenen Worte?
- Warum stoppt das den Scroll?
- Wie arbeiten Text-Hook, Visual und Audio zusammen?

# RETENTION
Wie hält das Video die Aufmerksamkeit? (2-4 Sätze)
- Open Loops, Pattern Interrupts, Schnitt-Rhythmus, Energie-Wechsel

# REWARD
Was bekommt der Zuschauer am Ende? (1-2 Sätze)

WICHTIG: Die Vollständigkeit des Transkripts ist das WICHTIGSTE. Lieber zu detailliert als etwas auslassen. Jeder Satz zählt — die Struktur des Videos ist der Beweis für seinen Erfolg. Der TEXT HOOK ist besonders wichtig — er ist das erste was der Zuschauer liest und entscheidet ob er stoppt oder weiterscrollt.`;

export function buildConceptsPrompt(config: Pick<Config, "configName" | "name" | "company" | "role" | "location" | "businessContext" | "professionalBackground" | "keyAchievements" | "creatorsCategory">): string {
  const clientName = config.name || config.configName;
  const identity = [config.role, config.company, config.location].filter(Boolean).join(", ");

  const clientBlock = [
    `${clientName}${identity ? ` — ${identity}` : ""}`,
    config.businessContext && `Context: ${config.businessContext}`,
    config.professionalBackground && `Background: ${config.professionalBackground}`,
    config.keyAchievements && `Achievements: ${config.keyAchievements}`,
  ].filter(Boolean).join("\n");

  return `Adaptiere dieses Video für folgenden Client:

${clientBlock}

AUFGABE:
Du kopierst NICHT das Thema. Du kopierst die PSYCHOLOGISCHE STRUKTUR die dieses Video viral gemacht hat.
Erstelle 3 NEUE Video-Konzepte die die gleiche Mechanik nutzen — aber auf die Nische und Zielgruppe dieses Clients übertragen.

WICHTIG: Schreibe ALLES auf Deutsch.

ADAPTIONS-PROZESS:
1. Identifiziere die replikierbaren Elemente aus der Analyse (Hook-Typ, Pacing, Meinungs-Winkel, Share-Trigger).
2. Finde das Äquivalent in der Nische des Clients: Welche Überzeugung kann angegriffen werden? Welche Zahl schockiert? Welche Identität wird getriggert?
3. Behalte die TIMING-STRUKTUR bei (wann kommt der Open Loop? Wann der Re-Hook? Wann der Payoff?)
4. Schreibe jedes Konzept als Sekunden-Regie.

Format:

# KONZEPT 1
Beschreibung (1-3 Sätze). MEINUNGS-WINKEL klar benennen.

## HOOK
[Sek. 0-3] VISUAL: Was sieht man?
[Sek. 0-3] TEXT: On-Screen-Text (max 8 Wörter)
[Sek. 0-3] AUDIO: Erste gesprochene Worte
HOOK-TYP: (Kontra-intuitiv / Identitäts-Trigger / Schock-Zahl / Geheimnis / Provokation / Ergebnis-first)
WARUM ES STOPPT: (1 Satz — welcher psychologische Trigger?)

## SKRIPT
Sekunden-basiertes Skript:
[Sek. 0-3] Hook
[Sek. 3-8] Open Loop
[Sek. 8-X] Body mit Micro-Pattern-Interrupts
[Sek. X-Y] Re-Hook
[Sek. Y-Ende] Payoff + CTA

# KONZEPT 2
...

# KONZEPT 3
...`;
}
