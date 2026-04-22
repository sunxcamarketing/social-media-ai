"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WeekIdea = {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  angle: string;
  hookDirection: string;
  keyPoints: string[];
  whyNow: string;
  emotion: string;
};

export type WeekIdeasMeta = {
  hasAudit: boolean;
  hasVoiceProfile: boolean;
  ownVideosUsed: number;
  creatorVideosUsed: number;
};

// Pipeline steps mirror what the server actually does in sequence:
// context + voice run in parallel → trends → generate.
export type WeekIdeasPipelineStep = "idle" | "context" | "trends" | "generate" | "done" | "error";

export type WeekIdeasTopic = { day: string; title: string; pillar: string };

export interface UseWeekIdeasStreamOptions {
  clientId: string;
}

export interface UseWeekIdeasStreamResult {
  ideas: WeekIdea[];
  reasoning: string;
  meta: WeekIdeasMeta | null;
  topics: WeekIdeasTopic[];
  step: WeekIdeasPipelineStep;
  loading: boolean;
  error: string | null;
  /** Begin an SSE pipeline run. Aborts any in-flight run automatically. */
  generate: () => Promise<void>;
  /** Stable key helper for per-idea UI state (saved-as-idea, developing, etc). */
  ideaKey: (idea: WeekIdea) => string;
  /** Reset to idle/empty state. */
  reset: () => void;
}

/**
 * Owns the weekly-ideas SSE pipeline state:
 *   - context → trends → generate → done stage machine
 *   - AbortController lifecycle (cancels on unmount or re-generate)
 *   - Ideas, meta, and week reasoning accumulated from the stream
 *
 * Keeps the scripts page clear of SSE plumbing. Returns everything the UI
 * needs including a stable-key helper so callers can key per-idea state by
 * `${day}::${title}` instead of array index (survives regeneration).
 */
export function useWeekIdeasStream({ clientId }: UseWeekIdeasStreamOptions): UseWeekIdeasStreamResult {
  const [ideas, setIdeas] = useState<WeekIdea[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [meta, setMeta] = useState<WeekIdeasMeta | null>(null);
  const [topics, setTopics] = useState<WeekIdeasTopic[]>([]);
  const [step, setStep] = useState<WeekIdeasPipelineStep>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const ideaKey = useCallback((idea: WeekIdea) => `${idea.day}::${idea.title}`, []);

  const reset = useCallback(() => {
    setIdeas([]);
    setReasoning("");
    setMeta(null);
    setTopics([]);
    setStep("idle");
    setError(null);
  }, []);

  const generate = useCallback(async () => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
    }
    const abort = new AbortController();
    abortRef.current = abort;

    setLoading(true);
    setError(null);
    setIdeas([]);
    setReasoning("");
    setMeta(null);
    setTopics([]);
    setStep("context");

    try {
      const res = await fetch(`/api/configs/${clientId}/generate-week-scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Keine Server-Antwort");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          if (data.step === "error") {
            setError(data.message || "Unbekannter Fehler");
            setStep("error");
          } else if (data.step === "voice" && data.status === "done") {
            // voice and context complete at the same time (parallel on server)
            setStep("trends");
          } else if (data.step === "trends" && data.status === "done") {
            setStep("generate");
          } else if (data.step === "generate" && data.status === "done") {
            setTopics(data.ideaTitles || []);
          } else if (data.step === "done") {
            setStep("done");
            setIdeas(data.ideas || []);
            setReasoning(data.weekReasoning || "");
            setMeta(data._meta || null);
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
        setStep("error");
      }
    } finally {
      setLoading(false);
      if (abortRef.current === abort) abortRef.current = null;
    }
  }, [clientId]);

  // Abort in-flight pipeline on unmount to prevent setState-after-unmount.
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
      }
    };
  }, []);

  return { ideas, reasoning, meta, topics, step, loading, error, generate, ideaKey, reset };
}
