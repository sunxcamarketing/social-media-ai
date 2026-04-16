import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { generateNewConcepts } from "@/lib/claude";
import { readConfig } from "@/lib/csv";
import { ANALYSIS_PROMPT, buildConceptsPrompt } from "@prompts";
import { scrapeSinglePost } from "@/lib/apify";

export const maxDuration = 120;

/**
 * POST /api/analyze-video
 * Analyze a single Instagram Reel URL: scrape → download → Gemini → Claude concepts.
 * Body: { url: string, clientId?: string }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, clientId } = await request.json();
  if (!url) return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    // Step 1: Scrape the post metadata + video URL
    const post = await scrapeSinglePost(url);
    if (!post?.videoUrl) {
      return NextResponse.json({ error: "Video konnte nicht geladen werden. Ist die URL ein öffentliches Reel?" }, { status: 400 });
    }

    // Step 2: Download video
    const videoResponse = await fetch(post.videoUrl);
    if (!videoResponse.ok) throw new Error("Video-Download fehlgeschlagen");
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    const contentType = videoResponse.headers.get("content-type") || "video/mp4";

    // Step 3: Upload + Analyze with Gemini
    const fileData = await uploadVideo(videoBuffer, contentType);
    const analysis = await analyzeVideo(fileData.uri, fileData.mimeType, ANALYSIS_PROMPT);

    // Step 4: Generate adapted concepts with Claude (if client context available)
    let concepts = "";
    if (clientId) {
      const config = await readConfig(clientId);
      if (config) {
        concepts = await generateNewConcepts(analysis, buildConceptsPrompt(config));
      }
    }

    return NextResponse.json({
      analysis,
      concepts,
      meta: {
        creator: post.ownerUsername || "",
        views: post.videoPlayCount || 0,
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        url,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analyse fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
