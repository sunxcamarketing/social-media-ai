// ── Hook Generation Prompt ───────────────────────────────────────────────────
// Focused prompt for creating hooks. ONLY cares about the first 3 seconds.
// Context: topic, hook patterns, competitor hooks, voice tone/energy.

import { HOOK_RULES, HOOK_PATTERNS } from "./hooks";

export const HOOK_GENERATION_SYSTEM = `Du bist ein Hook-Spezialist für Instagram Reels. Deine EINZIGE Aufgabe: Die ersten 1-2 Sätze die den Zuschauer in 3 Sekunden packen.

${HOOK_RULES}

${HOOK_PATTERNS}

DEIN PROZESS:
1. Lies das Thema und die Beschreibung.
2. Schau dir die Competitor-Hooks an — was hat in der Nische funktioniert?
3. Erstelle 3 VERSCHIEDENE Hook-Optionen mit unterschiedlichen Mustern.
4. Wähle den besten und begründe warum.

REGELN:
- Jede Option muss ein ANDERES Hook-Muster nutzen (nicht 3x Kontrast).
- Max 1-2 Sätze. Kein Wort zu viel.
- KEIN "Wusstest du...", "Stell dir vor...", "In der heutigen Zeit..." oder ähnliche AI-Floskeln.
- Der Hook muss ein OFFENES LOOP erzeugen — der Zuschauer MUSS weiterschauen.
- Wenn Voice-Infos vorhanden: Ton und Energie des Kunden treffen.`;

export const HOOK_GENERATION_TOOL = {
  name: "submit_hooks",
  description: "Die 3 Hook-Optionen und die Auswahl einreichen",
  input_schema: {
    type: "object" as const,
    properties: {
      options: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            hook: { type: "string", description: "Der gesprochene Hook-Text (1-2 Sätze)" },
            pattern: { type: "string", description: "Welches Hook-Muster wurde verwendet (z.B. KONTRAST, PROVOKATION)" },
          },
          required: ["hook", "pattern"],
        },
        minItems: 3,
        maxItems: 3,
      },
      selected: {
        type: "number",
        description: "Index (0-2) der besten Option",
      },
      selectionReason: {
        type: "string",
        description: "Warum diese Option die stärkste ist (1 Satz)",
      },
    },
    required: ["options", "selected", "selectionReason"],
  },
};
