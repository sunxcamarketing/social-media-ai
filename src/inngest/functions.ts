import { inngest } from "./client";
import { v4 as uuid } from "uuid";
import { readConfigs, readCreators, readVideos, writeVideos } from "@/lib/csv";
import { scrapeReels } from "@/lib/apify";
import { uploadVideo, analyzeVideo } from "@/lib/gemini";
import { generateNewConcepts } from "@/lib/claude";
import { ANALYSIS_PROMPT, buildConceptsPrompt } from "@/lib/prompts";
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
    triggers: [{ event: "pipeline/run" }],
  },
  async ({ event, step }) => {
    const { configName, maxVideos, topK, nDays } = event.data;

    // Step 1: Load config and creators
    const { config, creators } = await step.run("load-config", () => {
      const configs = readConfigs();
      const config = configs.find((c) => c.configName === configName);
      if (!config) throw new Error(`Config "${configName}" not found`);

      const allCreators = readCreators();
      const creators = allCreators.filter((c) => c.category === config.creatorsCategory);
      if (creators.length === 0) throw new Error(`No creators found for category "${config.creatorsCategory}"`);

      return { config, creators: creators.map((c) => c.username) };
    });

    // Step 2: Scrape each creator (each is its own step for retry/durability)
    const cutoffDate = new Date(Date.now() - nDays * 24 * 60 * 60 * 1000);
    const allTopVideos: ScrapedVideo[] = [];

    for (const username of creators) {
      const videos = await step.run(`scrape-${username}`, async () => {
        const reels = await scrapeReels(username, maxVideos, nDays);

        const videos = reels
          .filter((r) => r.videoUrl && r.timestamp)
          .map((r) => ({
            videoUrl: r.videoUrl,
            postUrl: r.url,
            views: r.videoPlayCount || 0,
            likes: r.likesCount || 0,
            comments: r.commentsCount || 0,
            durationSeconds: r.videoDuration || 0,
            username: r.ownerUsername || username,
            thumbnail: r.images?.[0] || "",
            datePosted: r.timestamp?.split("T")[0] || "",
            timestamp: new Date(r.timestamp).getTime(),
          }))
          .filter((v) => v.timestamp >= cutoffDate.getTime());

        videos.sort((a, b) => b.views - a.views);
        return videos.slice(0, topK).map(({ timestamp, ...v }) => v);
      });

      allTopVideos.push(...videos);
    }

    // Step 3: Analyze each video (each is its own step)
    const newVideos: Video[] = [];

    for (const video of allTopVideos) {
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

        return {
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
      });

      newVideos.push(result);
    }

    // Step 4: Save all results
    await step.run("save-results", () => {
      if (newVideos.length > 0) {
        const existing = readVideos();
        writeVideos([...existing, ...newVideos]);
      }
    });

    return {
      videosAnalyzed: newVideos.length,
      videosTotal: allTopVideos.length,
      creatorsScraped: creators.length,
    };
  }
);
