"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type GenState = { status: "generating" | "done" | "error"; count?: number; error?: string };
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
  // Chat → scripts
  generations: Map<string, GenState>;
  startChatGeneration: (clientId: string, messages: { role: string; content: string }[]) => void;
  clearGeneration: (clientId: string) => void;

  // Strategy generation
  strategyGen: Map<string, TaskState>;
  startStrategyGeneration: (clientId: string) => void;
  clearStrategyGen: (clientId: string) => void;

  // Performance analysis
  analysisGen: Map<string, TaskState>;
  startAnalysis: (clientId: string) => void;
  clearAnalysisGen: (clientId: string) => void;

  // Enrich (information page auto-fill)
  enrichGen: Map<string, TaskState>;
  startEnrich: (clientId: string) => void;
  clearEnrichGen: (clientId: string) => void;

  // Creator research
  creatorResearchGen: Map<string, CreatorResearchState>;
  startCreatorResearch: (clientId: string, focus: string) => void;
  clearCreatorResearch: (clientId: string) => void;

  // Voice profile generation
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

const GenerationContext = createContext<GenContextType | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [generations, setGenerations] = useState<Map<string, GenState>>(new Map());
  const [strategyGen, setStrategyGen] = useState<Map<string, TaskState>>(new Map());
  const [analysisGen, setAnalysisGen] = useState<Map<string, TaskState>>(new Map());
  const [enrichGen, setEnrichGen] = useState<Map<string, TaskState>>(new Map());
  const [creatorResearchGen, setCreatorResearchGen] = useState<Map<string, CreatorResearchState>>(new Map());
  const [voiceProfileGen, setVoiceProfileGen] = useState<Map<string, TaskState>>(new Map());

  // ── Chat → scripts ──────────────────────────────────────────────────────
  const startChatGeneration = useCallback((clientId: string, messages: { role: string; content: string }[]) => {
    setGenerations((prev) => new Map(prev).set(clientId, { status: "generating" }));
    fetch(`/api/configs/${clientId}/finish-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    })
      .then(safeJson)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setGenerations((prev) => new Map(prev).set(clientId, { status: "done", count: data.count }));
      })
      .catch((e: Error) => {
        setGenerations((prev) => new Map(prev).set(clientId, { status: "error", error: e.message }));
      });
  }, []);

  const clearGeneration = useCallback((clientId: string) => {
    setGenerations((prev) => { const n = new Map(prev); n.delete(clientId); return n; });
  }, []);

  // ── Strategy generation ─────────────────────────────────────────────────
  const startStrategyGeneration = useCallback((clientId: string) => {
    setStrategyGen((prev) => new Map(prev).set(clientId, { status: "running" }));
    fetch(`/api/configs/${clientId}/generate-strategy`, { method: "POST" })
      .then(safeJson)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStrategyGen((prev) => new Map(prev).set(clientId, { status: "done" }));
      })
      .catch((e: Error) => {
        setStrategyGen((prev) => new Map(prev).set(clientId, { status: "error", error: e.message }));
      });
  }, []);

  const clearStrategyGen = useCallback((clientId: string) => {
    setStrategyGen((prev) => { const n = new Map(prev); n.delete(clientId); return n; });
  }, []);

  // ── Performance analysis ────────────────────────────────────────────────
  const startAnalysis = useCallback((clientId: string) => {
    setAnalysisGen((prev) => new Map(prev).set(clientId, { status: "running" }));
    fetch(`/api/configs/${clientId}/performance`, { method: "POST" })
      .then(safeJson)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAnalysisGen((prev) => new Map(prev).set(clientId, { status: "done" }));
      })
      .catch((e: Error) => {
        setAnalysisGen((prev) => new Map(prev).set(clientId, { status: "error", error: e.message }));
      });
  }, []);

  const clearAnalysisGen = useCallback((clientId: string) => {
    setAnalysisGen((prev) => { const n = new Map(prev); n.delete(clientId); return n; });
  }, []);

  // ── Enrich (information page) ────────────────────────────────────────────
  const startEnrich = useCallback((clientId: string) => {
    setEnrichGen((prev) => new Map(prev).set(clientId, { status: "running" }));
    fetch(`/api/configs/${clientId}/enrich`, { method: "POST" })
      .then(safeJson)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEnrichGen((prev) => new Map(prev).set(clientId, { status: "done" }));
      })
      .catch((e: Error) => {
        setEnrichGen((prev) => new Map(prev).set(clientId, { status: "error", error: e.message }));
      });
  }, []);

  const clearEnrichGen = useCallback((clientId: string) => {
    setEnrichGen((prev) => { const n = new Map(prev); n.delete(clientId); return n; });
  }, []);

  // ── Creator research ─────────────────────────────────────────────────────
  const startCreatorResearch = useCallback((clientId: string, focus: string) => {
    setCreatorResearchGen((prev) => new Map(prev).set(clientId, { status: "running" }));
    fetch(`/api/configs/${clientId}/research-creators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus }),
    })
      .then(safeJson)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCreatorResearchGen((prev) => new Map(prev).set(clientId, { status: "done", suggestions: data.suggestions || [] }));
      })
      .catch((e: Error) => {
        setCreatorResearchGen((prev) => new Map(prev).set(clientId, { status: "error", error: e.message }));
      });
  }, []);

  const clearCreatorResearch = useCallback((clientId: string) => {
    setCreatorResearchGen((prev) => { const n = new Map(prev); n.delete(clientId); return n; });
  }, []);

  // ── Voice profile generation ──────────────────────────────────────────────
  const startVoiceProfileGen = useCallback((clientId: string) => {
    setVoiceProfileGen((prev) => new Map(prev).set(clientId, { status: "running" }));
    fetch(`/api/configs/${clientId}/generate-voice-profile`, { method: "POST" })
      .then(safeJson)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setVoiceProfileGen((prev) => new Map(prev).set(clientId, { status: "done" }));
      })
      .catch((e: Error) => {
        setVoiceProfileGen((prev) => new Map(prev).set(clientId, { status: "error", error: e.message }));
      });
  }, []);

  const clearVoiceProfileGen = useCallback((clientId: string) => {
    setVoiceProfileGen((prev) => { const n = new Map(prev); n.delete(clientId); return n; });
  }, []);

  return (
    <GenerationContext.Provider value={{
      generations, startChatGeneration, clearGeneration,
      strategyGen, startStrategyGeneration, clearStrategyGen,
      analysisGen, startAnalysis, clearAnalysisGen,
      enrichGen, startEnrich, clearEnrichGen,
      creatorResearchGen, startCreatorResearch, clearCreatorResearch,
      voiceProfileGen, startVoiceProfileGen, clearVoiceProfileGen,
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
