import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs } from "@/lib/csv";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export interface CreatorSuggestion {
  username: string;
  name: string;
  why: string;
  strength: string;
  contentStyle: string;
  estimatedFollowers: string;
  tier: "mega" | "macro" | "mid" | "micro";
  confidence: number;
  verified?: boolean;
  realFollowers?: number;
  profilePicUrl?: string;
}

type AiCreator = Omit<CreatorSuggestion, "verified" | "realFollowers" | "profilePicUrl">;

async function verifyBatch(usernames: string[], token: string): Promise<Map<string, { followers: number; profilePicUrl: string }>> {
  const results = await Promise.allSettled(
    usernames.map(async (username) => {
      const res = await fetch(
        `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directUrls: [`https://www.instagram.com/${username}/`],
            resultsType: "details",
            resultsLimit: 1,
          }),
          signal: AbortSignal.timeout(35_000),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const p = data[0];
      if (!p || !p.username) return null;
      return { username: (p.username as string).toLowerCase(), followers: (p.followersCount as number) || 0, profilePicUrl: (p.profilePicUrl as string) || "" };
    })
  );

  const map = new Map<string, { followers: number; profilePicUrl: string }>();
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      map.set(r.value.username, { followers: r.value.followers, profilePicUrl: r.value.profilePicUrl });
    }
  }
  return map;
}

function tierFromFollowers(n: number): "mega" | "macro" | "mid" | "micro" {
  if (n >= 1_000_000) return "mega";
  if (n >= 100_000)   return "macro";
  if (n >= 10_000)    return "mid";
  return "micro";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const apifyToken = process.env.APIFY_API_TOKEN;

  const body = await request.json().catch(() => ({}));
  const focusHint: string = body.focus || "";

  const context = [
    config.creatorsCategory && `Nische: ${config.creatorsCategory}`,
    config.businessContext  && `Business-Kontext: ${config.businessContext}`,
    config.brandProblem     && `Kernproblem: ${config.brandProblem}`,
    config.dreamCustomer    && `Zielgruppe: ${config.dreamCustomer}`,
    focusHint               && `Fokus: ${focusHint}`,
  ].filter(Boolean).join("\n");

  const client = new Anthropic({ apiKey, timeout: 110_000 });

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    tools: [
      {
        name: "submit_creators",
        description: "Submit Instagram creator candidates for competitor analysis",
        input_schema: {
          type: "object" as const,
          properties: {
            creators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  username:           { type: "string", description: "Exact Instagram username — no @, no URL, no spaces" },
                  estimatedFollowers: { type: "string", description: "Estimated follower count, e.g. '2.3M' or '450K'" },
                  tier:               { type: "string", enum: ["mega", "macro", "mid", "micro"] },
                  why:                { type: "string", description: "Why this creator is relevant (1–2 sentences)" },
                  strength:           { type: "string", description: "Their main strength, e.g. 'Viraler Storyteller', 'Massenreichweite'" },
                  contentStyle:       { type: "string", description: "Their content style or format" },
                  confidence:         { type: "number", description: "0–10: certainty that this exact username is correct on Instagram" },
                },
                required: ["username", "estimatedFollowers", "tier", "why", "strength", "contentStyle", "confidence"],
              },
              minItems: 8,
              maxItems: 10,
            },
          },
          required: ["creators"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_creators" },
    messages: [
      {
        role: "user",
        content: `Find the BIGGEST and most influential Instagram creators in this niche for competitor analysis.

CONTEXT:
${context}

Include two types:
1. REACH creators — massive follower counts (500K+, 1M+, 5M+)
2. VIRAL creators — known for getting disproportionately high views vs followers (breakout hits, viral reels)

RULES:
- Suggest exactly 10 creators, prioritizing mega and macro influencers
- Only suggest accounts you have strong knowledge of from training data
- Rate confidence 0–10 per username. Be honest — if you're not sure of the exact handle, give it a 5 or lower
- Do NOT invent names. Skip any creator where you're unsure of the exact username
- Think of actual famous people, brands, and personalities in this space — not small accounts

Return the exact Instagram handle only (no @, no URL).`,
      },
    ],
  });

  const tool = msg.content.find((b) => b.type === "tool_use");
  if (!tool || tool.type !== "tool_use") {
    return NextResponse.json({ error: "KI konnte keine Creator generieren." }, { status: 500 });
  }

  const { creators } = tool.input as { creators: AiCreator[] };

  const cleaned: AiCreator[] = creators
    .map((c) => ({
      ...c,
      username: c.username
        .replace(/^@/, "")
        .replace(/.*instagram\.com\//, "")
        .replace(/\/$/, "")
        .split("?")[0]
        .trim()
        .toLowerCase(),
    }))
    .filter((c) => c.username.length > 0 && !c.username.includes(" "))
    .sort((a, b) => b.confidence - a.confidence);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "Keine Creator gefunden. Versuche einen anderen Fokus." }, { status: 422 });
  }

  // Verify in batches of 5 via Apify (skip if no token)
  let verifiedMap = new Map<string, { followers: number; profilePicUrl: string }>();
  if (apifyToken) {
    const batch1 = cleaned.slice(0, 5).map((c) => c.username);
    const batch2 = cleaned.slice(5, 10).map((c) => c.username);
    const [map1, map2] = await Promise.all([
      verifyBatch(batch1, apifyToken),
      verifyBatch(batch2, apifyToken),
    ]);
    verifiedMap = new Map([...map1, ...map2]);
  }

  const suggestions: CreatorSuggestion[] = cleaned
    .map((c) => {
      const verified = verifiedMap.get(c.username);
      if (apifyToken && !verified) return null; // not found on Instagram
      return {
        ...c,
        verified: !!verified,
        realFollowers: verified?.followers,
        profilePicUrl: verified?.profilePicUrl,
        tier: verified ? tierFromFollowers(verified.followers) : c.tier,
        estimatedFollowers: verified
          ? verified.followers >= 1_000_000
            ? `${(verified.followers / 1_000_000).toFixed(1)}M`
            : `${Math.round(verified.followers / 1_000)}K`
          : c.estimatedFollowers,
      };
    })
    .filter(Boolean) as CreatorSuggestion[];

  if (suggestions.length === 0) {
    return NextResponse.json({ error: "Keine verifizierten Creator gefunden. Versuche einen anderen Fokus." }, { status: 422 });
  }

  return NextResponse.json({ suggestions, source: apifyToken ? "verified" : "ai" });
}
