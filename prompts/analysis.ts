// ── Video Analysis & Concepts Prompts ────────────────────────────────────────
// Used by the pipeline: Gemini video analysis + Claude concept generation.
// Moved from lib/prompts.ts — the original location.

import type { Config } from "../src/lib/types";

export const ANALYSIS_PROMPT = `WICHTIG: Schreibe die gesamte Analyse auf DEUTSCH.

# KONZEPT
Beschreibung des Konzepts dieses Videos und was es wertvoll und interessant macht (1-3 Sätze).
Was wird in Frage gestellt, welcher Fehler aufgedeckt, welches Ergebnis versprochen?
Eine klare Idee. Keine Unterthemen.

# HOOK
Detaillierte Beschreibung der ersten 5 Sekunden. Was macht sie scroll-stoppend? Warum muss der Zuschauer anhalten? (1-3 Sätze)
Aufschlüsseln in:
VISUAL: Was sieht man in den ersten 1-2 Sekunden (Bewegung, Gesichtsausdruck, Kontrast, Pattern Break)
TEXT: Kurzer On-Screen-Text (Gefahr, Versprechen oder Widerspruch, max 6-8 Wörter)
AUDIO: Erste gesprochene Worte (selbstbewusst, direkt, kein Intro)
Der Hook muss Verlustangst, starke Neugier oder Identitätsrelevanz erzeugen.

# RETENTION-MECHANISMEN
Wie hält der Creator die Zuschauer durch das ganze Video? (1-7 Sätze)
Open Loops, verzögerter Payoff, Micro-Eskalationen alle 3-5 Sekunden, Pattern Interrupts, klarer Vorwärtsmomentum.

# REWARD
Was bekommt der Zuschauer am Ende? (1-3 Sätze)
Was versteht, fühlt oder sieht er jetzt anders?
Education (Klarheit), Entertainment (emotionale Lösung) oder Inspiration (Selbstvertrauen/Handlung)?

# SKRIPT
Vollständiges Skript des Videos (1-20 Sätze, so viele wie nötig).
Struktur: Sofortiger Hook (kein Gruß), Problem-Framing, warum es wichtig ist, Hauptinsight, sauberer Abschluss.
Szenen, Aktionen, Voiceover, exakter Wortlaut wenn möglich.
Kurze Sätze. Gesprochene Sprache.

GRUNDREGEL:
JE KÜRZER DIE ANALYSE, DESTO BESSER.
Wenn es in weniger Worten gesagt werden kann, dann tu das.
Klarheit > Cleverness.
Retention > Information.`;

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

Aufgabe:
Erstelle 3 NEUE Video-Konzepte, inspiriert vom ORIGINAL-Referenzvideo.
Nicht das Original kopieren.
Übertrage die Kernidee in die Nische und den Kontext dieses Clients.
Fokus auf die HOOKS — die müssen sitzen.

WICHTIG: Schreibe ALLES auf Deutsch. Skripte, Hooks, Beschreibungen — alles Deutsch.

Fokus:
Die ersten 3 Sekunden müssen die Zielgruppe dieses Clients zum Stoppen bringen.
Hooks sollen eine Überzeugung, Angst oder ein Missverständnis der Nische herausfordern.
Stimme und Positionierung des Clients matchen.
Ruhige Autorität statt Hype.

Format:

# KONZEPT 1
Beschreibung (1-3 Sätze)

## HOOK
Detaillierte Hook-Beschreibung (1-3 Sätze)
Was sieht man in den ersten 2 Sekunden?
Was wird als erstes gesagt?
Warum funktioniert dieser Hook für die Zielgruppe dieses Clients?

## SKRIPT
Detailliertes Skript (1-20 Sätze, so viele wie nötig)
Szenenablauf, gesprochener Text, klarer Payoff, subtile Autorität.

# KONZEPT 2
...

# KONZEPT 3
...`;
}
