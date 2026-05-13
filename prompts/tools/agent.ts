// ── Content Agent Tool Schemas ─────────────────────────────────────────────
// Tools available to the unified Content Agent (Anthropic format).
// All tools accept an optional client_name parameter:
//   For clients: auto-scoped, client_name is ignored.
//   For admins: client_name identifies which client's data to access.

const CLIENT_NAME_PROP = {
  type: "string" as const,
  description: "Name des Clients (z.B. 'Elliott', 'Max'). Für Admins: PFLICHT. Für Clients: wird ignoriert.",
} as const;

export const AGENT_LIST_CLIENTS_TOOL = {
  name: "list_clients",
  description: "Liste alle Clients mit Name, Nische und Social-Media-Profilen. Nur für Admins.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

export const AGENT_LOAD_CONTEXT_TOOL = {
  name: "load_client_context",
  description: "Lade das vollständige Profil, Branding, Strategie und Zielgruppe eines Clients",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_LOAD_VOICE_TOOL = {
  name: "load_voice_profile",
  description: "Lade das Voice Profile und die Skript-Struktur eines Clients",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_SEARCH_SCRIPTS_TOOL = {
  name: "search_scripts",
  description: "Suche in den bisherigen Skripten eines Clients",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      query: { type: "string" as const, description: "Suchbegriff (Titel, Pillar, Hook)" },
      pillar: { type: "string" as const, description: "Optional: Filter nach Content-Pillar" },
      limit: { type: "number" as const, description: "Maximale Anzahl Ergebnisse (default 10)" },
    },
    required: [] as string[],
  },
};

export const AGENT_CHECK_PERFORMANCE_TOOL = {
  name: "check_performance",
  description: "Lade Performance-Daten: Top-Videos, Ø Views, beste Hooks, Hook-Pattern-Verteilung",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_LOAD_AUDIT_TOOL = {
  name: "load_audit",
  description: "Lade den neuesten Audit-Report mit Stärken, Schwächen und Empfehlungen",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_CHECK_COMPETITORS_TOOL = {
  name: "check_competitors",
  description: "Lade analysierte Competitor-Videos mit Hooks, Views und Konzepten",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      limit: { type: "number" as const, description: "Maximale Anzahl Videos (default 10)" },
    },
    required: [] as string[],
  },
};

export const AGENT_CHECK_LEARNINGS_TOOL = {
  name: "check_learnings",
  description: "Lade datengestützte Erkenntnisse: welche Hook-Patterns, Formate und Pillars performen gut oder schlecht. Nur statistisch verifizierte Insights.",
  input_schema: {
    type: "object" as const,
    properties: { client_name: CLIENT_NAME_PROP },
    required: [] as string[],
  },
};

export const AGENT_SEARCH_WEB_TOOL = {
  name: "search_web",
  description: "Durchsuche das Web nach aktuellen Informationen. Nutze dies für: aktuelle Trends, News, saisonale Events, Branchenentwicklungen, Wettbewerber-News.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string" as const, description: "Suchbegriff — spezifisch und auf Deutsch" },
      market: { type: "string" as const, description: "Markt: de-DE (default), de-AT, de-CH" },
    },
    required: ["query"] as string[],
  },
};

export const AGENT_RESEARCH_TRENDS_TOOL = {
  name: "research_trends",
  description: "Recherchiere aktuelle Nischen-Trends aus dem Web. Liefert Ergebnisse aus mehreren Suchanfragen. Nutze dies wenn der Client nach Content-Ideen, aktuellen Themen oder Trends fragt.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      niche: { type: "string" as const, description: "Nische (z.B. 'Trading', 'Fitness', 'Business Coaching'). Wird automatisch aus dem Client-Profil geladen wenn nicht angegeben." },
    },
    required: [] as string[],
  },
};

export const AGENT_SAVE_IDEA_TOOL = {
  name: "save_idea",
  description: "Speichere eine Video-Idee (noch nicht ausgeschrieben) in die Ideen-Liste des Clients. Nur für frühe Ideen ohne Skript-Text. Wenn du ein fertiges Skript hast, nutze save_script.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      title: { type: "string" as const, description: "Titel der Video-Idee (kurz, max 10 Wörter)" },
      description: { type: "string" as const, description: "Beschreibung: Was soll das Video behandeln, welcher Angle?" },
      content_type: { type: "string" as const, description: "Optional: Content-Typ (z.B. Education, Storytelling, Authority)" },
    },
    required: ["title", "description"] as string[],
  },
};

export const AGENT_LIST_IDEAS_TOOL = {
  name: "list_ideas",
  description: "Liste alle gespeicherten Video-Ideen des Clients. Nutze das wenn der User auf eine bestehende Idee zurückgreifen will ('zeig mir meine Ideen', 'ich will die Idee von letzter Woche ausformulieren', 'die mit Stern', 'die markierten'). Output: jede Idee mit ★-Marker wenn favorisiert, Status, Titel, Content-Type, Description bis 500 Zeichen, ID. Starred-Ideen sind im Output immer oben sortiert.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      status: { type: "string" as const, description: "Optional: Status-Filter (idea, in-progress, done). Leer lassen für alle." },
      query: { type: "string" as const, description: "Optional: Stichwortsuche in Titel oder Beschreibung." },
      starred: { type: "boolean" as const, description: "Optional: true → nur favorisierte/mit Stern markierte Ideen zurückgeben. Nutze das wenn der User von 'markierten', 'mit Stern', 'favorisierten' oder 'gespeicherten Favoriten' redet." },
    },
    required: [] as string[],
  },
};

