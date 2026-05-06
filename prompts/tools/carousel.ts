// ── Carousel Chat Refinement Tools ─────────────────────────────────────────
//
// Two tools for two situations:
// - update_carousel: full TSX rewrite (use for layout overhauls, slide reorders,
//   adding/removing slides, deep restructuring)
// - patch_carousel: targeted find/replace patches applied server-side (use for
//   small edits — text rewrite, color swap, delete a tag, append a footer).
//   Keeps output token count tiny so the round-trip is sub-10s instead of
//   60-150s for a full 6-slide rewrite.

export const CAROUSEL_UPDATE_TOOL = {
  name: "update_carousel",
  description: "Übergib das KOMPLETTE neue Carousel-TSX. Nutze NUR bei großen Umbauten: Slides hinzufügen/entfernen, Slide-Reihenfolge ändern, Layout-Restructuring, mehrere Slides umkrempeln. Bei kleinen lokalen Edits (Text ersetzen, Farbe ändern, Element löschen, Footer einfügen) IMMER stattdessen patch_carousel — das ist um Größenordnungen schneller. Nicht nutzen für Rückfragen — antworte dann einfach mit Text.",
  input_schema: {
    type: "object" as const,
    properties: {
      tsx_code: {
        type: "string" as const,
        description: "Der vollständige neue TSX-Code mit `function Carousel() { ... }`. Keine imports, keine exports.",
      },
      summary: {
        type: "string" as const,
        description: "1-2 Sätze: was du geändert hast und warum. Wird dem User als Nachricht angezeigt.",
      },
    },
    required: ["tsx_code", "summary"] as string[],
  },
};

export const CAROUSEL_UPDATE_SLIDES_TOOL = {
  name: "update_slides",
  description:
    "Sicherer Default für nicht-triviale Edits. Du übergibst NUR die geänderten Slides als komplette `<section className=\"slide\">…</section>` Blöcke samt Slide-Index — alle anderen Slides bleiben SERVER-erzwungen byte-für-byte 1:1, du kannst sie gar nicht versehentlich ändern. Nutze das wenn der User einen Slide oder mehrere konkrete Slides umbauen will (Layout, kompletter Text, Bild einfügen, etc.) und alle anderen unangetastet bleiben sollen. Drei Slides ändern = 3 Einträge in `changes`. Bei reinen Mini-Edits (ein Wort, eine Farbe) trotzdem patch_carousel bevorzugen — schneller. Bei Slide-Anzahl-Änderung (hinzufügen/entfernen) oder Reihenfolge-Änderung: update_carousel.",
  input_schema: {
    type: "object" as const,
    properties: {
      changes: {
        type: "array" as const,
        description: "Liste der zu ersetzenden Slides. Jeder Eintrag = ein Slide-Block.",
        minItems: 1,
        items: {
          type: "object" as const,
          properties: {
            slide_index: {
              type: "number" as const,
              description: "0-basierter Index des Slides im aktuellen Karussell (0 = erste, 1 = zweite, …).",
            },
            tsx: {
              type: "string" as const,
              description: "Der KOMPLETTE neue `<section className=\"slide\" …>…</section>` Block für diese Slide. Mit allen inline styles und Children. KEINE Wrapping-Tags, KEIN function-Header, KEIN React.Fragment außenrum.",
            },
          },
          required: ["slide_index", "tsx"],
        },
      },
      summary: {
        type: "string" as const,
        description: "1-2 Sätze: was du an welchen Slides geändert hast. Wird dem User als Nachricht angezeigt.",
      },
    },
    required: ["changes", "summary"],
  },
};

export const CAROUSEL_PATCH_TOOL = {
  name: "patch_carousel",
  description: "Schnelle, lokale Änderungen am bestehenden TSX über find/replace. IMMER bevorzugen wenn die Änderung klein ist (einzelner Text, einzelne Klasse/Farbe, einzelnes Element löschen, kleines Element einfügen, ein Handle/Footer in alle Slides). Schreibst nur die geänderten Stellen statt der ganzen Datei → 5-10s Latenz statt 60-150s. Bei wirklich großen Umbauten (Layout-Restructuring, Slide-Anzahl ändern, mehrere Slides komplett neu) → update_carousel.",
  input_schema: {
    type: "object" as const,
    properties: {
      patches: {
        type: "array" as const,
        description: "Liste der Änderungen, sequentiell angewendet auf das aktuelle TSX. Mindestens 1 Patch.",
        items: {
          type: "object" as const,
          properties: {
            find: {
              type: "string" as const,
              description: "Wörtlicher Text aus dem aktuellen TSX, der ersetzt werden soll. Muss EXAKT mit dem Code übereinstimmen (auch Whitespace, Anführungszeichen, JSX). Muss EINDEUTIG sein — wenn der String mehrfach vorkommt und du nur eine Stelle willst, nimm mehr Kontext drumrum (z.B. ganze Zeile plus 1-2 umgebende Zeichen). Wenn du wirklich alle Vorkommen ändern willst (z.B. @handle in allen Slide-Footern): replace_all=true setzen.",
            },
            replace: {
              type: "string" as const,
              description: "Neuer Text. Leerstring = find wird gelöscht.",
            },
            replace_all: {
              type: "boolean" as const,
              description: "Optional. Default false. Wenn true: alle Vorkommen von find ersetzen statt nur das eindeutige. Nur nutzen wenn du wirklich ALLE willst.",
            },
          },
          required: ["find", "replace"] as string[],
        },
      },
      summary: {
        type: "string" as const,
        description: "1-2 Sätze: was du geändert hast. Wird dem User als Nachricht angezeigt.",
      },
    },
    required: ["patches", "summary"] as string[],
  },
};
