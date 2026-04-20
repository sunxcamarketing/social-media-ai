import { NextResponse } from "next/server";
import { readConfig, updateConfig } from "@/lib/csv";
import { scrapeReels } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { persistImage } from "@/lib/persist-image";

export const maxDuration = 300; // 5 min

const PERFORMANCE_PROMPT = `Analysiere dieses Instagram Reel sorgfältig. Es ist eines der erfolgreichsten Videos dieses Creators.

Antworte AUF DEUTSCH und EXAKT in diesem Format (jedes Label auf einer eigenen Zeile):

THEMA: [Worum geht es in diesem Video? 1 prägnanter Satz]
AUDIO HOOK: [Die exakten ersten gesprochenen Worte — wörtlich zitieren. Falls keine Sprache, schreibe "keine"]
TEXT HOOK: [Text, der in den ersten 2 Sekunden auf dem Bildschirm erscheint — exakt zitieren. Falls keiner, schreibe "keine"]
SKRIPT-ZUSAMMENFASSUNG: [Fasse das gesamte Skript/die Erzählung in 3–5 Sätzen zusammen]
WARUM ERFOLGREICH: [Warum hat dieses Video so gut performt? Analysiere: Hook-Stärke, Themen-Resonanz, emotionaler Trigger, Retention-Mechaniken. 2–4 Sätze]
WIE REPLIZIEREN: [2–3 konkrete, umsetzbare Wege, ein ähnlich erfolgreiches Video für die Zielgruppe dieses Creators zu erstellen. 2–4 Sätze]`;

export interface VideoInsight {
  url: string;
  thumbnail: string;
  views: number;
  likes: number;
  datePosted: string;
  durationSeconds: number;
  topic: string;
  audioHook: string;
  textHook: string;
  scriptSummary: string;
  whyItWorked: string;
  howToReplicate: string;
}

export interface PerformanceInsights {
  scrapedAt: string;
  scrapeWindowDays: number;
  top30Days: VideoInsight[];
  topAllTime: VideoInsight[];
}

function parseAnalysis(raw: string): Pick<VideoInsight, "topic" | "audioHook" | "textHook" | "scriptSummary" | "whyItWorked" | "howToReplicate"> {
  const get = (label: string) => {
    const re = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z /]+:|$)`, "i");
    const m = raw.match(re);
    return m ? m[1].trim() : "";
  };
  return {
    topic: get("THEMA"),
    audioHook: get("AUDIO HOOK"),
    textHook: get("TEXT HOOK"),
    scriptSummary: get("SKRIPT-ZUSAMMENFASSUNG"),
    whyItWorked: get("WARUM ERFOLGREICH"),
    howToReplicate: get("WIE REPLIZIEREN"),
  };
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = await readConfig(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawHandle = config.instagram || "";
  const username = rawHandle
    .replace(/^@/, "")
    .replace(/.*instagram\.com\/([^/?]+).*/, "$1")
    .replace(/\/$/, "")
    .trim();

  if (!username) {
    return NextResponse.json(
      { error: "No Instagram handle set for this client. Add it in the client settings." },
      { status: 400 }
    );
  }

  // Scrape last 365 days, up to 100 reels
  const SCRAPE_WINDOW_DAYS = 365;
  const reels = await scrapeReels(username, 100, SCRAPE_WINDOW_DAYS);

  const cutoff30 = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const allVideos = reels
    .filter((r) => r.videoUrl && r.timestamp)
    .map((r) => ({
      videoUrl: r.videoUrl,
      url: r.url,
      views: r.videoPlayCount || 0,
      likes: r.likesCount || 0,
      thumbnail: r.images?.[0] || r.displayUrl || r.thumbnailSrc || "",
      datePosted: r.timestamp.split("T")[0],
      isRecent: new Date(r.timestamp).getTime() >= cutoff30,
    }))
    .sort((a, b) => b.views - a.views);

  // Top 2 from last 30 days, top 2 from older (all-time beyond 30 days)
  const top30Days = allVideos.filter((v) => v.isRecent).slice(0, 2);
  const topAllTime = allVideos.filter((v) => !v.isRecent).slice(0, 2);

  async function analyzeOne(video: (typeof allVideos)[0]): Promise<VideoInsight | null> {
    try {
      const resp = await fetch(video.videoUrl, { signal: AbortSignal.timeout(30_000) });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const mime = resp.headers.get("content-type") || "video/mp4";
      const fileData = await uploadVideo(buf, mime);
      const raw = await analyzeVideo(fileData.uri, fileData.mimeType, PERFORMANCE_PROMPT);
      const permanentThumb = await persistImage(video.thumbnail, "performance");
      return { url: video.url, thumbnail: permanentThumb, views: video.views, likes: video.likes, datePosted: video.datePosted, durationSeconds: 0, ...parseAnalysis(raw) };
    } catch (err) {
      console.error(`Failed to analyze video ${video.url}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  const [top30Raw, topAllRaw] = await Promise.all([
    Promise.all(top30Days.map(analyzeOne)),
    Promise.all(topAllTime.map(analyzeOne)),
  ]);

  const top30Results = top30Raw.filter((v): v is VideoInsight => v !== null);
  const topAllResults = topAllRaw.filter((v): v is VideoInsight => v !== null);

  const attempted = top30Days.length + topAllTime.length;
  if (attempted > 0 && top30Results.length === 0 && topAllResults.length === 0) {
    return NextResponse.json(
      { error: "Gemini-Analyse fehlgeschlagen für alle Videos. API vermutlich überlastet — in paar Minuten erneut versuchen." },
      { status: 503 }
    );
  }

  const insights: PerformanceInsights = {
    scrapedAt: new Date().toISOString().slice(0, 10),
    scrapeWindowDays: SCRAPE_WINDOW_DAYS,
    top30Days: top30Results,
    topAllTime: topAllResults,
  };

  // Persist
  await updateConfig(id, { performanceInsights: JSON.stringify(insights) });

  return NextResponse.json(insights);
}
