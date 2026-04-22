"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type TaskState = { status: "running" | "done" | "error"; error?: string };
type CreatorSuggestionItem = {
  username: string;
  name?: string;
  why: string;
  strength: string;
  contentStyle: string;
  estimatedFollowers: string;
  tier: "mega" | "macro" | "mid" | "micro";
  confidence: number;
};
type CreatorResearchState = { status: "running" | "done" | "error"; suggestions?: CreatorSuggestionItem[]; error?: string };

type GenContextType = {
  strategyGen: Map<string, TaskState>;
  startStrategyGeneration: (clientId: string) => void;
  clearStrategyGen: (clientId: string) => void;

  analysisGen: Map<string, TaskState>;
  startAnalysis: (clientId: string) => void;
  clearAnalysisGen: (clientId: string) => void;

  enrichGen: Map<string, TaskState>;
  startEnrich: (clientId: string) => void;
  clearEnrichGen: (clientId: string) => void;

  creatorResearchGen: Map<string, CreatorResearchState>;
  startCreatorResearch: (clientId: string, focus: string) => void;
  clearCreatorResearch: (clientId: string) => void;

  voiceProfileGen: Map<string, TaskState>;
  startVoiceProfileGen: (clientId: string) => void;
  clearVoiceProfileGen: (clientId: string) => void;
};

async function safeJson(r: Response) {
  const text = await r.text();
  if (!text.trim()) throw new Error(`Server returned empty response (${r.status})`);
  try { return JSON.parse(text); }
  catch { throw new Error(`Invalid response from server (${r.status}): ${text.slice(0, 100)}`); }
}

// Consume an SSE stream (`data: {...}\n\n` frames) until a terminal event.
// Resolves on `{ step: "done" }`, rejects on `{ step: "error", message }`.
// Per-step `status: "loading"|"done"` frames are ignored.
async function consumeSse(r: Response): Promise<void> {
  if (!r.ok || !r.body) throw new Error(`Server returned ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = frame.split("\n").find(l => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const ev = JSON.parse(payload) as { step?: string; message?: string };
        if (ev.step === "done") return;
        if (ev.step === "error") throw new Error(ev.message || "Generation failed");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

// ── Factory for simple fire-and-forget generation tasks ───────────────────
function useGenTask<S extends TaskState = TaskState>() {
  const [map, setMap] = useState<Map<string, S>>(new Map());

  const set = useCallback((clientId: string, state: S) => {
    setMap(prev => new Map(prev).set(clientId, state));
  }, []);

  const clear = useCallback((clientId: string) => {
    setMap(prev => { const n = new Map(prev); n.delete(clientId); return n; });
  }, []);

  return { map, set, clear };
}

const GenerationContext = createContext<GenContextType | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const strategy = useGenTask();
  const analysis = useGenTask();
  const enrich = useGenTask();
  const voiceProfile = useGenTask();
  const creatorResearch = useGenTask<CreatorResearchState>();

  // ── Simple task launcher (shared by strategy, analysis, enrich, voiceProfile) ──
  const launchTask = useCallback(
    (task: ReturnType<typeof useGenTask>, url: string, method = "POST") =>
      (clientId: string) => {
        task.set(clientId, { status: "running" });
        fetch(url.replace("{id}", clientId), { method })
          .then(safeJson)
          .then(data => {
            if (data.error) throw new Error(data.error);
            task.set(clientId, { status: "done" });
          })
          .catch((e: Error) => {
            task.set(clientId, { status: "error", error: e.message });
          });
      },
    [],
  );

  const startStrategyGeneration = useCallback((clientId: string) => {
    strategy.set(clientId, { status: "running" });
    fetch(`/api/configs/${clientId}/generate-strategy`, { method: "POST" })
      .then(consumeSse)
      .then(() => strategy.set(clientId, { status: "done" }))
      .catch((e: Error) => strategy.set(clientId, { status: "error", error: e.message }));
  }, [strategy]);

  const startAnalysis = useCallback(
    (clientId: string) => launchTask(analysis, `/api/configs/{id}/performance`)(clientId),
    [launchTask, analysis],
  );

  const startEnrich = useCallback(
    (clientId: string) => launchTask(enrich, `/api/configs/{id}/enrich`)(clientId),
    [launchTask, enrich],
  );

  const startVoiceProfileGen = useCallback(
    (clientId: string) => launchTask(voiceProfile, `/api/configs/{id}/generate-voice-profile`)(clientId),
    [launchTask, voiceProfile],
  );

  // ── Creator research (custom — has extra body + suggestions in response) ──
  const startCreatorResearch = useCallback((clientId: string, focus: string) => {
    creatorResearch.set(clientId, { status: "running" });
    fetch(`/api/configs/${clientId}/research-creators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus }),
    })
      .then(safeJson)
      .then(data => {
        if (data.error) throw new Error(data.error);
        creatorResearch.set(clientId, { status: "done", suggestions: data.suggestions || [] });
      })
      .catch((e: Error) => {
        creatorResearch.set(clientId, { status: "error", error: e.message });
      });
  }, [creatorResearch]);

  return (
    <GenerationContext.Provider value={{
      strategyGen: strategy.map, startStrategyGeneration, clearStrategyGen: strategy.clear,
      analysisGen: analysis.map, startAnalysis, clearAnalysisGen: analysis.clear,
      enrichGen: enrich.map, startEnrich, clearEnrichGen: enrich.clear,
      creatorResearchGen: creatorResearch.map, startCreatorResearch, clearCreatorResearch: creatorResearch.clear,
      voiceProfileGen: voiceProfile.map, startVoiceProfileGen, clearVoiceProfileGen: voiceProfile.clear,
    }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGeneration must be used within GenerationProvider");
  return ctx;
}