export const AGENT_SAVE_SCRIPT_TOOL = {
  name: "save_script",
  description: "Speichere ein fertiges Skript direkt in den Skripte-Tab des Clients (NICHT nur als Idee). Nutze das nachdem du ein Skript im Chat ausgeschrieben hast und der User es behalten will, oder wenn der User selbst einen Skript-Text liefert und sagt 'speicher das'. WICHTIG: EINEN einzigen Tool-Call mit short_script UND long_script — das speichert automatisch zwei separate Skript-Einträge (mit Suffix '(Kurz)' / '(Lang)' im Titel). Nicht das Tool zweimal aufrufen.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      title: { type: "string" as const, description: "Skript-Titel (max 10 Wörter)" },
      short_script: { type: "string" as const, description: "Kurzversion 30-40 Sek — NUR Hook + Body, OHNE den CTA-Schlusssatz. Den CTA in 'short_cta' separat übergeben. (Ohne '── KURZ ──'-Marker, reiner Text inkl. Absätze.)" },
      short_cta: { type: "string" as const, description: "Call-to-Action der Kurzversion — der konkrete Schlussaufruf (1-2 Sätze, z.B. 'Schreib REAL in die DMs für…'). PFLICHT wenn short_script gesetzt ist." },
      long_script: { type: "string" as const, description: "Langversion 60+ Sek — NUR Hook + Body, OHNE den CTA-Schlusssatz. Den CTA in 'long_cta' separat übergeben. (Ohne '── LANG ──'-Marker, reiner Text inkl. Absätze.)" },
      long_cta: { type: "string" as const, description: "Call-to-Action der Langversion — der konkrete Schlussaufruf (1-2 Sätze). PFLICHT wenn long_script gesetzt ist." },
      body: { type: "string" as const, description: "Alternative zu short_script/long_script: vollständiger Body mit beiden Versionen bereits formatiert. Nur nutzen wenn du den Rohtext 1:1 übernehmen sollst." },
      text_hook: { type: "string" as const, description: "Text-Hook der auf dem Screen eingeblendet wird (ein kurzer Satz)" },
      hook_pattern: { type: "string" as const, description: "Optional: Hook-Muster (z.B. Kontrast, Provokation, Neugier)" },
      pillar: { type: "string" as const, description: "Optional: Content-Pillar" },
      content_type: { type: "string" as const, description: "Optional: Content-Typ (Storytelling, Education, ...)" },
      format: { type: "string" as const, description: "Optional: Format (Reel, Talking Head, ...)" },
      cta: { type: "string" as const, description: "Fallback-CTA wenn nur eine Version gespeichert wird (body-Variante). Bei short_script/long_script bitte short_cta/long_cta nutzen." },
    },
    required: ["title"] as string[],
  },
};

export const AGENT_SAVE_STORY_STRATEGY_TOOL = {
  name: "save_story_strategy",
  description: "Speichere eine Instagram Story-Strategie für den Client. Eine Strategie ist eine Sequenz von 3-7 Stories die nacheinander gepostet werden, um EIN konkretes Ziel zu erreichen (z.B. Verkauf, Community, Lead-Gen). Pro Story: visual in Layman-Sprache ('Du im Bild', 'Selfie', 'Kunde', 'Lifestyle-Foto', 'Screenshot') und text. KEIN Producer-Jargon. Erscheint im Stories-Tab als visuelle Sequenz.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      title: {
        type: "string",
        description: "Sprechender Titel der Strategie, max 10 Wörter (z.B. 'Pitch für Authority Engine')",
      },
      goal: {
        type: "string",
        description: "Goal-Tag: 'Verkauf', 'Community', 'Lead-Gen', 'Authority', 'Engagement'",
      },
      stories: {
        type: "array" as const,
        minItems: 3,
        maxItems: 7,
        items: {
          type: "object" as const,
          properties: {
            label: {
              type: "string",
              description: "Verb-basierter Step-Name für diese Story-Position, max 4 Wörter. Z.B. 'Intro', 'Schmerzpunkt triggern', 'Wunschbild zeigen', 'DM-Aufruf', 'Cliffhanger setzen'. Beschreibt was die Story tut, nicht ihr Inhalt.",
            },
            visual: {
              type: "string",
              description: "Was zu SEHEN ist, max 5 Wörter, einfache Sprache: 'Du im Bild', 'Selfie', 'Kunde', 'Lifestyle-Foto', 'Screenshot', 'Hand zeigt Handy', 'Text-Slide'",
            },
            text: {
              type: "string",
              description: "Konkretes Beispiel-Text für diese Story. Wird im UI als 'Beispiel:' gerendert — der Kunde versteht dass er anpassen darf. Konkret, im Tonfall des Clients, mit Namen/Zahlen/Szenen wo möglich.",
            },
          },
          required: ["label", "visual", "text"],
        },
        description: "3-7 Stories nacheinander, jede mit verb-basiertem Label + Visual + konkretem Beispiel.",
      },
    },
    required: ["title", "goal", "stories"],
  },
};

export const AGENT_UPDATE_PROFILE_TOOL = {
  name: "update_profile",
  description: "Aktualisiere ein bestimmtes Feld im Client-Profil. Nutze das wenn der Client neue Infos über sich teilt und will dass du sie im Profil ergänzt.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: CLIENT_NAME_PROP,
      field_name: {
        type: "string" as const,
        description: "Welches Feld aktualisiert werden soll",
        enum: [
          "businessContext", "professionalBackground", "keyAchievements",
          "brandFeeling", "brandProblem", "brandingStatement",
          "humanDifferentiation", "providerRole", "providerBeliefs",
          "providerStrengths", "authenticityZone",
        ],
      },
      value: { type: "string" as const, description: "Neuer Wert für das Feld" },
    },
    required: ["field_name", "value"] as string[],
  },
};
