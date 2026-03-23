import { NextRequest } from "next/server";
import { scrapeCreatorStats } from "@/lib/apify";
import type { ApifyReel } from "@/lib/apify";
import Anthropic from "@anthropic-ai/sdk";

function sendEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

function buildFullReportPrompt(profile: {
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
      const reelUrl = r.url || "";
      return `Reel ${i + 1}: Views: ${r.videoPlayCount?.toLocaleString() || 0} | Likes: ${r.likesCount?.toLocaleString() || 0} | Comments: ${r.commentsCount || 0} | Duration: ${r.videoDuration || "?"}s | Engagement: ${engagement}% | Date: ${r.timestamp?.slice(0, 10) || "?"}${reelUrl ? ` | URL: ${reelUrl}` : ""}`;
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
  ? `Erstelle einen professionellen, ausführlichen Instagram-Audit-Report auf Deutsch. Strukturiere ihn exakt so:

## Profil-Überblick
Zusammenfassung des aktuellen Stands in 3-4 Sätzen. Bewerte die Gesamtperformance.

## Stärken
3-4 konkrete Punkte die bereits gut funktionieren. Beziehe dich auf die echten Daten und erkläre warum sie stark sind.

## Verbesserungspotenzial
4-5 konkrete Schwächen mit detaillierter Erklärung warum sie das Wachstum bremsen. Nutze die Zahlen.

## Content-Analyse
Detaillierte Analyse der Reel-Performance:
- Durchschnittliche Engagement-Rate und Einordnung
- Beste vs. schlechteste Videos (mit konkreten Zahlen)
- Optimale Videolänge basierend auf den Daten
- Posting-Frequenz und Konsistenz
- Muster bei erfolgreichen vs. schwachen Videos

## Sofort-Maßnahmen
5 konkrete, sofort umsetzbare Tipps. Keine generischen Ratschläge — beziehe dich auf die echten Daten dieses Profils. Erkläre bei jedem Tipp warum er funktionieren wird.

## Content-Strategie Empfehlung
Empfehle eine konkrete Posting-Strategie:
- Optimale Posting-Frequenz
- Beste Videolänge
- Content-Typen die basierend auf den Daten am besten funktionieren
- Hook-Strategie basierend auf den Top-Videos

## Wachstumsprognose
Kompakte, realistische Prognose bei konsequenter Umsetzung. Maximal 5 Bullet Points:
- **Follower-Ziel (6 Monate):** konkreter Zielbereich mit 1 Satz Begründung
- **View-Ziel:** erwartete Ø Views mit 1 Satz Begründung
- **Wichtigster Hebel:** der eine Faktor der am meisten Impact haben wird (2-3 Sätze)
- **Kurzfristig (Monat 1-2):** was zuerst passiert
- **Mittelfristig (Monat 3-6):** was danach kommt`
  : `Create a professional, detailed Instagram audit report in English. Structure it exactly like this:

## Profile Overview
Summary of the current state in 3-4 sentences. Rate overall performance.

## Strengths
3-4 specific points that are already working well. Reference the real data and explain why they're strong.

## Areas for Improvement
4-5 specific weaknesses with detailed explanation of why they limit growth. Use the numbers.

## Content Analysis
Detailed analysis of reel performance:
- Average engagement rate and benchmark
- Best vs. worst videos (with specific numbers)
- Optimal video length based on data
- Posting frequency and consistency
- Patterns in successful vs. weak videos

## Immediate Action Items
5 specific, immediately actionable tips. No generic advice — reference this profile's actual data. Explain why each tip will work.

## Content Strategy Recommendation
Recommend a specific posting strategy:
- Optimal posting frequency
- Best video length
- Content types that work best based on the data
- Hook strategy based on top videos

## Growth Forecast
Compact, realistic forecast with consistent implementation. Maximum 5 bullet points:
- **Follower target (6 months):** specific target range with 1 sentence reasoning
- **View target:** expected average views with 1 sentence reasoning
- **Biggest lever:** the one factor with most impact (2-3 sentences)
- **Short-term (month 1-2):** what happens first
- **Mid-term (month 3-6):** what comes next`}

${isDE
  ? `WICHTIGE FORMATIERUNGSREGELN:
- Schreibe klar, direkt und auf den Punkt
- Jede Section beginnt mit 1-2 Sätzen Zusammenfassung, dann Details
- Nutze **Fettdruck** für alle wichtigen Zahlen und Kernaussagen — der Leser soll beim Überfliegen sofort die Key Facts sehen
- Verwende Bullet Points (nicht Tabellen) um Daten darzustellen
- Jeder Bullet Point: 1-2 Sätze, beginnt mit dem **wichtigsten Punkt fett**
- Nutze ### Zwischenüberschriften um längere Sections zu gliedern (Content-Analyse, Sofort-Maßnahmen)
- Absätze mit Leerzeilen dazwischen trennen
- KEINE Markdown-Tabellen verwenden
- Qualität > Quantität: lieber 3 starke Punkte als 6 schwache
- Wenn du ein bestimmtes Reel erwähnst, verlinke es als Markdown-Link: [Reel 3](URL). Die URLs findest du in den Reel-Daten oben.`
  : `IMPORTANT FORMATTING RULES:
- Write clearly, directly, and to the point
- Each section starts with 1-2 summary sentences, then details
- Use **bold** for all key numbers and core statements — the reader should see key facts when scanning
- Use bullet points (not tables) to present data
- Each bullet point: 1-2 sentences, starts with the **most important point in bold**
- Use ### sub-headers to break up longer sections (Content Analysis, Action Items)
- Separate paragraphs with blank lines
- DO NOT use markdown tables
- Quality > quantity: 3 strong points beat 6 weak ones
- When referencing a specific reel, link it as a markdown link: [Reel 3](URL). The URLs are in the reel data above.`}`;
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { instagramHandle, lang = "de" } = body;

  if (!instagramHandle) {
    return new Response(JSON.stringify({ error: "Instagram handle is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const username = instagramHandle.replace(/^@/, "").replace(/.*instagram\.com\//, "").replace(/\/$/, "");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Phase 1: Scrape profile + reels (parallel)
        sendEvent(controller, { phase: "scraping" });
        let profile;
        try {
          profile = await scrapeCreatorStats(username);
        } catch (scrapeErr) {
          const msg = scrapeErr instanceof Error ? scrapeErr.message : `Instagram-Profil @${username} konnte nicht gefunden werden.`;
          console.error("Audit scrape error:", msg);
          sendEvent(controller, { phase: "error", message: msg });
          controller.close();
          return;
        }

        const profileData = {
          username,
          followers: profile.followers,
          reelsCount30d: profile.reelsCount30d,
          avgViews30d: profile.avgViews30d,
          profilePicUrl: profile.profilePicUrl,
        };

        sendEvent(controller, { phase: "profile_loaded", profile: profileData });

        const reels: ApifyReel[] = profile.reels || [];
        sendEvent(controller, { phase: "reels_loaded", count: reels.length });

        // Phase 2: Full detailed Claude analysis
        sendEvent(controller, { phase: "analyzing" });

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          sendEvent(controller, { phase: "error", message: "ANTHROPIC_API_KEY not configured" });
          controller.close();
          return;
        }

        const client = new Anthropic({ apiKey });
        const prompt = buildFullReportPrompt(
          { username, followers: profile.followers, reelsCount30d: profile.reelsCount30d, avgViews30d: profile.avgViews30d },
          reels,
          lang,
        );

        const message = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        });

        const block = message.content[0];
        const report = block.type === "text" ? block.text : "";

        sendEvent(controller, {
          phase: "done",
          report,
          profile: profileData,
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
