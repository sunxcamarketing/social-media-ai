"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useInngestSubscription } from "@inngest/realtime/hooks";
import { fetchPipelineToken } from "@/app/actions/inngest-token";
import type { PipelineProgress } from "@/lib/types";

// Pipeline runs happen on Inngest and survive tab close. We persist the
// handle so that when the user comes back, we can re-subscribe and restore
// the log/progress UI instead of showing an empty panel.
const STORAGE_KEY = "pipeline:active-run";
const MAX_RUN_AGE_MS = 30 * 60 * 1000; // 30 min — runs longer than this are treated as stale

interface PersistedRun {
  eventId: string;
  configName: string;
  startedAt: number;
  progress: PipelineProgress | null;
  log: string[];
}

function readPersistedRun(): PersistedRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRun;
    if (!parsed.eventId || !parsed.startedAt) return null;
    if (Date.now() - parsed.startedAt > MAX_RUN_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePersistedRun(run: PersistedRun | null) {
  if (typeof window === "undefined") return;
  if (!run) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
}

interface PipelineContextValue {
  running: boolean;
  progress: PipelineProgress | null;
  eta: string | null;
  runPipeline: (params: { configName: string; maxVideos: number; topK: number; nDays: number }) => void;
  clearProgress: () => void;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [configName, setConfigName] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const logRef = useRef<string[]>([]);
  const startTimeRef = useRef<number>(0);
  const scrapeStartRef = useRef<number>(0);
  const analyzeStartRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // On mount: restore any in-flight run from localStorage so the UI
  // reconnects instead of showing an empty panel after reload/tab-reopen.
  const restoredAtRef = useRef<number | null>(null);
  useEffect(() => {
    const persisted = readPersistedRun();
    if (!persisted) return;

    logRef.current = persisted.log;
    startTimeRef.current = persisted.startedAt;
    setEventId(persisted.eventId);
    setConfigName(persisted.configName);
    setStartedAt(persisted.startedAt);
    setRunning(true);
    restoredAtRef.current = Date.now();
    lastUpdateRef.current = Date.now();
    setProgress(persisted.progress ?? {
      status: "running",
      phase: "scraping",
      activeTasks: [],
      creatorsCompleted: 0,
      creatorsTotal: 0,
      creatorsScraped: 0,
      videosAnalyzed: 0,
      videosTotal: 0,
      errors: [],
      log: persisted.log,
    });
    setEta("Reconnecting to background run...");
  }, []);

  // Reconnect fallback: Inngest Realtime does NOT replay past events. If the
  // user returns after the run already finished (or after a long gap), the
  // subscription stays silent forever. After 20s of silence following a
  // restore, we assume the run has completed and flip the UI to "completed"
  // so consumers (videos page) refetch from the DB, which is the source of
  // truth since videos are persisted on every analyze step.
  useEffect(() => {
    if (!running || !restoredAtRef.current) return;
    const RECONNECT_TIMEOUT_MS = 20_000;
    const interval = setInterval(() => {
      const silenceMs = Date.now() - (lastUpdateRef.current || restoredAtRef.current || 0);
      if (silenceMs > RECONNECT_TIMEOUT_MS) {
        clearInterval(interval);
        setProgress((p) => p ? { ...p, status: "completed", phase: "done" } : p);
        setRunning(false);
        setEventId(null);
        setEta(null);
        writePersistedRun(null);
        restoredAtRef.current = null;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [running]);

  const tokenFetcher = useCallback(async () => {
    if (!eventId) return null;
    return fetchPipelineToken(eventId);
  }, [eventId]);

  const subscriptionEnabled = !!eventId && running;
  const { data: realtimeMessages } = useInngestSubscription({
    enabled: subscriptionEnabled,
    refreshToken: subscriptionEnabled ? tokenFetcher : undefined,
  });

  // Process realtime messages into progress state
  useEffect(() => {
    if (!realtimeMessages || realtimeMessages.length === 0) return;

    const latest = realtimeMessages[realtimeMessages.length - 1];
    const d = latest?.data as Record<string, unknown> | undefined;
    if (!d) return;

    // Track last update time for staleness detection
    lastUpdateRef.current = Date.now();

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

    // If all videos are analyzed, treat as completed even if server hasn't sent final message
    const effectiveStatus = (phase === "analyzing" && videosTotal > 0 && videosAnalyzed >= videosTotal && status === "running")
      ? "completed"
      : status;

    const nextProgress: PipelineProgress = {
      status: effectiveStatus as PipelineProgress["status"],
      phase: effectiveStatus === "completed" ? "done" : phase as PipelineProgress["phase"],
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
    };
    setProgress(nextProgress);

    // Detect completion: either explicit status or all videos analyzed
    const isComplete = status === "completed" || status === "failed"
      || (phase === "analyzing" && videosTotal > 0 && videosAnalyzed >= videosTotal);

    if (isComplete) {
      setRunning(false);
      setEventId(null);
      setEta(null);
      writePersistedRun(null);
    } else if (eventId && configName) {
      // Keep the persisted snapshot fresh so a reload mid-run shows accurate progress.
      writePersistedRun({
        eventId,
        configName,
        startedAt: startedAt || startTimeRef.current || Date.now(),
        progress: nextProgress,
        log: [...logRef.current],
      });
    }
  }, [realtimeMessages, eventId, configName, startedAt]);

  const runPipeline = useCallback(async (params: { configName: string; maxVideos: number; topK: number; nDays: number }) => {
    if (running) return;
    const now = Date.now();
    setRunning(true);
    setConfigName(params.configName);
    setStartedAt(now);
    startTimeRef.current = now;
    scrapeStartRef.current = 0;
    analyzeStartRef.current = 0;
    logRef.current = ["Starting pipeline..."];
    setEta("Estimating...");
    const initialProgress: PipelineProgress = {
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
    };
    setProgress(initialProgress);

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Failed to start pipeline: ${response.status}`);
      }

      const { eventId: newEventId } = await response.json();
      setEventId(newEventId);
      writePersistedRun({
        eventId: newEventId,
        configName: params.configName,
        startedAt: now,
        progress: initialProgress,
        log: ["Starting pipeline..."],
      });
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
      writePersistedRun(null);
    }
  }, [running]);

  const clearProgress = useCallback(() => {
    setRunning(false);
    setProgress(null);
    setEta(null);
    setEventId(null);
    setConfigName(null);
    setStartedAt(0);
    logRef.current = [];
    writePersistedRun(null);
  }, []);

  return (
    <PipelineContext.Provider value={{ running, progress, eta, runPipeline, clearProgress }}>
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
