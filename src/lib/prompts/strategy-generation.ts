// ── Strategy Generation Prompt ───────────────────────────────────────────────
// Used by: POST /api/configs/[id]/generate-strategy
// Creates the complete content strategy: goal, pillars, weekly plan.
// This prompt receives client profile, audit data, and performance insights.

interface StrategyPromptContext {
  clientContext: string;
  contentTypeList: string;
  formatList: string;
  postsPerWeek: number;
  activeDays: string[];
  auditBlock: string;
  performanceBlock: string;
  trainingBlock: string;
}

export function strategyGenerationPrompt(ctx: StrategyPromptContext): string {
  return `Du bist ein Content-Stratege für Instagram. Du erstellst eine datenbasierte Content-Strategie.

FRAMEWORK: Content = Pillar + Type + Format

CONTENT TYPES (wähle NUR aus dieser Liste):
${ctx.contentTypeList}

CONTENT FORMATS (wähle NUR aus dieser Liste):
${ctx.formatList}

<client_profile>
${ctx.clientContext}
</client_profile>

${ctx.auditBlock}

${ctx.performanceBlock}

${ctx.trainingBlock}

AUFTRAG: Erstelle eine Content-Strategie für ${ctx.postsPerWeek}× pro Woche (Tage: ${ctx.activeDays.join(", ")}).

REGELN:
1. PILLARS: 3-5 Kernthemen die direkt mit der Expertise, dem Angebot und den Problemen des Traumkunden zusammenhängen.
   Jeder Pillar-Name ist kurz (2-4 Wörter). SubTopics sind 3-4 konkrete Themenideen pro Pillar.
2. ZIEL: "reach" wenn Reichweite fehlt, "trust" wenn Vertrauen/Community aufgebaut werden muss, "revenue" wenn es um Conversion geht.
   Wenn ein Audit vorhanden ist, nutze die Daten um das Ziel zu bestimmen.
3. WOCHENPLAN: Pro Tag ein Content Type + Format. Content Types DÜRFEN sich wiederholen wenn es strategisch sinnvoll ist.
   Formate können kombiniert werden mit " + " (z.B. "Face to Camera + Voice Over + B-Roll").
4. AUDIT NUTZEN: Wenn Audit-Daten vorhanden sind, leite die Strategie daraus ab.
   Was funktioniert? Mehr davon. Was funktioniert nicht? Vermeiden oder anders angehen.
5. PERFORMANCE NUTZEN: Wenn Performance-Daten vorhanden sind, orientiere dich an den erfolgreichsten Videos.
   Welche Content Types und Formate haben die meisten Views/Likes gebracht?

Antworte NUR mit validem JSON:

{
  "strategyGoal": "reach" | "trust" | "revenue",
  "pillars": [
    { "name": "Pillar-Name", "subTopics": "3-4 konkrete Themenideen" }
  ],
  "weekly": {
    ${ctx.activeDays.map(d => `"${d}": { "type": "Content Type Name", "format": "Format Name(s)" }`).join(",\n    ")}
  }
}`;
}
