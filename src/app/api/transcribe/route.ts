import { NextResponse } from "next/server";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";

export const maxDuration = 120;

const GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const TRANSCRIBE_PROMPT = `Transcribe the spoken words in this video verbatim.
Return ONLY the transcript — no descriptions, no speaker labels, no timestamps, no formatting marks.
Just the exact words spoken, as plain text. If multiple speakers, just continue without labels.`;

function detectPlatform(url: string): "youtube" | "instagram" | "tiktok" | "unknown" {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/tiktok\.com/.test(url)) return "tiktok";
  return "unknown";
}

async function transcribeYouTube(youtubeUrl: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");

  const res = await fetch(`${GEMINI_GENERATE_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { fileData: { fileUri: youtubeUrl } },
          { text: TRANSCRIBE_PROMPT },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

async function getInstagramVideoUrl(postUrl: string): Promise<string> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN not set");

  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [postUrl],
        resultsType: "posts",
        resultsLimit: 1,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(50_000),
    }
  );

  if (!res.ok) throw new Error(`Apify error ${res.status}`);
  const data = await res.json() as { videoUrl?: string }[];
  const videoUrl = data[0]?.videoUrl;
  if (!videoUrl) throw new Error("Kein Video in diesem Instagram-Post gefunden.");
  return videoUrl;
}

async function getTikTokVideoUrl(postUrl: string): Promise<string> {
  const res = await fetch(`https://tikwm.com/api/?url=${encodeURIComponent(postUrl)}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`TikTok-Video-Extraktion fehlgeschlagen: ${res.status}`);
  const data = await res.json() as { code: number; msg: string; data?: { play?: string; hdplay?: string } };

  if (data.code !== 0 || !data.data) {
    throw new Error(`TikTok-Video konnte nicht extrahiert werden: ${data.msg || "Unbekannter Fehler"}`);
  }

  const videoUrl = data.data.hdplay || data.data.play;
  if (!videoUrl) throw new Error("Kein Video in diesem TikTok-Post gefunden.");
  return videoUrl;
}

async function downloadVideoBuffer(videoUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.instagram.com/",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Video-Download fehlgeschlagen: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "video/mp4";
  const mimeType = contentType.split(";")[0].trim();
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const url: string = body.url?.trim() || "";

  if (!url) return NextResponse.json({ error: "URL fehlt" }, { status: 400 });

  const platform = detectPlatform(url);

  try {
    let transcript = "";

    if (platform === "youtube") {
      transcript = await transcribeYouTube(url);

    } else if (platform === "instagram") {
      const videoUrl = await getInstagramVideoUrl(url);
      const { buffer, mimeType } = await downloadVideoBuffer(videoUrl);
      const { uri, mimeType: uploadedMime } = await uploadVideo(buffer, mimeType);
      transcript = await analyzeVideo(uri, uploadedMime, TRANSCRIBE_PROMPT, 2);

    } else if (platform === "tiktok") {
      const videoUrl = await getTikTokVideoUrl(url);
      const { buffer, mimeType } = await downloadVideoBuffer(videoUrl);
      const { uri, mimeType: uploadedMime } = await uploadVideo(buffer, mimeType);
      transcript = await analyzeVideo(uri, uploadedMime, TRANSCRIBE_PROMPT, 2);

    } else {
      return NextResponse.json({ error: "Nicht unterstützte URL. Bitte eine YouTube-, Instagram- oder TikTok-URL einfügen." }, { status: 400 });
    }

    // Strip Gemini's hash-prefixed output artifacts
    const hashIdx = transcript.indexOf("#");
    if (hashIdx === 0) transcript = transcript.substring(hashIdx);

    return NextResponse.json({ transcript, platform });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
