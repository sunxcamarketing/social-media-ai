// ── Background Job: Trend Refresh ──────────────────────────────────────────
// Runs deep Brave Search for niche-specific trends and saves as snapshot.

import { readConfig } from "../csv";
import { searchTrendsDeep } from "../brave-search";
import { safeJsonParse } from "../safe-json";
import { saveSnapshot } from "../intelligence";

export async function refreshTrends(clientId: string): Promise<{ totalResults: number }> {
  const config = await readConfig(clientId);
  if (!config) throw new Error(`Config not found: ${clientId}`);

  const pillars: { name: string }[] = safeJsonParse(config.strategyPillars, []);
  const customerProblems = safeJsonParse(config.customerProblems);

  const results = await searchTrendsDeep({
    niche: config.creatorsCategory || "Social Media",
    pillars: pillars.map(p => p.name).slice(0, 3),
    customerProblems: [customerProblems.mental, customerProblems.emotional, customerProblems.practical].filter(Boolean).join(". "),
    brandProblem: config.brandProblem || undefined,
    businessContext: config.businessContext || undefined,
  });

  const totalResults = results.reduce((sum, r) => sum + r.results.length, 0);

  await saveSnapshot(clientId, "web_trends", {
    niche: config.creatorsCategory || "Social Media",
    searches: results,
    totalResults,
  }, { expiryDays: 14 });

  return { totalResults };
}
