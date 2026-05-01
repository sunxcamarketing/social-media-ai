// ── Carousel Chat Refinement Tool ──────────────────────────────────────────

export const CAROUSEL_UPDATE_TOOL = {
  name: "update_carousel",
  description: "Übergib das komplette neue Carousel-TSX wenn du eine Änderung umsetzen kannst. Nutze NICHT, wenn du eine Rückfrage stellen willst — antworte dann einfach mit Text.",
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
