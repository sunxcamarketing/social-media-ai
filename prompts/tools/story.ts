// ── Story Strategist Tool ──────────────────────────────────────────────────

export const STORY_STRATEGY_TOOL = {
  name: "submit_story_strategy",
  description: "Die fertige Instagram Story Strategie einreichen.",
  input_schema: {
    type: "object" as const,
    properties: {
      campaign_plan: {
        type: "object" as const,
        description: "Strategische Story-Kampagne",
        properties: {
          objective: { type: "string" as const, description: "Kampagnen-Ziel in 1-2 Sätzen" },
          duration_days: { type: "number" as const, description: "Empfohlene Laufzeit in Tagen (7, 14, 30)" },
          daily_themes: {
            type: "array" as const,
            description: "Tages-Themen pro Säule (Pain, Prozess, Beweis, Pitch)",
            items: {
              type: "object" as const,
              properties: {
                pillar: { type: "string" as const, enum: ["pain", "process", "proof", "pitch"] },
                theme: { type: "string" as const, description: "Konkretes Tages-Thema" },
              },
              required: ["pillar", "theme"],
            },
          },
          story_concepts: {
            type: "array" as const,
            description: "3-5 spezifische Story-Konzepte",
            items: {
              type: "object" as const,
              properties: {
                hook: { type: "string" as const, description: "Starter-Satz/Call-out" },
                value_or_proof: { type: "string" as const, description: "Value/Beweis-Teil" },
                cta: { type: "string" as const, description: "Call-to-Action mit Keyword" },
              },
              required: ["hook", "value_or_proof", "cta"],
            },
          },
          expected_metrics: { type: "string" as const, description: "Erwartete Ergebnisse/Metriken" },
        },
        required: ["objective", "duration_days", "daily_themes", "story_concepts", "expected_metrics"],
      },

      community_building: {
        type: "object" as const,
        description: "Community-Aufbau-Strategie",
        properties: {
          interactive_formats: { type: "array" as const, items: { type: "string" as const }, description: "Interaktive Story-Formate (Polls, Questions, Reply-Prompts)" },
          member_features: { type: "string" as const, description: "Wie Community-Mitglieder gefeatured werden" },
          recurring_series: { type: "array" as const, items: { type: "string" as const }, description: "Wiederkehrende Story-Serien die Zugehörigkeit schaffen" },
          engagement_loops: { type: "string" as const, description: "Engagement-Loops die Beteiligung fördern" },
        },
        required: ["interactive_formats", "member_features", "recurring_series", "engagement_loops"],
      },

      sales_sequences: {
        type: "array" as const,
        description: "2-3 Story-Sequenzen für Sales",
        items: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const, description: "Name/Titel der Sequenz" },
            pillar: { type: "string" as const, enum: ["pain", "process", "proof", "pitch"] },
            deployment_timing: { type: "string" as const, description: "Wann in der Customer Journey einsetzen" },
            frames: {
              type: "object" as const,
              description: "5-Frame-Skript",
              properties: {
                hook:     { type: "string" as const, description: "Frame 1: Hook + Call-out" },
                pain:     { type: "string" as const, description: "Frame 2: Pain/Problem" },
                solution: { type: "string" as const, description: "Frame 3: Mini-Lösung/Process-Insight" },
                proof:    { type: "string" as const, description: "Frame 4: Beweis" },
                cta:      { type: "string" as const, description: "Frame 5: CTA mit Keyword" },
              },
              required: ["hook", "pain", "solution", "proof", "cta"],
            },
            keyword: { type: "string" as const, description: "Das konkrete Keyword für DM-Antworten" },
          },
          required: ["name", "pillar", "deployment_timing", "frames", "keyword"],
        },
        minItems: 2,
        maxItems: 3,
      },

      daily_insights: {
        type: "object" as const,
        description: "Framework für natürliche Daily Insights",
        properties: {
          day_in_life_concepts: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "5-7 'Day in the Life' Story-Konzepte",
            minItems: 5, maxItems: 7,
          },
          business_weaving: { type: "string" as const, description: "Wie Business/Produkt natürlich eingewoben wird" },
          bts_moments: { type: "string" as const, description: "Behind-the-Scenes Momente die Autorität aufbauen" },
          balance_personal_business: { type: "string" as const, description: "Balance Personal vs Business Content" },
        },
        required: ["day_in_life_concepts", "business_weaving", "bts_moments", "balance_personal_business"],
      },

      seven_day_plan: {
        type: "array" as const,
        description: "Konkreter 7-Tage-Plan (Mo-So)",
        items: {
          type: "object" as const,
          properties: {
            day:         { type: "string" as const, enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
            pillar:      { type: "string" as const, enum: ["pain", "process", "proof", "pitch"] },
            hook:        { type: "string" as const, description: "Hook/Opening-Line" },
            key_message: { type: "string" as const, description: "Key Message/Content" },
            visuals:     { type: "string" as const, description: "Nötige Visual-Elemente (Screenshot, Video, Text-Overlay)" },
            cta:         { type: "string" as const, description: "CTA mit Keyword" },
          },
          required: ["day", "pillar", "hook", "key_message", "visuals", "cta"],
        },
        minItems: 7,
        maxItems: 7,
      },
    },
    required: ["campaign_plan", "community_building", "sales_sequences", "daily_insights", "seven_day_plan"],
  },
};
