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
  History,
  ChevronDown,
} from "lucide-react";
import { CarouselReactPreview } from "@/components/carousel-react-preview";
import { CarouselChat } from "@/components/carousel-chat";
import { CarouselStyleGuidePicker } from "@/components/carousel-style-guide-picker";

interface ProgressEvent {
  stage: string;
  status: string;
  message?: string;
  /** Text chunk from Claude — only present on stage "text-delta". */
  delta?: string;
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
  // Accumulates text deltas while Claude streams the TSX. Cleared on each new run.
  const [streamingTsx, setStreamingTsx] = useState<string>("");
  // Active style guide for THIS run — picker writes it, generate reads it.
  // After loading a saved carousel, pre-fills with whatever guide was used then.
  const [styleGuideId, setStyleGuideId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [savedList, setSavedList] = useState<SavedReactCarousel[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

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
    setHistoryOpen(false);
    try {
      const res = await fetch(`/api/carousel/react/get?runId=${encodeURIComponent(runId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTsxCode(data.tsxCode);
      setCurrentTopic(data.topic || "");
      setCurrentRunId(data.runId);
      setTopic(data.topic || "");
      // Restore the style guide that was active when this carousel was generated
      // so chat-refine stays consistent with the original look.
      setStyleGuideId(typeof data.styleGuideId === "string" ? data.styleGuideId : null);
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

  const generate = async (topicText: string) => {
    if (!topicText.trim() || generating) return;
    setError(null);
    setEvents([]);
    setTsxCode(null);
    setCurrentRunId(null);
    setStreamingTsx("");
    setGenerating(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/carousel/react/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          topic: topicText.trim(),
          styleGuideId: styleGuideId ?? undefined,
        }),
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
            if (data.stage === "text-delta" && data.delta) {
              // Append the delta to the streaming buffer — UI re-renders preview live.
              setStreamingTsx((prev) => prev + data.delta);
            } else {
              setEvents((prev) => [...prev, data]);
            }
            if (data.stage === "complete" && data.result) {
              setTsxCode(data.result.tsxCode);
              setCurrentTopic(data.result.topic);
              setCurrentRunId(data.result.runId);
              setStreamingTsx("");
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
    setHistoryOpen(false);
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

  const hasCarousel = !!tsxCode && !!currentRunId;

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)] gap-4"
      style={{ height: "calc(100vh - 200px)", minHeight: 640 }}
    >
      {/* ─────────────── LEFT: Chat / Topic-Input panel ─────────────── */}
      <div className="flex flex-col min-h-0 rounded-2xl bg-white border border-ocean/[0.06] overflow-hidden">
        {/* Header — title row + tools row (style guide picker stays visible) */}
        <div className="px-4 py-3 border-b border-ocean/[0.06] shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blush-dark shrink-0" />
            <div className="text-sm font-medium text-ocean truncate">
              {hasCarousel ? currentTopic || "Karussell" : "Neues Karussell"}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ocean/55 hover:text-ocean hover:bg-ocean/[0.04] transition-colors"
                  type="button"
                  title="Historie"
                >
                  <History className="h-3.5 w-3.5" />
                  <ChevronDown className="h-3 w-3" />
                </button>
                {historyOpen && (
                  <HistoryDropdown
                    list={savedList}
                    loading={loadingHistory}
                    currentRunId={currentRunId}
                    onPick={loadSaved}
                    onDelete={deleteSaved}
                    onClose={() => setHistoryOpen(false)}
                  />
                )}
              </div>
              {hasCarousel && (
                <button
                  onClick={startNew}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ocean/55 hover:text-ocean hover:bg-ocean/[0.04] transition-colors"
                  type="button"
                  title="Neues Karussell"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Neu
                </button>
              )}
            </div>
          </div>
          {/* Style guide picker — visible in both states; locks once a
              carousel is loaded so chat-refine doesn't accidentally swap
              the active guide mid-stream. */}
          <div className="flex items-center gap-2">
            <CarouselStyleGuidePicker
              clientId={clientId}
              value={styleGuideId}
              disabled={generating || hasCarousel}
              onChange={setStyleGuideId}
            />
            {hasCarousel && (
              <span className="text-[10px] text-ocean/40">
                fest für diesen Run
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {hasCarousel ? (
            <CarouselChat
              runId={currentRunId!}
              clientId={clientId}
              onTsxUpdate={(newTsx) => setTsxCode(newTsx)}
            />
          ) : (
            <TopicComposer
              topic={topic}
              setTopic={setTopic}
              onGenerate={() => generate(topic)}
              onCancel={cancel}
              generating={generating}
              stageEvents={stageEvents}
              error={error}
            />
          )}
        </div>
      </div>

      {/* ─────────────── RIGHT: Live preview panel ─────────────── */}
      <div className="min-w-0 rounded-2xl bg-white border border-ocean/[0.06] overflow-hidden flex flex-col">
        {hasCarousel ? (
          <CarouselReactPreview tsxCode={tsxCode!} topic={currentTopic} />
        ) : streamingTsx ? (
          <StreamingCodeView tsxCode={streamingTsx} />
        ) : (
          <PreviewEmptyState generating={generating} />
        )}
      </div>
    </div>
  );
}

// ── Topic composer (left panel — empty state before any carousel exists) ────

interface TopicComposerProps {
  topic: string;
  setTopic: (v: string) => void;
  onGenerate: () => void;
  onCancel: () => void;
  generating: boolean;
  stageEvents: ProgressEvent[];
  error: string | null;
}

function TopicComposer({
  topic,
  setTopic,
  onGenerate,
  onCancel,
  generating,
  stageEvents,
  error,
}: TopicComposerProps) {
  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onGenerate();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
        <div className="rounded-2xl bg-blush-light/30 border border-blush/20 px-4 py-3 text-sm text-ocean leading-relaxed">
          <p className="font-medium mb-1">Womit fangen wir an?</p>
          <p className="text-ocean/70 text-[13px]">
            Beschreibe das Thema oder den Winkel des Karussells. Du kannst danach
            jederzeit per Chat verbessern und Fotos hochladen.
          </p>
        </div>

        {(generating || stageEvents.length > 0) && (
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-3">
            <h4 className="text-[10px] font-semibold text-ocean/60 uppercase tracking-wider mb-2">
              Pipeline
            </h4>
            <ol className="space-y-1.5 text-sm">
              {stageEvents.map((ev, i) => (
                <li key={`${ev.stage}-${i}`} className="flex items-start gap-2">
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
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && (
          <div className="rounded-xl p-3 bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="flex-1 break-words">{error}</span>
          </div>
        )}
      </div>

      <div className="border-t border-ocean/[0.06] p-3 shrink-0">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={onKey}
          disabled={generating}
          rows={3}
          placeholder="z.B. Warum 90% aller Content-Creator nach 6 Monaten aufhören — und wie AI das verhindert."
          className="w-full resize-none rounded-lg border border-ocean/10 bg-warm-white px-3 py-2 text-sm text-ocean focus:outline-none focus:border-blush disabled:opacity-60"
        />
        <div className="mt-2 flex items-center gap-2">
          <p className="text-[11px] text-ocean/40 mr-auto hidden sm:block">⌘+Enter zum Senden</p>
          {generating ? (
            <button
              onClick={onCancel}
              type="button"
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg px-3 text-sm border border-ocean/10 text-ocean/70 hover:text-ocean hover:bg-ocean/[0.04] transition-colors"
            >
              Abbrechen
            </button>
          ) : null}
          <button
            onClick={onGenerate}
            disabled={!topic.trim() || generating}
            type="button"
            className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg px-4 text-sm font-medium bg-blush hover:bg-blush-dark text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generiere…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Karussell starten
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty preview state (right panel before any carousel exists) ────────────

function PreviewEmptyState({ generating }: { generating: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 bg-gradient-to-br from-ocean/[0.015] to-blush-light/10 text-center">
      <div className="h-16 w-16 rounded-2xl bg-blush-light/60 flex items-center justify-center">
        {generating ? (
          <Loader2 className="h-7 w-7 text-blush-dark animate-spin" />
        ) : (
          <Sparkles className="h-7 w-7 text-blush-dark" />
        )}
      </div>
      <div className="max-w-md">
        <h3 className="text-lg font-medium text-ocean mb-1">
          {generating ? "Claude baut dein Karussell…" : "Live-Preview"}
        </h3>
        <p className="text-sm text-ocean/55 leading-relaxed">
          {generating
            ? "Sobald die Komponente fertig ist, erscheint sie hier rechts. Du kannst sie danach im Chat links iterativ verbessern."
            : "Sobald du das Thema im Chat links beschrieben hast, erscheint dein Karussell hier — direkt im Browser swipebar, sofort als PNG exportierbar."}
        </p>
      </div>
    </div>
  );
}

// ── History dropdown ────────────────────────────────────────────────────────

interface HistoryDropdownProps {
  list: SavedReactCarousel[];
  loading: boolean;
  currentRunId: string | null;
  onPick: (runId: string) => void;
  onDelete: (runId: string, label: string) => void;
  onClose: () => void;
}

function HistoryDropdown({
  list,
  loading,
  currentRunId,
  onPick,
  onDelete,
  onClose,
}: HistoryDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 w-72 rounded-xl bg-white border border-ocean/10 shadow-lg z-20 max-h-[420px] overflow-hidden flex flex-col"
    >
      <div className="px-3 py-2 border-b border-ocean/[0.06] text-[10px] font-semibold text-ocean/60 uppercase tracking-wider">
        Historie
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <p className="text-xs text-ocean/40 px-2 py-3">Lade…</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-ocean/40 px-2 py-3">
            Noch keine Karussells für diesen Client.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {list.map((c) => {
              const date = new Date(c.updated_at).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "short",
              });
              const isActive = currentRunId === c.run_id;
              return (
                <li key={c.id}>
                  <div
                    className={`group flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                      isActive ? "bg-blush-light/40" : "hover:bg-ocean/[0.03]"
                    }`}
                  >
                    <button
                      onClick={() => onPick(c.run_id)}
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
                      onClick={() => onDelete(c.run_id, c.topic || "Ohne Titel")}
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
    </div>
  );
}

// ── Streaming code view shown while Claude writes the TSX ────────────────────
// Babel can't parse partial TSX, so during the stream we just show the raw
// code scrolling in. As soon as the response completes the parent swaps this
// out for the real <CarouselReactPreview /> sandbox.

function StreamingCodeView({ tsxCode }: { tsxCode: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    // Keep the latest tokens visible — same UX trick as a chat transcript.
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [tsxCode]);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-2.5 border-b border-ocean/[0.06] flex items-center gap-2 shrink-0">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blush-dark" />
        <span className="text-xs font-medium text-ocean/70">Claude schreibt das Karussell…</span>
        <span className="ml-auto text-[10px] tabular-nums text-ocean/40">
          {tsxCode.length.toLocaleString()} chars
        </span>
      </div>
      <pre
        ref={ref}
        className="flex-1 min-h-0 overflow-auto px-4 py-3 text-[11px] leading-relaxed font-mono text-ocean/70 bg-ocean/[0.015] whitespace-pre-wrap"
      >
        {tsxCode}
        <span className="inline-block w-1.5 h-3 ml-0.5 bg-blush-dark animate-pulse align-middle" />
      </pre>
    </div>
  );
}
