import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readConfigs } from "@/lib/csv";

export const maxDuration = 120;

export interface CreatorSuggestion {
  username: string;
  name: string;
  why: string;
  strength: string;
  contentStyle: string;
  estimatedFollowers: string;
  tier: "mega" | "macro" | "mid" | "micro";
}

function estimateTier(avgViews: number): "mega" | "macro" | "mid" | "micro" {
  if (avgViews >= 300_000) return "mega";
  if (avgViews >= 30_000) return "macro";
  if (avgViews >= 3_000) return "mid";
  return "micro";
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

function estimateFollowers(avgViews: number): string {
  // rough: followers ≈ 8–12× avg views
  const est = avgViews * 10;
  if (est >= 1_000_000) return `~${(est / 1_000_000).toFixed(1)}M`;
  if (est >= 1_000) return `~${Math.round(est / 1_000)}K`;
  return `~${est}`;
}

interface ApifyPost {
  ownerUsername?: string;
  videoPlayCount?: number;
  likesCount?: number;
  commentsCount?: number;
}

async function scrapeHashtag(hashtag: string, limit: number): Promise<ApifyPost[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [`https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`],
          resultsType: "posts",
          resultsLimit: limit,
          addParentData: false,
        }),
      }
    );
    if (!res.ok) {
      console.error("research-creators: Apify hashtag scrape failed", res.status, await res.text().catch(() => ""));
      return [];
    }
    return (await res.json()) as ApifyPost[];
  } catch (e) {
    console.error("research-creators: Apify fetch error", e);
    return [];
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const focusHint: string = body.focus || "";

  const dreamCustomer = (() => { try { return JSON.parse(config.dreamCustomer || "{}"); } catch { return {}; } })();

  const context = [
    config.creatorsCategory  && `Niche: ${config.creatorsCategory}`,
    config.businessContext   && `Business context: ${config.businessContext}`,
    config.brandProblem      && `Core problem: ${config.brandProblem}`,
    dreamCustomer.description && `Dream customer: ${dreamCustomer.description}`,
    focusHint                && `Focus hint: ${focusHint}`,
  ].filter(Boolean).join("\n");

  const client = new Anthropic({ apiKey });

  // ── Step 1: Claude generates relevant hashtags (reliable — no usernames) ──
  const hashtagMsg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    tools: [
      {
        name: "submit_hashtags",
        description: "Submit relevant Instagram hashtags for this niche",
        input_schema: {
          type: "object" as const,
          properties: {
            hashtags: {
              type: "array",
              items: { type: "string", description: "Hashtag without # symbol" },
              minItems: 3,
              maxItems: 5,
            },
          },
          required: ["hashtags"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_hashtags" },
    messages: [
      {
        role: "user",
        content: `For this Instagram niche, suggest 3-5 relevant hashtags that active creators frequently use. Choose popular hashtags where top creators in this space would post content.

CONTEXT:
${context}

Return hashtags without the # symbol. Use the language/terms common in this niche (could be English, German, or niche-specific).`,
      },
    ],
  });

  const hashtagTool = hashtagMsg.content.find((b) => b.type === "tool_use");
  if (!hashtagTool || hashtagTool.type !== "tool_use") {
    return NextResponse.json({ error: "Hashtag-Generierung fehlgeschlagen. Bitte erneut versuchen." }, { status: 500 });
  }

  const { hashtags } = hashtagTool.input as { hashtags: string[] };

  // ── Step 2: Scrape hashtag with Apify to find REAL accounts ──
  const primaryHashtag = hashtags[0];
  const posts = await scrapeHashtag(primaryHashtag, 60);

  // ── Step 3: Aggregate real creators from posts ──
  if (posts.length > 0) {
    const creatorMap = new Map<string, { views: number; likes: number; posts: number }>();
    for (const post of posts) {
      const username = post.ownerUsername;
      if (!username) continue;
      const existing = creatorMap.get(username) || { views: 0, likes: 0, posts: 0 };
      creatorMap.set(username, {
        views: existing.views + (post.videoPlayCount || 0),
        likes: existing.likes + (post.likesCount || 0),
        posts: existing.posts + 1,
      });
    }

    const topCreators = [...creatorMap.entries()]
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 12);

    const suggestions: CreatorSuggestion[] = topCreators.map(([username, stats]) => {
      const avgViews = stats.posts > 0 ? stats.views / stats.posts : 0;
      const tier = estimateTier(avgViews);
      return {
        username,
        name: username,
        why: `Aktiv in #${primaryHashtag} — ${stats.posts} Post${stats.posts > 1 ? "s" : ""} mit Ø ${formatViews(avgViews)} Views`,
        strength:
          tier === "mega" ? "Massenreichweite" :
          tier === "macro" ? "Starke Nischen-Präsenz" :
          tier === "mid" ? "Aufsteigender Creator" :
          "Hidden Gem / Nischen-Insider",
        contentStyle: "Instagram Reels / Posts",
        estimatedFollowers: estimateFollowers(avgViews),
        tier,
      };
    });

    return NextResponse.json({ suggestions, source: "instagram", hashtag: primaryHashtag });
  }

  // ── Fallback: Apify not configured / no results → Claude with strict instructions ──
  console.warn("research-creators: Apify returned 0 posts, falling back to Claude knowledge");

  const fallbackMsg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    tools: [
      {
        name: "submit_creators",
        description: "Submit Instagram creator suggestions",
        input_schema: {
          type: "object" as const,
          properties: {
            creators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  username:           { type: "string" },
                  name:               { type: "string" },
                  why:                { type: "string" },
                  strength:           { type: "string" },
                  contentStyle:       { type: "string" },
                  estimatedFollowers: { type: "string" },
                  tier:               { type: "string", enum: ["mega", "macro", "mid", "micro"] },
                },
                required: ["username", "name", "why", "strength", "contentStyle", "estimatedFollowers", "tier"],
              },
              minItems: 5,
              maxItems: 12,
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
        content: `Suggest well-known Instagram creators for this niche. Only suggest accounts you are highly confident actually exist on Instagram — if unsure about a username, skip it.

CONTEXT:
${context}

Use the submit_creators tool to return your findings.`,
      },
    ],
  });

  const fallbackTool = fallbackMsg.content.find((b) => b.type === "tool_use");
  if (!fallbackTool || fallbackTool.type !== "tool_use") {
    return NextResponse.json({ error: "KI hat keine Vorschläge generiert. Bitte erneut versuchen." }, { status: 500 });
  }

  const { creators } = fallbackTool.input as { creators: CreatorSuggestion[] };
  if (!Array.isArray(creators) || creators.length === 0) {
    return NextResponse.json({ error: "KI hat eine leere Liste zurückgegeben. Bitte erneut versuchen." }, { status: 500 });
  }

  return NextResponse.json({ suggestions: creators, source: "ai" });
}
