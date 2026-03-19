"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { fetchPipelineToken } from "@/app/actions/inngest-token";
import type { PipelineProgress } from "@/lib/types";

interface PipelineContextValue {
  running: boolean;
  progress: PipelineProgress | null;
  eta: string | null;
  runPipeline: (params: { configName: string; maxVideos: number; topK: number; nDays: number }) => void;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const logRef = useRef<string[]>([]);
  const startTimeRef = useRef<number>(0);
  const scrapeStartRef = useRef<number>(0);
  const analyzeStartRef = useRef<number>(0);

  const tokenFetcher = useCallback(async () => {
    if (!eventId) throw new Error("No event ID");
    return fetchPipelineToken(eventId);
  }, [eventId]);

  const { data: realtimeMessages } = useInngestSubscription({
    enabled: !!eventId && running,
    refreshToken: tokenFetcher,
  });

  // Process realtime messages into progress state
  useEffect(() => {
    if (!realtimeMessages || realtimeMessages.length === 0) return;

    const latest = realtimeMessages[realtimeMessages.length - 1];
    const d = latest?.data as Record<string, unknown> | undefined;
    if (!d) return;

    // Add message to log
    const msg = d.message as string;
    if (msg && !logRef.current.includes(msg)) {
      logRef.current = [...logRef.current, msg];
    }

    const status = (d.status as string) || "running";
    const phase = (d.phase as string) || "scraping";
    const creatorsScraped = (d.creatorsScraped as number) || 0;
    const creatorsTotal = (d.creatorsTotal as number) || 0;
    const videosAnalyzed = (d.videosAnalyzed as number) || 0;
    const videosTotal = (d.videosTotal as number) || 0;

    // Track phase start times for ETA
    const now = Date.now();
    if (phase === "scraping" && creatorsScraped === 0 && scrapeStartRef.current === 0) {
      scrapeStartRef.current = now;
    }
    if (phase === "analyzing" && videosAnalyzed === 0 && analyzeStartRef.current === 0) {
      analyzeStartRef.current = now;
    }

    // Compute ETA
    let etaStr: string | null = null;
    if (status === "running") {
      if (phase === "scraping" && creatorsScraped > 0 && creatorsTotal > 0) {
        const elapsed = now - (scrapeStartRef.current || startTimeRef.current);
        const perCreator = elapsed / creatorsScraped;
        const remaining = perCreator * (creatorsTotal - creatorsScraped);
        etaStr = formatEta(remaining);
      } else if (phase === "analyzing" && videosAnalyzed > 0 && videosTotal > 0) {
        const elapsed = now - (analyzeStartRef.current || startTimeRef.current);
        const perVideo = elapsed / videosAnalyzed;
        const remaining = perVideo * (videosTotal - videosAnalyzed);
        etaStr = formatEta(remaining);
      } else if (phase === "scraping") {
        etaStr = "Estimating...";
      }
    }
    setEta(etaStr);

    setProgress({
      status: status as PipelineProgress["status"],
      phase: phase as PipelineProgress["phase"],
      activeTasks: d.activeVideo
        ? [{
            id: "current",
            creator: (d.activeVideo as Record<string, unknown>).creator as string,
            step: (d.activeVideo as Record<string, unknown>).step as string,
            views: (d.activeVideo as Record<string, unknown>).views as number,
          }]
        : [],
      creatorsCompleted: creatorsScraped,
      creatorsTotal,
      creatorsScraped,
      videosAnalyzed,
      videosTotal,
      errors: [],
      log: [...logRef.current],
    });

    if (status === "completed" || status === "failed") {
      setRunning(false);
      setEventId(null);
      setEta(null);
    }
  }, [realtimeMessages]);

  const runPipeline = useCallback(async (params: { configName: string; maxVideos: number; topK: number; nDays: number }) => {
    if (running) return;
    setRunning(true);
    startTimeRef.current = Date.now();
    scrapeStartRef.current = 0;
    analyzeStartRef.current = 0;
    logRef.current = ["Starting pipeline..."];
    setEta("Estimating...");
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
      log: ["Starting pipeline..."],
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
      setEventId(eventId);
    } catch (err) {
      logRef.current = [];
      setEta(null);
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
    <PipelineContext.Provider value={{ running, progress, eta, runPipeline }}>
      {children}
    </PipelineContext.Provider>
  );
}

function formatEta(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `~${totalSeconds}s remaining`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `~${minutes}m ${seconds}s remaining`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `~${hours}h ${remainingMinutes}m remaining`;
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineProvider");
  return ctx;
}
