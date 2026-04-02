import { inngest } from "./client";
import { v4 as uuid } from "uuid";
import { readConfigs, readCreators, appendVideo } from "@/lib/csv";
import { scrapeReels } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { generateNewConcepts } from "@/lib/claude";
import { ANALYSIS_PROMPT, buildConceptsPrompt } from "@prompts";
import type { Video } from "@/lib/types";

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

    // Step 2: Scrape each creator
    const cutoffDate = new Date(Date.now() - nDays * 24 * 60 * 60 * 1000);
    const allTopVideos: ScrapedVideo[] = [];
    let creatorsScraped = 0;

    for (const username of creators) {
      await log(`Scraping @${username}...`, {
        phase: "scraping",
        creatorsTotal: creators.length,
        creatorsScraped,
        activeCreator: username,
        status: "running",
      });

      const videos = await step.run(`scrape-${username}`, async () => {
        const reels = await scrapeReels(username, maxVideos, nDays);

        const videos = reels
          .filter((r) => r.videoUrl && r.timestamp)
          .map((r) => {
            // Cast to any to access all Apify fields (API returns more than typed interface)
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

        videos.sort((a, b) => b.views - a.views);
        return videos.slice(0, topK).map(({ timestamp, ...v }) => v);
      });

      allTopVideos.push(...videos);
      creatorsScraped++;

      await log(`@${username}: ${videos.length} top videos selected`, {
        phase: "scraping",
        creatorsTotal: creators.length,
        creatorsScraped,
        status: "running",
      });
    }

    await log(`Scraping complete. ${allTopVideos.length} videos to analyze.`, {
      phase: "analyzing",
      creatorsTotal: creators.length,
      creatorsScraped,
      videosTotal: allTopVideos.length,
      videosAnalyzed: 0,
      status: "running",
    });

    // Step 3: Analyze each video
    const newVideos: Video[] = [];
    let videosAnalyzed = 0;

    for (const video of allTopVideos) {
      const viewsLabel = video.views >= 1_000_000
        ? `${(video.views / 1_000_000).toFixed(1)}M`
        : video.views >= 1_000
        ? `${(video.views / 1_000).toFixed(0)}K`
        : String(video.views);

      await log(`Analyzing @${video.username} (${viewsLabel} views): downloading...`, {
        phase: "analyzing",
        creatorsTotal: creators.length,
        creatorsScraped,
        videosTotal: allTopVideos.length,
        videosAnalyzed,
        activeVideo: { creator: video.username, views: video.views, step: "Downloading" },
        status: "running",
      });

      const result = await step.run(`analyze-${video.username}-${video.views}`, async () => {
        // Download video
        const videoResponse = await fetch(video.videoUrl);
        if (!videoResponse.ok) throw new Error(`Download failed: ${videoResponse.status}`);
        const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
        const contentType = videoResponse.headers.get("content-type") || "video/mp4";

        // Upload to Gemini
        const fileData = await uploadVideo(videoBuffer, contentType);

        // Analyze with Gemini
        const analysis = await analyzeVideo(fileData.uri, fileData.mimeType, ANALYSIS_PROMPT);

        // Generate concepts with Claude
        const newConcepts = await generateNewConcepts(analysis, buildConceptsPrompt(config));

        const videoRecord = {
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
        await appendVideo(videoRecord);

        return videoRecord;
      });

      newVideos.push(result);
      videosAnalyzed++;

      await log(`@${video.username} (${viewsLabel} views): done`, {
        phase: "analyzing",
        creatorsTotal: creators.length,
        creatorsScraped,
        videosTotal: allTopVideos.length,
        videosAnalyzed,
        status: "running",
      });
    }

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
