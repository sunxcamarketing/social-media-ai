import { NextResponse } from "next/server";
import { readConfigs, writeConfigs } from "@/lib/csv";
import { scrapeReels } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";

export const maxDuration = 300; // 5 min

const PERFORMANCE_PROMPT = `Analyze this Instagram Reel carefully. It is one of the creator's top-performing videos.

Answer EXACTLY in this format (keep every label on its own line):

TOPIC: [What is this video about? 1 concise sentence]
AUDIO HOOK: [The exact first spoken words — quote them verbatim. If no speech, write "none"]
TEXT HOOK: [Any text shown on screen in the first 2 seconds — quote exactly. If none, write "none"]
SCRIPT SUMMARY: [Summarize the full script/narrative in 3–5 sentences]
WHY IT WORKED: [Why did this video perform well? Analyze: hook strength, topic resonance, emotional trigger, retention mechanics. 2–4 sentences]
HOW TO REPLICATE: [2–3 specific, actionable ways to create a similar high-performing video for this creator's audience. 2–4 sentences]`;

export interface VideoInsight {
  url: string;
  thumbnail: string;
  views: number;
  likes: number;
  datePosted: string;
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
    topic: get("TOPIC"),
    audioHook: get("AUDIO HOOK"),
    textHook: get("TEXT HOOK"),
    scriptSummary: get("SCRIPT SUMMARY"),
    whyItWorked: get("WHY IT WORKED"),
    howToReplicate: get("HOW TO REPLICATE"),
  };
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const configs = readConfigs();
  const config = configs.find((c) => c.id === id);
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
      thumbnail: r.images?.[0] || "",
      datePosted: r.timestamp.split("T")[0],
      isRecent: new Date(r.timestamp).getTime() >= cutoff30,
    }))
    .sort((a, b) => b.views - a.views);

  // Top 2 from last 30 days, top 2 from older (all-time beyond 30 days)
  const top30Days = allVideos.filter((v) => v.isRecent).slice(0, 2);
  const topAllTime = allVideos.filter((v) => !v.isRecent).slice(0, 2);

  async function analyzeOne(video: (typeof allVideos)[0]): Promise<VideoInsight> {
    const resp = await fetch(video.videoUrl);
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const mime = resp.headers.get("content-type") || "video/mp4";
    const fileData = await uploadVideo(buf, mime);
    const raw = await analyzeVideo(fileData.uri, fileData.mimeType, PERFORMANCE_PROMPT);
    return { url: video.url, thumbnail: video.thumbnail, views: video.views, likes: video.likes, datePosted: video.datePosted, ...parseAnalysis(raw) };
  }

  const [top30Results, topAllResults] = await Promise.all([
    Promise.all(top30Days.map(analyzeOne)),
    Promise.all(topAllTime.map(analyzeOne)),
  ]);

  const insights: PerformanceInsights = {
    scrapedAt: new Date().toISOString().slice(0, 10),
    scrapeWindowDays: SCRAPE_WINDOW_DAYS,
    top30Days: top30Results,
    topAllTime: topAllResults,
  };

  // Persist
  const idx = configs.findIndex((c) => c.id === id);
  configs[idx] = { ...configs[idx], performanceInsights: JSON.stringify(insights) };
  writeConfigs(configs);

  return NextResponse.json(insights);
}
