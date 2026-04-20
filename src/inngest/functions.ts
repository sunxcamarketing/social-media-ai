import { inngest } from "./client";
import { v4 as uuid } from "uuid";
import { readConfigs, readCreators, appendVideo } from "@/lib/csv";
import { scrapeReels } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { generateNewConcepts } from "@/lib/claude";
import { ANALYSIS_PROMPT, buildConceptsPrompt } from "@prompts";
import type { Video } from "@/lib/types";
import { pLimit } from "@/lib/concurrency";

// Concurrency limits — keep within Apify + Gemini rate-limit headroom
const SCRAPE_CONCURRENCY = 3;   // Apify actor concurrent runs
const ANALYZE_CONCURRENCY = 4;  // Gemini RPM / multimodal throughput

interface ScrapedVideo {
  videoUrl: string;
  postUrl: string;
  views: number;
  likes: number;
  comments: number;
  durationSeconds: number;
  username: string;
  thumbnail: string;
  datePosted: string;
}

export const runPipelineFunction = inngest.createFunction(
  {
    id: "run-pipeline",
    retries: 0,
    // Prevent the same client from running two video analyses in parallel —
    // protects Apify/Gemini quotas from being burned twice for the same config.
    concurrency: [
      { scope: "fn", key: "event.data.configName", limit: 1 },
      // Global safety net: max 3 video-analysis runs platform-wide at a time.
      { scope: "fn", limit: 3 },
    ],
  },
  { event: "pipeline/run" },
  async ({ event, step, publish }) => {
    const { configName, maxVideos, topK, nDays } = event.data;
    const channel = `pipeline:${event.id}`;

    const log = async (message: string, extra?: Record<string, unknown>) => {
      await publish({
        channel,
        topic: "progress",
        data: {
          timestamp: new Date().toISOString(),
          message,
          ...extra,
        },
      });
    };

    // Step 1: Load config and creators
    const { config, creators } = await step.run("load-config", async () => {
      const configs = await readConfigs();
      const config = configs.find((c) => c.configName === configName);
      if (!config) throw new Error(`Config "${configName}" not found`);

      const allCreators = await readCreators();
      const creators = allCreators.filter((c) => c.category === config.creatorsCategory);
      if (creators.length === 0) throw new Error(`No creators found for category "${config.creatorsCategory}"`);

      return { config, creators: creators.map((c) => c.username) };
    });

    await log(`Loaded config "${configName}" with ${creators.length} creators`, {
      phase: "scraping",
      creatorsTotal: creators.length,
      creatorsScraped: 0,
      videosAnalyzed: 0,
      videosTotal: 0,
      status: "running",
    });

    // Step 2: Scrape all creators in parallel (limited)
    const cutoffDate = new Date(Date.now() - nDays * 24 * 60 * 60 * 1000);
    const scrapeLimit = pLimit(SCRAPE_CONCURRENCY);
    let creatorsScraped = 0;

    await log(`Scraping ${creators.length} creators (${SCRAPE_CONCURRENCY} parallel)...`, {
      phase: "scraping",
      creatorsTotal: creators.length,
      creatorsScraped,
      status: "running",
    });

    const scrapeResults = await Promise.all(
      creators.map((username) =>
        scrapeLimit(async () => {
          const videos = await step.run(`scrape-${username}`, async () => {
            const reels = await scrapeReels(username, maxVideos, nDays);
            const parsed = reels
              .filter((r) => r.videoUrl && r.timestamp)
              .map((r) => {
                const raw = r as unknown as Record<string, unknown>;
                const thumb = r.images?.[0]
                  || r.displayUrl
                  || r.thumbnailSrc
                  || (raw.thumbnail_src as string)
                  || (raw.display_url as string)
                  || (raw.imageUrl as string)
                  || "";
                return {
                  videoUrl: r.videoUrl,
                  postUrl: r.url,
                  views: r.videoPlayCount || 0,
                  likes: r.likesCount || 0,
                  comments: r.commentsCount || 0,
                  durationSeconds: Math.round(r.videoDuration || 0),
                  username: r.ownerUsername || username,
                  thumbnail: thumb,
                  datePosted: r.timestamp?.split("T")[0] || "",
                  timestamp: new Date(r.timestamp).getTime(),
                };
              })
              .filter((v) => v.timestamp >= cutoffDate.getTime());
            parsed.sort((a, b) => b.views - a.views);
            return parsed.slice(0, topK).map(({ timestamp, ...v }) => v);
          });

          creatorsScraped++;
          await log(`@${username}: ${videos.length} top videos selected`, {
            phase: "scraping",
            creatorsTotal: creators.length,
            creatorsScraped,
            status: "running",
          });
          return videos;
        })
      )
    );
    const allTopVideos: ScrapedVideo[] = scrapeResults.flat();

    await log(`Scraping complete. ${allTopVideos.length} videos to analyze.`, {
      phase: "analyzing",
      creatorsTotal: creators.length,
      creatorsScraped,
      videosTotal: allTopVideos.length,
      videosAnalyzed: 0,
      status: "running",
    });

    // Step 3: Analyze videos in parallel (limited)
    const analyzeLimit = pLimit(ANALYZE_CONCURRENCY);
    let videosAnalyzed = 0;

    await log(`Analyzing ${allTopVideos.length} videos (${ANALYZE_CONCURRENCY} parallel)...`, {
      phase: "analyzing",
      creatorsTotal: creators.length,
      creatorsScraped,
      videosTotal: allTopVideos.length,
      videosAnalyzed,
      status: "running",
    });

    const analysisResults = await Promise.all(
      allTopVideos.map((video) =>
        analyzeLimit(async () => {
          const viewsLabel = video.views >= 1_000_000
            ? `${(video.views / 1_000_000).toFixed(1)}M`
            : video.views >= 1_000
            ? `${(video.views / 1_000).toFixed(0)}K`
            : String(video.views);

          try {
            const videoRecord = await step.run(`analyze-${video.username}-${video.views}`, async () => {
              const videoResponse = await fetch(video.videoUrl);
              if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
              const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
              const contentType = videoResponse.headers.get("content-type") || "video/mp4";

              const fileData = await uploadVideo(videoBuffer, contentType);
              const analysis = await analyzeVideo(fileData.uri, fileData.mimeType, ANALYSIS_PROMPT);
              const newConcepts = await generateNewConcepts(analysis, buildConceptsPrompt(config));

              const record = {
                id: uuid(),
                link: video.postUrl,
                thumbnail: video.thumbnail,
                creator: video.username,
                views: video.views,
                likes: video.likes,
                comments: video.comments,
                durationSeconds: video.durationSeconds || 0,
                analysis,
                newConcepts,
                datePosted: video.datePosted,
                dateAdded: new Date().toISOString().slice(0, 10),
                configName,
                starred: false,
              };

              // Save immediately so it shows up in the UI right away
              await appendVideo(record);
              return record;
            });

            videosAnalyzed++;
            await log(`@${video.username} (${viewsLabel} views): done`, {
              phase: "analyzing",
              creatorsTotal: creators.length,
              creatorsScraped,
              videosTotal: allTopVideos.length,
              videosAnalyzed,
              status: "running",
            });
            return videoRecord;
          } catch (err) {
            videosAnalyzed++;
            await log(`@${video.username} (${viewsLabel} views): FAILED — ${err instanceof Error ? err.message : "unknown"}`, {
              phase: "analyzing",
              creatorsTotal: creators.length,
              creatorsScraped,
              videosTotal: allTopVideos.length,
              videosAnalyzed,
              status: "running",
            });
            return null;
          }
        })
      )
    );
    const newVideos: Video[] = analysisResults.filter((v): v is Video => v !== null);

    await log(`Pipeline complete! ${videosAnalyzed}/${allTopVideos.length} videos analyzed.`, {
      phase: "done",
      creatorsTotal: creators.length,
      creatorsScraped,
      videosTotal: allTopVideos.length,
      videosAnalyzed,
      status: "completed",
    });

    return {
      videosAnalyzed,
      videosTotal: allTopVideos.length,
      creatorsScraped,
    };
  }
);
