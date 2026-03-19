"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { PipelineProgress } from "@/lib/types";

interface PipelineContextValue {
  running: boolean;
  progress: PipelineProgress | null;
  runPipeline: (params: { configName: string; maxVideos: number; topK: number; nDays: number }) => void;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);

  const runPipeline = useCallback(async (params: { configName: string; maxVideos: number; topK: number; nDays: number }) => {
    if (running) return;
    setRunning(true);
    setProgress({
      status: "running",
      phase: "scraping",
      activeTasks: [],
      creatorsCompleted: 0,
      creatorsTotal: 0,
      creatorsScraped: 0,
      videosAnalyzed: 0,
      videosTotal: 0,
      errors: [],
      log: ["Pipeline started — running in background via Inngest"],
    });

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Failed to start pipeline: ${response.status}`);
      }

      const { eventId } = await response.json();

      setProgress((prev) => prev && ({
        ...prev,
        log: [...prev.log, `Pipeline queued (event: ${eventId}). Processing in background...`],
      }));

      // Poll for completion by checking if new videos appeared
      const startTime = Date.now();
      const maxPollTime = 10 * 60 * 1000; // 10 minutes
      const pollInterval = 10_000; // 10 seconds

      const pollForCompletion = async () => {
        while (Date.now() - startTime < maxPollTime) {
          await new Promise((r) => setTimeout(r, pollInterval));

          try {
            const statusRes = await fetch(`/api/pipeline/status?eventId=${eventId}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();

              if (statusData.status === "completed") {
                setProgress({
                  status: "completed",
                  phase: "done",
                  activeTasks: [],
                  creatorsCompleted: statusData.creatorsScraped || 0,
                  creatorsTotal: statusData.creatorsScraped || 0,
                  creatorsScraped: statusData.creatorsScraped || 0,
                  videosAnalyzed: statusData.videosAnalyzed || 0,
                  videosTotal: statusData.videosTotal || 0,
                  errors: [],
                  log: [
                    "Pipeline started — running in background via Inngest",
                    `Pipeline complete! ${statusData.videosAnalyzed} videos analyzed.`,
                  ],
                });
                setRunning(false);
                return;
              }

              if (statusData.status === "failed") {
                setProgress((prev) => prev && ({
                  ...prev,
                  status: "error",
                  errors: [statusData.error || "Pipeline failed"],
                  log: [...prev.log, `Pipeline failed: ${statusData.error || "Unknown error"}`],
                }));
                setRunning(false);
                return;
              }
            }
          } catch {
            // ignore poll errors, keep trying
          }
        }

        // Timeout
        setProgress((prev) => prev && ({
          ...prev,
          status: "completed",
          phase: "done",
          log: [...prev.log, "Pipeline may still be running. Check the Videos page for results."],
        }));
        setRunning(false);
      };

      pollForCompletion();
    } catch (err) {
      setProgress({
        status: "error",
        phase: "done",
        activeTasks: [],
        creatorsCompleted: 0,
        creatorsTotal: 0,
        creatorsScraped: 0,
        videosAnalyzed: 0,
        videosTotal: 0,
        errors: [err instanceof Error ? err.message : "Unknown error"],
        log: [`Error: ${err instanceof Error ? err.message : "Unknown error"}`],
      });
      setRunning(false);
    }
  }, [running]);

  return (
    <PipelineContext.Provider value={{ running, progress, runPipeline }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}
