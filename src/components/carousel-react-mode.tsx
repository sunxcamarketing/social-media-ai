"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  Clock,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CarouselReactPreview } from "@/components/carousel-react-preview";
import { CarouselChat } from "@/components/carousel-chat";

interface ProgressEvent {
  stage: string;
  status: string;
  message?: string;
  data?: Record<string, unknown>;
  result?: {
    runId: string;
    tsxCode: string;
    topic: string;
    tokensIn: number;
    tokensOut: number;
    durationMs: number;
  };
}

interface SavedReactCarousel {
  id: string;
  run_id: string;
  topic: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Props {
  clientId: string;
}

const STAGE_LABELS: Record<string, string> = {
  config: "Client-Config laden",
  context: "Brand- & Voice-Context laden",
  claude: "Claude generiert Komponente",
  sanitize: "Output bereinigen",
  done: "Fertig",
  complete: "Fertig",
  error: "Fehler",
};

export function CarouselReactMode({ clientId }: Props) {
  const [topic, setTopic] = useState("");
  const [tsxCode, setTsxCode] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string>("");
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [savedList, setSavedList] = useState<SavedReactCarousel[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const refreshHistory = useCallback(() => {
    setLoadingHistory(true);
    fetch(`/api/carousel/react/list?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setSavedList(d.carousels || []))
      .catch(() => setSavedList([]))
      .finally(() => setLoadingHistory(false));
  }, [clientId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const loadSaved = async (runId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/carousel/react/get?runId=${encodeURIComponent(runId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTsxCode(data.tsxCode);
      setCurrentTopic(data.topic || "");
      setCurrentRunId(data.runId);
      setTopic(data.topic || "");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteSaved = async (runId: string, label: string) => {
    if (!confirm(`Karussell "${label}" wirklich löschen?`)) return;
    await fetch(`/api/carousel/react/delete?runId=${encodeURIComponent(runId)}`, {
      method: "DELETE",
    });
    if (currentRunId === runId) {
      setTsxCode(null);
      setCurrentRunId(null);
    }
    refreshHistory();
  };

  const generate = async () => {
    if (!topic.trim() || generating) return;
    setError(null);
    setEvents([]);
    setTsxCode(null);
    setCurrentRunId(null);
    setGenerating(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/carousel/react/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, topic: topic.trim() }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx;
        while ((nlIdx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 2);
          if (!frame.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(frame.slice(6)) as ProgressEvent;
            setEvents((prev) => [...prev, data]);
            if (data.stage === "complete" && data.result) {
              setTsxCode(data.result.tsxCode);
              setCurrentTopic(data.result.topic);
              setCurrentRunId(data.result.runId);
              refreshHistory();
            }
            if (data.stage === "error") {
              setError(data.message || "Unbekannter Fehler");
            }
          } catch {
            /* skip unparseable frames */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setGenerating(false);
  };

  const startNew = () => {
    setTsxCode(null);
    setCurrentRunId(null);
    setCurrentTopic("");
    setTopic("");
    setError(null);
    setEvents([]);
  };

  // Pipeline emits two events per stage (loading → done). Collapse to the
  // latest event per stage so each step renders exactly once.
  const stageEvents = (() => {
    const latestByStage = new Map<string, ProgressEvent>();
    for (const ev of events) {
      if (ev.stage === "complete") continue;
      latestByStage.set(ev.stage, ev);
    }
    return Array.from(latestByStage.values());
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
      {/* ── Preview / Empty state ───────────────────────────────── */}
      <div className="min-w-0 rounded-2xl bg-white border border-ocean/[0.06] overflow-hidden min-h-[640px] flex flex-col">
        {tsxCode ? (
          <CarouselReactPreview tsxCode={tsxCode} topic={currentTopic} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-ocean/[0.015] to-blush-light/10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-blush-light/60 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-blush-dark" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-medium text-ocean mb-1">
                Interactive Karussell
              </h3>
              <p className="text-sm text-ocean/55 leading-relaxed">
                Claude generiert eine komplette React-Komponente mit Live-Preview.
                Direkt im Browser swipen, sofort als PNG exportieren — ohne Puppeteer,
                ohne Wartezeit. Gib links ein Thema ein und starte.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Sidebar: form + progress + history ──────────────────── */}
      <aside className="space-y-4 self-start">
        {/* Form */}
        <div className="rounded-2xl bg-white border border-ocean/[0.06] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-ocean text-sm font-medium">Thema</Label>
            {tsxCode && !generating && (
              <button
                onClick={startNew}
                className="inline-flex items-center gap-1 text-xs text-ocean/50 hover:text-ocean"
                type="button"
              >
                <Plus className="h-3 w-3" />
                Neu
              </button>
            )}
          </div>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={generating}
            rows={4}
            placeholder="z.B. Warum 90% aller Content-Creator nach 6 Monaten aufhören — und wie AI das verhindert."
            className="text-sm"
          />
          <div className="flex items-center gap-2 pt-1">
            {generating ? (
              <>
                <Button
                  onClick={cancel}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Abbrechen
                </Button>
                <Button
                  disabled
                  size="sm"
                  className="flex-1 gap-1.5 bg-blush text-white"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generiere…
                </Button>
              </>
            ) : (
              <Button
                onClick={generate}
                disabled={!topic.trim()}
                size="sm"
                className="w-full gap-1.5 bg-blush hover:bg-blush-dark text-white"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {tsxCode ? "Neues Karussell generieren" : "Karussell generieren"}
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl p-3 bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 break-words">{error}</span>
          </div>
        )}

        {/* Pipeline progress */}
        {(generating || stageEvents.length > 0) && (
          <div className="rounded-2xl bg-white border border-ocean/[0.06] p-4">
            <h4 className="text-xs font-semibold text-ocean/60 uppercase tracking-wider mb-3">
              Pipeline
            </h4>
            <ol className="space-y-2 text-sm">
              {stageEvents.map((ev, i) => (
                <li key={`${ev.stage}-${i}`} className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {ev.status === "done" ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : ev.status === "error" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blush" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-ocean/80 text-xs font-medium">
                      {STAGE_LABELS[ev.stage] || ev.stage}
                    </div>
                    {ev.data && (
                      <div className="text-[10.5px] text-ocean/50 mt-0.5 font-mono break-words">
                        {Object.entries(ev.data)
                          .map(
                            ([k, v]) =>
                              `${k}: ${typeof v === "object" ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}`,
                          )
                          .join(" · ")}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Chat-Refine — appears once a carousel is loaded/generated */}
        {currentRunId && tsxCode && !generating && (
          <div className="h-[420px]">
            <CarouselChat
              runId={currentRunId}
              onTsxUpdate={(newTsx) => setTsxCode(newTsx)}
            />
          </div>
        )}

        {/* History */}
        <div className="rounded-2xl bg-white border border-ocean/[0.06] p-4">
          <h4 className="text-xs font-semibold text-ocean/60 uppercase tracking-wider mb-3">
            Historie
          </h4>
          {loadingHistory ? (
            <p className="text-xs text-ocean/40">Lade…</p>
          ) : savedList.length === 0 ? (
            <p className="text-xs text-ocean/40">
              Noch keine Interactive-Karussells für diesen Client.
            </p>
          ) : (
            <ul className="space-y-1">
              {savedList.map((c) => {
                const date = new Date(c.updated_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "short",
                });
                const isActive = currentRunId === c.run_id;
                return (
                  <li key={c.id}>
                    <div
                      className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                        isActive
                          ? "bg-blush-light/40"
                          : "hover:bg-ocean/[0.03]"
                      }`}
                    >
                      <button
                        onClick={() => loadSaved(c.run_id)}
                        className="flex-1 text-left min-w-0"
                        type="button"
                      >
                        <div className="text-xs text-ocean line-clamp-2 leading-snug">
                          {c.topic || "Ohne Titel"}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-ocean/40 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {date}
                        </div>
                      </button>
                      <button
                        onClick={() => deleteSaved(c.run_id, c.topic || "Ohne Titel")}
                        className="opacity-0 group-hover:opacity-100 text-ocean/30 hover:text-red-500 transition-all p-1"
                        type="button"
                        title="Löschen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
