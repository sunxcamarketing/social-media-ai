import { NextResponse } from "next/server";
import { getAnthropicClient } from "@/lib/anthropic";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";

export const maxDuration = 30;

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    const html = await res.text();
    // Extract meta tags and clean text
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1] || "";
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)?.[1] || "";
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
    const desc = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)?.[1] || "";
    const clean = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
    return [ogTitle, ogDesc, title, desc, clean].filter(Boolean).join("\n").trim();
  } catch {
    return "";
  }
}

async function fetchInstagramPost(url: string): Promise<string> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return await fetchPageText(url);
  // Extract shortcode from URL
  const match = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (!match) return await fetchPageText(url);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directUrls: [url],
          resultsType: "posts",
          resultsLimit: 1,
        }),
        signal: AbortSignal.timeout(25000),
      }
    );
    if (!res.ok) return await fetchPageText(url);
    const data = await res.json();
    const p = data[0];
    if (!p) return await fetchPageText(url);
    return [
      p.caption && `Caption: ${p.caption}`,
      p.type && `Type: ${p.type}`,
      p.videoDuration && `Duration: ${p.videoDuration}s`,
      p.likesCount && `Likes: ${p.likesCount}`,
      p.videoViewCount && `Views: ${p.videoViewCount}`,
    ].filter(Boolean).join("\n");
  } catch {
    return await fetchPageText(url);
  }
}

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL required" }, { status: 400 });

  // Fetch content based on platform
  let pageText = "";
  if (url.includes("instagram.com")) {
    pageText = await fetchInstagramPost(url);
  } else {
    pageText = await fetchPageText(url);
  }

  const contentTypeNames = BUILT_IN_CONTENT_TYPES.map(t => t.name).join(", ");
  const formatNames = BUILT_IN_FORMATS.map(f => f.name).join(", ");

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: `Analyze this social media content and classify it.

URL: ${url}

PAGE/POST CONTENT:
${pageText || "(could not extract content — use URL and context to infer)"}

AVAILABLE CONTENT TYPES: ${contentTypeNames}
AVAILABLE FORMATS: ${formatNames}

Formats can be combined with " + " (e.g. "Voice Over + B-Roll") when the content clearly uses multiple production formats together.

Return ONLY a JSON object:
{
  "suggestedType": "exact name from AVAILABLE CONTENT TYPES",
  "suggestedFormat": "one or more AVAILABLE FORMATS joined with ' + ' if the content uses a combination",
  "reasoning": "1-2 sentences explaining why"
}`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "Could not classify content" }, { status: 500 });

  try {
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch {
    return NextResponse.json({ error: "Parse error" }, { status: 500 });
  }
}
