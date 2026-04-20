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
  options?: { market?: string; count?: number; maxRetries?: number },
): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error("BRAVE_API_KEY nicht konfiguriert");
  }

  const count = options?.count || 8;
  const market = options?.market || "de-DE";
  const maxRetries = options?.maxRetries ?? 2;

  const params = new URLSearchParams({
    q: query,
    count: String(count),
    search_lang: "de",
    country: market.split("-")[1] || "DE",
    text_decorations: "false",
  });

  let lastStatus = 0;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

    if (response.ok) {
      const data: BraveSearchResponse = await response.json();
      return (data.web?.results || []).map(r => ({
        title: r.title,
        url: r.url,
        description: r.description,
        age: r.age,
      }));
    }

    lastStatus = response.status;
    // Only retry on rate-limit (429) or temporary upstream (503).
    // 401/403/400 = configuration bug; 5xx other = likely transient once.
    const isRetryable = response.status === 429 || response.status === 503;
    if (!isRetryable || attempt === maxRetries) {
      throw new Error(`Brave Search fehlgeschlagen: ${response.status}`);
    }

    // Exponential backoff: 2s, 4s, 8s; honor Retry-After when present.
    const retryAfter = parseInt(response.headers.get("Retry-After") || "", 10);
    const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter * 1000, 10_000)
      : 2000 * Math.pow(2, attempt);
    await new Promise((r) => setTimeout(r, backoffMs));
  }

  throw new Error(`Brave Search fehlgeschlagen nach ${maxRetries + 1} Versuchen (letzter Status ${lastStatus})`);
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
  | "seasonal"
  | "community_voices"
  | "adjacent_market"
  | "objection";

export const ALL_TREND_CATEGORIES: TrendCategory[] = [
  "search_intent", "viral", "news", "pain_point", "pillar", "seasonal",
  "community_voices", "adjacent_market", "objection",
];

export interface DeepTrendResult {
  category: TrendCategory;
  query: string;
  results: BraveSearchResult[];
}

