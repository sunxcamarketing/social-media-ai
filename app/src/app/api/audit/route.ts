import { NextRequest } from "next/server";
import { appendLead } from "@/lib/csv";
import { scrapeCreatorStats, scrapeReels } from "@/lib/apify";
import type { ApifyReel } from "@/lib/apify";
import Anthropic from "@anthropic-ai/sdk";

function sendEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

function buildAuditPrompt(profile: {
  username: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
}, reels: ApifyReel[], lang: string) {
  const reelsSummary = reels
    .sort((a, b) => (b.videoPlayCount || 0) - (a.videoPlayCount || 0))
    .map((r, i) => {
      const engagement = r.videoPlayCount > 0
        ? (((r.likesCount || 0) + (r.commentsCount || 0)) / r.videoPlayCount * 100).toFixed(2)
        : "0";
      return `${i + 1}. Views: ${r.videoPlayCount?.toLocaleString() || 0} | Likes: ${r.likesCount?.toLocaleString() || 0} | Comments: ${r.commentsCount || 0} | Duration: ${r.videoDuration || "?"}s | Engagement: ${engagement}% | Date: ${r.timestamp?.slice(0, 10) || "?"}`;
    })
    .join("\n");

  const isDE = lang === "de";

  return `${isDE ? "Du bist ein Instagram-Wachstumsexperte und analysierst das folgende Profil." : "You are an Instagram growth expert analyzing the following profile."}

# PROFIL
- Username: @${profile.username}
- Followers: ${profile.followers?.toLocaleString() || "?"}
- Reels (letzte 30 Tage): ${profile.reelsCount30d}
- Durchschnittliche Views (30 Tage): ${profile.avgViews30d?.toLocaleString() || "?"}

# LETZTE REELS (sortiert nach Views)
${reelsSummary || "Keine Reels gefunden."}

# AUFGABE
${isDE
  ? `Erstelle einen professionellen Instagram-Audit-Report auf Deutsch. Strukturiere ihn exakt so:

## Profil-Überblick
Zusammenfassung des aktuellen Stands in 2-3 Sätzen.

## Stärken
2-3 konkrete Punkte die bereits gut funktionieren. Beziehe dich auf die Daten.

## Verbesserungspotenzial
3-4 konkrete Schwächen mit Erklärung warum sie das Wachstum bremsen.

## Content-Analyse
Analysiere die Reel-Performance: Engagement-Rate, beste vs. schlechteste Videos, optimale Videolänge, Posting-Frequenz.

## Sofort-Maßnahmen
3 konkrete, sofort umsetzbare Tipps. Keine generischen Ratschläge — beziehe dich auf die echten Daten dieses Profils.

## Wachstumsprognose
Realistisches Potenzial bei konsequenter Umsetzung der Empfehlungen (3-6 Monate Horizont).`
  : `Create a professional Instagram audit report in English. Structure it exactly like this:

## Profile Overview
Summary of the current state in 2-3 sentences.

## Strengths
2-3 specific points that are already working well. Reference the data.

## Areas for Improvement
3-4 specific weaknesses with explanation of why they limit growth.

## Content Analysis
Analyze reel performance: engagement rate, best vs. worst videos, optimal video length, posting frequency.

## Immediate Action Items
3 specific, immediately actionable tips. No generic advice — reference this profile's actual data.

## Growth Forecast
Realistic potential with consistent implementation of recommendations (3-6 month horizon).`}

${isDE ? "Schreibe klar, direkt und professionell. Nutze die echten Zahlen aus den Daten." : "Write clearly, directly, and professionally. Use the actual numbers from the data."}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { firstName, lastName, email, instagramHandle, lang = "de" } = body;

  if (!firstName || !lastName || !email || !instagramHandle) {
    return new Response(JSON.stringify({ error: "All fields are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const username = instagramHandle.replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/\/$/, "");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Save lead
        appendLead({
          id: crypto.randomUUID(),
          firstName,
          lastName,
          email,
          instagramHandle: username,
          createdAt: new Date().toISOString(),
          reportGenerated: "false",
        });

        // Phase 1: Scrape profile
        sendEvent(controller, { phase: "scraping" });
        let profile;
        try {
          profile = await scrapeCreatorStats(username);
        } catch {
          sendEvent(controller, { phase: "error", message: `Instagram-Profil @${username} konnte nicht gefunden werden.` });
          controller.close();
          return;
        }

        sendEvent(controller, {
          phase: "profile_loaded",
          profile: {
            username,
            followers: profile.followers,
            reelsCount30d: profile.reelsCount30d,
            avgViews30d: profile.avgViews30d,
            profilePicUrl: profile.profilePicUrl,
          },
        });

        // Phase 2: Scrape reels
        sendEvent(controller, { phase: "reels" });
        let reels: ApifyReel[] = [];
        try {
          reels = await scrapeReels(username, 12, 30);
        } catch {
          // Continue with empty reels — profile data alone is still useful
        }

        sendEvent(controller, { phase: "reels_loaded", count: reels.length });

        // Phase 3: Claude analysis
        sendEvent(controller, { phase: "analyzing" });

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          sendEvent(controller, { phase: "error", message: "ANTHROPIC_API_KEY not configured" });
          controller.close();
          return;
        }

        const client = new Anthropic({ apiKey });
        const prompt = buildAuditPrompt(
          { username, followers: profile.followers, reelsCount30d: profile.reelsCount30d, avgViews30d: profile.avgViews30d },
          reels,
          lang,
        );

        const message = await client.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        });

        const block = message.content[0];
        const report = block.type === "text" ? block.text : "";

        sendEvent(controller, {
          phase: "done",
          report,
          profile: {
            username,
            followers: profile.followers,
            reelsCount30d: profile.reelsCount30d,
            avgViews30d: profile.avgViews30d,
            profilePicUrl: profile.profilePicUrl,
          },
          reelsCount: reels.length,
        });
      } catch (err) {
        sendEvent(controller, {
          phase: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
