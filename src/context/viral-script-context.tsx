"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type StepStatus = "waiting" | "loading" | "done" | "error";

export interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
}

interface HookOption { hook: string; pattern: string }
interface HookResult { options: HookOption[]; selected: number; selectionReason: string }
interface ScriptVersion { hook: string; body: string; cta: string; textHook: string }
interface ShotItem { nr: number; text: string; action: string; onScreen?: string; duration: string }
interface ProductionNotes {
  shots: ShotItem[];
  musicMood: string;
}

export interface FinalResult {
  title: string;
  reasoning: string;
  short: ScriptVersion;
  long: ScriptVersion;
  hooks: HookResult;
  structure: { pattern: string; hookType: string };
  production: ProductionNotes | null;
  reviewIssues: string[];
  criticScores?: { short: number; long: number; rounds: number };
  reference: { creator: string; views: number };
}

interface ViralScriptState {
  clientId: string;
  inputMode: "library" | "url";
  selectedVideoId: string;
  urlInput: string;
  running: boolean;
  steps: PipelineStep[];
  result: FinalResult | null;
  error: string;
}

type ViralScriptContextType = ViralScriptState & {
  setClientId: (id: string) => void;
  setInputMode: (mode: "library" | "url") => void;
  setSelectedVideoId: (id: string) => void;
  setUrlInput: (url: string) => void;
  generate: () => void;
  reset: () => void;
  updateScript: (variant: "short" | "long", field: "hook" | "body" | "cta" | "textHook", value: string) => void;
  selectHook: (index: number) => void;
};

const ViralScriptContext = createContext<ViralScriptContextType | null>(null);

// ── Provider ────────────────────────────────────────────────────────────────

export function ViralScriptProvider({ children }: { children: ReactNode }) {
  const [clientId, setClientId] = useState("");
  const [inputMode, setInputMode] = useState<"library" | "url">("library");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [result, setResult] = useState<FinalResult | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setRunning(false);
    setSteps([]);
    setResult(null);
    setError("");
  }, []);

  const generate = useCallback(() => {
    const canGenerate = clientId && (
      (inputMode === "library" && selectedVideoId) ||
      (inputMode === "url" && urlInput.trim().includes("instagram.com"))
    );
    if (!canGenerate) return;

    // Reset previous
    setRunning(true);
    setError("");
    setResult(null);

    const initialSteps: PipelineStep[] = [
      { id: "context", label: "Kontext laden", status: "waiting" },
      ...(inputMode === "url" ? [{ id: "reference", label: "Referenz-Video analysieren", status: "waiting" as StepStatus }] : []),
      { id: "structure", label: "Struktur extrahieren", status: "waiting" },
      { id: "hooks", label: "Hook-Varianten generieren", status: "waiting" },
      { id: "adapt", label: "Skript adaptieren", status: "waiting" },
      { id: "review", label: "Critic Agent prüft", status: "waiting" },
      { id: "production", label: "Filming Notes erstellen", status: "waiting" },
    ];
    setSteps(initialSteps);

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch("/api/viral-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            ...(inputMode === "library" ? { videoId: selectedVideoId } : { videoUrl: urlInput.trim() }),
          }),
          signal: controller.signal,
        });

        if (!res.body) throw new Error("Keine Antwort vom Server");

        const reader = res.body.getReader();
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
            try {
              const data = JSON.parse(line.slice(6));

              if (data.step === "error") {
                setError(data.error || "Unbekannter Fehler");
                setRunning(false);
                return;
              }

              if (data.step === "done") {
                setResult(data.result as FinalResult);
                setRunning(false);
                return;
              }

              setSteps(prev => prev.map(s =>
                s.id === data.step ? { ...s, status: data.status as StepStatus, ...(data.message ? { message: data.message } : {}) } : s
              ));
            } catch {
              // Skip parse errors
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Verbindungsfehler");
      } finally {
        setRunning(false);
      }
    })();
  }, [clientId, inputMode, selectedVideoId, urlInput]);

  const handleSetClientId = useCallback((id: string) => {
    setClientId(id);
    setSelectedVideoId("");
  }, []);

  const handleSetInputMode = useCallback((mode: "library" | "url") => {
    setInputMode(mode);
    if (mode === "library") setUrlInput("");
    else setSelectedVideoId("");
  }, []);

  const updateScript = useCallback((variant: "short" | "long", field: "hook" | "body" | "cta" | "textHook", value: string) => {
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [variant]: { ...prev[variant], [field]: value },
      };
    });
  }, []);

  const selectHook = useCallback((index: number) => {
    setResult(prev => {
      if (!prev) return prev;
      const newHook = prev.hooks.options[index]?.hook;
      if (!newHook) return prev;
      return {
        ...prev,
        hooks: { ...prev.hooks, selected: index },
        short: { ...prev.short, hook: newHook },
        long: { ...prev.long, hook: newHook },
      };
    });
  }, []);

  return (
    <ViralScriptContext.Provider value={{
      clientId, inputMode, selectedVideoId, urlInput,
      running, steps, result, error,
      setClientId: handleSetClientId,
      setInputMode: handleSetInputMode,
      setSelectedVideoId,
      setUrlInput,
      generate,
      reset,
      updateScript,
      selectHook,
    }}>
      {children}
    </ViralScriptContext.Provider>
  );
}

export function useViralScript() {
  const ctx = useContext(ViralScriptContext);
  if (!ctx) throw new Error("useViralScript must be used within ViralScriptProvider");
  return ctx;
}
