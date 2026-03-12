import { NextRequest } from "next/server";
import { updateLeadReport } from "@/lib/csv";
import { generateAuditPDF } from "@/lib/pdf";
import { sendAuditReport } from "@/lib/email";
import Anthropic from "@anthropic-ai/sdk";

interface ReelData {
  videoPlayCount: number;
  likesCount: number;
  commentsCount: number;
  videoDuration: number;
  timestamp: string;
}

function buildFullReportPrompt(profile: {
  username: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
}, reels: ReelData[], lang: string) {
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
  try {
    const { leadId, firstName, email, username, profile, reelsData, lang = "de" } = await req.json();

    if (!leadId || !email || !username || !profile) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Generate full detailed report
    const client = new Anthropic({ apiKey });
    const prompt = buildFullReportPrompt(profile, reelsData || [], lang);

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const block = message.content[0];
    const report = block.type === "text" ? block.text : "";

    // Generate PDF
    const pdfBuffer = await generateAuditPDF(report, profile);

    // Send email
    await sendAuditReport({
      to: email,
      firstName: firstName || "Hi",
      username,
      pdfBuffer,
    });

    // Update lead status
    updateLeadReport(leadId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-report] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