export interface DeepTrendContext {
  niche: string;
  pillars?: string[];
  customerProblems?: string;
  customerProblemsByDim?: Partial<Record<"mental" | "emotional" | "practical" | "financial" | "social", string>>;
  brandProblem?: string;
  businessContext?: string;
  adjacentMarkets?: string[]; // nearby niches for "adjacent_market" category
  coreOffer?: string;         // used for objection queries
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
 * Deep trend research: 15-20 targeted queries across 9 categories.
 * Sub-angles rotate weekly when an rng is provided (from week-seed).
 * Returns category-organized results for Claude to synthesize.
 */
export async function searchTrendsDeep(
  ctx: DeepTrendContext,
  options?: { market?: string; rng?: () => number },
): Promise<DeepTrendResult[]> {
  const market = options?.market || "de-DE";
  const rng = options?.rng || Math.random;
  const now = new Date();
  const year = now.getFullYear();
  const monthLabel = now.toLocaleString("de-DE", { month: "long", year: "numeric" });
  const seasonal = getSeasonalKeywords();

  const pickOne = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const queries: { category: TrendCategory; query: string }[] = [];

  // 1. Search Intent (2) — rotating question-framing
  const intentFrames = [
    `${ctx.niche} häufigste Fragen ${year}`,
    `${ctx.niche} was Anfänger wissen müssen ${year}`,
    `${ctx.niche} Fehler die alle machen`,
    `${ctx.niche} Tipps die wirklich funktionieren ${year}`,
    `${ctx.niche} worauf achten bei Auswahl`,
  ];
  queries.push({ category: "search_intent", query: pickOne(intentFrames) });
  queries.push({ category: "search_intent", query: pickOne(intentFrames.filter(q => !queries.some(x => x.query === q))) });

  // 2. Viral/Social (2) — rotating social framing
  const viralFrames = [
    `${ctx.niche} viral TikTok Reels ${monthLabel}`,
    `${ctx.niche} Reels die viral gingen ${year}`,
    `${ctx.niche} kontroverse Meinung ${monthLabel}`,
    `${ctx.niche} Hot Take ${monthLabel}`,
  ];
  queries.push({ category: "viral", query: pickOne(viralFrames) });
  queries.push({ category: "viral", query: pickOne(viralFrames.filter(q => !queries.some(x => x.query === q))) });

  // 3. News/Current Events (2)
  queries.push(
    { category: "news", query: `${ctx.niche} News aktuell ${monthLabel}` },
    { category: "news", query: `${ctx.niche} neue Studie OR neues Gesetz OR Änderung ${year}` },
  );

  // 4. Pain Points (2) — pick 2 rotating dimensions from the 5 structured problem types
  const dimEntries = Object.entries(ctx.customerProblemsByDim || {}).filter(([, v]) => v && v.trim().length > 3) as Array<[string, string]>;
  if (dimEntries.length > 0) {
    const shuffled = [...dimEntries].sort(() => rng() - 0.5).slice(0, 2);
    for (const [dim, text] of shuffled) {
      const kw = extractKeywords(text, 3);
      if (kw.length > 0) queries.push({ category: "pain_point", query: `${ctx.niche} ${kw.slice(0, 2).join(" ")} ${year}` });
    }
  } else {
    // Fallback: use aggregated pain text
    const painKeywords = extractKeywords(ctx.customerProblems, 3);
    if (painKeywords.length > 0) {
      queries.push({ category: "pain_point", query: `${painKeywords.join(" ")} Lösung ${year}` });
    } else {
      queries.push({ category: "pain_point", query: `${ctx.niche} größte Probleme ${year}` });
    }
  }
  const brandKeywords = extractKeywords(ctx.brandProblem, 2);
  if (brandKeywords.length > 0) {
    queries.push({ category: "pain_point", query: `${ctx.niche} ${brandKeywords.join(" ")} Erfahrung` });
  }

  // 5. Pillar-specific (rotate order each week; take top 2)
  const pillars = [...(ctx.pillars || [])].sort(() => rng() - 0.5).slice(0, 2);
  for (const pillar of pillars) {
    queries.push({ category: "pillar", query: `${pillar} ${ctx.niche} aktuell ${monthLabel}` });
  }
  if (pillars.length === 0) {
    queries.push({ category: "pillar", query: `${ctx.niche} Mythen die falsch sind ${year}` });
  }

  // 6. Seasonal (1-2)
  queries.push({ category: "seasonal", query: `${ctx.niche} ${seasonal[0]} ${year}` });
  if (seasonal.length > 1) {
    queries.push({ category: "seasonal", query: `${ctx.niche} ${pickOne(seasonal.slice(1))} Tipps` });
  }

  // 7. Community Voices (2) — forums, Reddit, Q&A
  const communityFrames = [
    `${ctx.niche} Reddit Diskussion ${year}`,
    `${ctx.niche} site:reddit.com ${monthLabel}`,
    `${ctx.niche} Forum Erfahrungen ${year}`,
    `${ctx.niche} Quora question`,
  ];
  queries.push({ category: "community_voices", query: pickOne(communityFrames) });
  queries.push({ category: "community_voices", query: pickOne(communityFrames.filter(q => !queries.some(x => x.query === q))) });

  // 8. Adjacent Markets (1-2) — similar niches with similar problems
  const adjacent = (ctx.adjacentMarkets || []).slice(0, 2);
  if (adjacent.length > 0) {
    for (const market of adjacent) {
      queries.push({ category: "adjacent_market", query: `${market} ähnlich wie ${ctx.niche} Probleme` });
    }
  } else {
    queries.push({ category: "adjacent_market", query: `${ctx.niche} Alternative Nische Trends ${year}` });
  }

  // 9. Objection (1-2) — what stops customers from buying coreOffer
  if (ctx.coreOffer) {
    const offerKw = extractKeywords(ctx.coreOffer, 2);
    if (offerKw.length > 0) {
      queries.push({ category: "objection", query: `${offerKw.join(" ")} lohnt sich nicht warum` });
      queries.push({ category: "objection", query: `${offerKw.join(" ")} Kritik Erfahrung negativ` });
    }
  } else {
    queries.push({ category: "objection", query: `${ctx.niche} Betrug OR Scam OR "lohnt sich nicht"` });
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

export function countDistinctCategoriesWithResults(results: DeepTrendResult[]): number {
  const s = new Set<string>();
  for (const r of results) if (r.results.length > 0) s.add(r.category);
  return s.size;
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
    community_voices: "COMMUNITY VOICES — O-Töne aus Foren, Reddit, Q&A",
    adjacent_market: "ADJACENT MARKETS — Ähnliche Nischen mit ähnlichen Problemen",
    objection: "OBJECTIONS — Einwände und Kauf-Blocker rund ums Offer",
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
