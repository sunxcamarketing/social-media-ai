// ── Brave Search API Client ────────────────────────────────────────────────
// Used by Content Agent and Trend Research Pipeline for live web data.

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

interface BraveSearchResponse {
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
    }>;
  };
}

export async function searchWeb(
  query: string,
  options?: { market?: string; count?: number },
): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_API_KEY nicht konfiguriert");
  }

  const count = options?.count || 8;
  const market = options?.market || "de-DE";

  const params = new URLSearchParams({
    q: query,
    count: String(count),
    search_lang: "de",
    country: market.split("-")[1] || "DE",
    text_decorations: "false",
  });

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Brave Search fehlgeschlagen: ${response.status}`);
  }

  const data: BraveSearchResponse = await response.json();

  return (data.web?.results || []).map(r => ({
    title: r.title,
    url: r.url,
    description: r.description,
    age: r.age,
  }));
}

/**
 * Search for niche-specific trends. Runs multiple queries to get diverse results.
 * @deprecated Use searchTrendsDeep() for richer, category-organized results.
 */
export async function searchTrends(
  niche: string,
  options?: { market?: string },
): Promise<{ query: string; results: BraveSearchResult[] }[]> {
  const market = options?.market || "de-DE";
  const now = new Date();
  const monthLabel = now.toLocaleString("de-DE", { month: "long", year: "numeric" });

  const queries = [
    `${niche} Trends ${monthLabel}`,
    `${niche} viral Instagram Reels aktuell`,
    `${niche} kontroverse Diskussion ${now.getFullYear()}`,
  ];

  const results = await Promise.all(
    queries.map(async (q) => {
      try {
        const hits = await searchWeb(q, { market, count: 5 });
        return { query: q, results: hits };
      } catch {
        return { query: q, results: [] };
      }
    }),
  );

  return results;
}

// ── Deep Trend Research ───────────────────────────────────────────────────

export type TrendCategory =
  | "search_intent"
  | "viral"
  | "news"
  | "pain_point"
  | "pillar"
  | "seasonal";

export interface DeepTrendResult {
  category: TrendCategory;
  query: string;
  results: BraveSearchResult[];
}

export interface DeepTrendContext {
  niche: string;
  pillars?: string[];
  customerProblems?: string;
  brandProblem?: string;
  businessContext?: string;
}

const SEASONAL_KEYWORDS: Record<number, string[]> = {
  1:  ["Neujahrsvorsätze", "Jahresstart", "Winter"],
  2:  ["Valentinstag", "Winter", "Q1"],
  3:  ["Frühling", "Frühjahrsstart", "Ostern"],
  4:  ["Frühling", "Ostern", "Q2 Start"],
  5:  ["Frühsommer", "Muttertag", "Outdoor"],
  6:  ["Sommer", "Sommervorbereitung", "Halbjahr"],
  7:  ["Sommer", "Sommerferien", "Urlaub"],
  8:  ["Sommer", "Back to School", "Herbstvorbereitung"],
  9:  ["Herbst", "Neustart", "Q4 Planung"],
  10: ["Herbst", "Halloween", "Q4"],
  11: ["Black Friday", "Jahresendspurt", "Winter"],
  12: ["Weihnachten", "Jahresrückblick", "Silvester"],
};

function getSeasonalKeywords(): string[] {
  const month = new Date().getMonth() + 1;
  return SEASONAL_KEYWORDS[month] || ["aktuell"];
}

function extractKeywords(text: string | undefined, max: number): string[] {
  if (!text) return [];
  // Take meaningful words (>4 chars), skip common words
  const stopWords = new Set(["nicht", "keine", "einen", "einer", "diese", "dieser", "dieses", "werden", "haben", "sein", "sind", "wird", "kann", "dass", "auch", "oder", "aber", "wenn", "noch", "schon", "mehr", "sehr"]);
  return text
    .split(/[\s,.;:!?()]+/)
    .filter(w => w.length > 4 && !stopWords.has(w.toLowerCase()))
    .slice(0, max);
}

/**
 * Deep trend research: 12-15 targeted queries across 6 categories.
 * Returns category-organized results for Claude to synthesize.
 */
export async function searchTrendsDeep(
  ctx: DeepTrendContext,
  options?: { market?: string },
): Promise<DeepTrendResult[]> {
  const market = options?.market || "de-DE";
  const now = new Date();
  const year = now.getFullYear();
  const monthLabel = now.toLocaleString("de-DE", { month: "long", year: "numeric" });
  const seasonal = getSeasonalKeywords();

  const queries: { category: TrendCategory; query: string }[] = [];

  // 1. Search Intent (3) — what the audience actually searches for
  queries.push(
    { category: "search_intent", query: `${ctx.niche} häufigste Fragen ${year}` },
    { category: "search_intent", query: `${ctx.niche} Fehler Anfänger vermeiden` },
    { category: "search_intent", query: `${ctx.niche} Tipps die wirklich funktionieren ${year}` },
  );

  // 2. Viral/Social (2) — what's going viral right now
  queries.push(
    { category: "viral", query: `${ctx.niche} viral TikTok Reels ${monthLabel}` },
    { category: "viral", query: `${ctx.niche} kontroverse Meinung ${monthLabel}` },
  );

  // 3. News/Current Events (2) — what happened recently
  queries.push(
    { category: "news", query: `${ctx.niche} News aktuell ${monthLabel}` },
    { category: "news", query: `${ctx.niche} neue Studie OR neues Gesetz OR Änderung ${year}` },
  );

  // 4. Audience Pain Points (2) — from customer problems
  const painKeywords = extractKeywords(ctx.customerProblems, 3);
  const brandKeywords = extractKeywords(ctx.brandProblem, 2);
  if (painKeywords.length > 0) {
    queries.push({ category: "pain_point", query: `${painKeywords.join(" ")} Lösung ${year}` });
  }
  if (brandKeywords.length > 0) {
    queries.push({ category: "pain_point", query: `${ctx.niche} ${brandKeywords.join(" ")} Erfahrung` });
  }
  // Fallback if no customer data
  if (painKeywords.length === 0 && brandKeywords.length === 0) {
    queries.push(
      { category: "pain_point", query: `${ctx.niche} größte Probleme ${year}` },
      { category: "pain_point", query: `${ctx.niche} was die meisten falsch machen` },
    );
  }

  // 5. Pillar-specific (2-3) — one per top pillar
  const pillars = (ctx.pillars || []).slice(0, 3);
  for (const pillar of pillars) {
    queries.push({ category: "pillar", query: `${pillar} ${ctx.niche} aktuell ${monthLabel}` });
  }
  // If no pillars, add a generic niche-deep query
  if (pillars.length === 0) {
    queries.push({ category: "pillar", query: `${ctx.niche} Mythen die falsch sind ${year}` });
  }

  // 6. Seasonal (1-2) — based on current month
  queries.push({ category: "seasonal", query: `${ctx.niche} ${seasonal[0]} ${year}` });
  if (seasonal.length > 1) {
    queries.push({ category: "seasonal", query: `${ctx.niche} ${seasonal[1]} Tipps` });
  }

  // Execute all queries in parallel
  const results = await Promise.all(
    queries.map(async ({ category, query }) => {
      try {
        const hits = await searchWeb(query, { market, count: 5 });
        return { category, query, results: hits };
      } catch {
        return { category, query, results: [] };
      }
    }),
  );

  return results;
}

/**
 * Format deep trend results into a category-organized text block for Claude.
 */
export function formatDeepTrendResults(results: DeepTrendResult[]): string {
  const categoryLabels: Record<TrendCategory, string> = {
    search_intent: "SEARCH INTENT — Was Leute wirklich suchen",
    viral: "VIRAL — Was gerade auf Social Media abgeht",
    news: "NEWS — Aktuelle Ereignisse in der Nische",
    pain_point: "PAIN POINTS — Probleme der Zielgruppe",
    pillar: "PILLAR-SPEZIFISCH — Themen aus den Content-Säulen",
    seasonal: "SAISONAL — Zeitbezogene Themen",
  };

  const grouped: Record<string, DeepTrendResult[]> = {};
  for (const r of results) {
    if (r.results.length === 0) continue;
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  if (Object.keys(grouped).length === 0) return "";

  const sections = Object.entries(grouped).map(([cat, items]) => {
    const label = categoryLabels[cat as TrendCategory] || cat;
    const content = items.map(item =>
      `Suche "${item.query}":\n${item.results.map((r, i) =>
        `  ${i + 1}. ${r.title}${r.age ? ` (${r.age})` : ""}\n     ${r.description}${r.url ? `\n     ${r.url}` : ""}`
      ).join("\n")}`
    ).join("\n\n");
    return `## ${label}\n${content}`;
  });

  return `<live_web_trends>\n${sections.join("\n\n")}\n</live_web_trends>`;
}
