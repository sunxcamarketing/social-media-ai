"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Loader2,
  Upload,
  X,
  Check,
  AlertCircle,
  Grid3x3,
  ExternalLink,
  FileCode,
  RefreshCw,
  Trash2,
  Clock,
  Plus as PlusIcon,
  ArrowLeft,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientsCache } from "@/hooks/use-clients-cache";
import { useI18n } from "@/lib/i18n";
import { CarouselReactMode } from "@/components/carousel-react-mode";

interface StyleOption {
  id: string;
  name: string;
  previewFile: string | null;
  primaryColor: string | null;
}

interface CompleteResult {
  runId: string;
  slideFiles: string[];
  slideCount: number;
  photoCount: number;
  generatedImages: number;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
}

interface SavedCarousel {
  id: string;
  run_id: string;
  topic: string;
  style_id: string;
  handle: string;
  slide_count: number;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ProgressEvent {
  stage: string;
  status: string;
  message?: string;
  index?: number;
  total?: number;
  data?: Record<string, unknown>;
  result?: CompleteResult;
}

export default function ClientCarouselPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const clients = useClientsCache();
  const { lang } = useI18n();
  const client = useMemo(() => clients.find((c) => c.id === clientId), [clientId, clients]);

  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [topic, setTopic] = useState<string>("");
  const [styleId, setStyleId] = useState<string>("02-split-screen");
  const [handle, setHandle] = useState<string>("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Saved carousel history
  const [savedCarousels, setSavedCarousels] = useState<SavedCarousel[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Per-slide regen loading state: null = nothing regenerating, -1 = all, number = specific slide idx
  const [regeneratingSlideIdx, setRegeneratingSlideIdx] = useState<number | null>(null);

  // Cache-buster incremented after each successful regen so <img> urls refresh
  const [resultVersion, setResultVersion] = useState<number>(0);

  // View mode: "list" = show history grid with + button. "create" = new-carousel form. "view" = slide gallery of current result.
  const [viewMode, setViewMode] = useState<"list" | "create" | "view">("list");

  // Top-level mode switch: classic HTML→PNG pipeline vs interactive React preview.
  const [carouselMode, setCarouselMode] = useState<"classic" | "react">("react");

  // Regenerate modal state
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenTargetSlide, setRegenTargetSlide] = useState<number | null>(null); // null = all
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenImage, setRegenImage] = useState<File | null>(null);
  const pasteZoneRef = useRef<HTMLDivElement>(null);

  const pick = <T,>(de: T, en: T): T => (lang === "en" ? en : de);

  const STAGE_LABELS: Record<string, string> = useMemo(() => ({
    config: pick("Client-Config laden", "Loading client config"),
    photos: pick("Fotos verarbeiten", "Processing photos"),
    claude: pick("Claude generiert Layout", "Claude generating layout"),
    normalize: pick("Slide-Zähler normalisieren", "Normalizing slide numbers"),
    "nano-banana": pick("AI-Bilder generieren", "Generating AI images"),
    puppeteer: pick("Slides als PNG rendern", "Rendering slides to PNG"),
    slide: pick("Slide gerendert", "Slide rendered"),
    done: pick("Fertig", "Done"),
    complete: pick("Fertig", "Done"),
    error: pick("Fehler", "Error"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lang]);

  useEffect(() => {
    fetch("/api/carousel/styles")
      .then((r) => r.json())
      .then((d) => setStyles(d.styles || []))
      .catch(() => {});
  }, []);

  const refreshHistory = () => {
    setLoadingHistory(true);
    fetch(`/api/carousel/list?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setSavedCarousels(d.carousels || []))
      .catch(() => setSavedCarousels([]))
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => {
    if (!clientId) return;
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Auto-refresh history after a successful generation/regeneration
  useEffect(() => {
    if (result) refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.runId]);

  const loadSaved = async (runId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/carousel/get?runId=${encodeURIComponent(runId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult({
        runId: data.runId,
        slideFiles: data.slideFiles,
        slideCount: data.slideCount,
        photoCount: data.photoCount,
        generatedImages: data.generatedImages,
        tokensIn: data.tokensIn,
        tokensOut: data.tokensOut,
        durationMs: data.durationMs,
      });
      setTopic(data.topic || "");
      setStyleId(data.styleId || "02-split-screen");
      setHandle(data.handle || "");
      setEvents([]);
      setViewMode("view");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteSaved = async (runId: string, topicLabel: string) => {
    const confirmMsg = pick(
      `Karussell "${topicLabel}" wirklich löschen?`,
      `Really delete carousel "${topicLabel}"?`,
    );
    if (!confirm(confirmMsg)) return;
    await fetch(`/api/carousel/delete?runId=${encodeURIComponent(runId)}`, { method: "DELETE" });
    if (result?.runId === runId) setResult(null);
    refreshHistory();
  };

  const startNew = () => {
    setResult(null);
    setTopic("");
    setHandle("");
    setPhotos([]);
    setEvents([]);
    setError(null);
    setViewMode("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToList = () => {
    setResult(null);
    setEvents([]);
    setError(null);
    setViewMode("list");
  };

  const handleFileAdd = (files: FileList | null) => {
    if (!files) return;
    const next: File[] = [];
    for (const f of Array.from(files)) {
      if (f.type.startsWith("image/")) next.push(f);
    }
    setPhotos((prev) => [...prev, ...next]);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmit = topic.trim().length > 0 && !generating;

  const submit = async () => {
    setError(null);
    setEvents([]);
    setResult(null);
    setGenerating(true);

    const form = new FormData();
    form.append("clientId", clientId);
    form.append("topic", topic.trim());
    form.append("styleId", styleId);
    if (handle.trim()) form.append("handle", handle.trim());
    photos.forEach((p, i) => form.append(`photo_${i}`, p, p.name));

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        body: form,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
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
              setResult(data.result);
              setResultVersion((v) => v + 1);
              setViewMode("view");
            }
            if (data.stage === "error") {
              setError(data.message || pick("Unbekannter Fehler", "Unknown error"));
            }
          } catch {
            // ignore parse errors
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

  const slideUrl = (file: string) =>
    result ? `/api/carousel/file?run=${encodeURIComponent(result.runId)}&file=${encodeURIComponent(file)}&v=${resultVersion}` : "";

  const downloadAll = async () => {
    if (!result) return;
    for (const f of result.slideFiles) {
      const a = document.createElement("a");
      a.href = slideUrl(f);
      a.download = f.split("/").pop() || "slide.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  // ── Regenerate modal ────────────────────────────────────────────────────

  const openRegen = (slideIdx: number | null) => {
    setRegenTargetSlide(slideIdx);
    setRegenFeedback("");
    setRegenImage(null);
    setRegenOpen(true);
  };

  const closeRegen = () => {
    setRegenOpen(false);
    setRegenFeedback("");
    setRegenImage(null);
  };

  // Paste handler for clipboard image
  useEffect(() => {
    if (!regenOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setRegenImage(file);
            e.preventDefault();
            return;
          }
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [regenOpen]);

  const submitRegen = async () => {
    if (!result) return;
    // Capture regen state before closing the modal (modal close clears regenTargetSlide)
    const targetIdx = regenTargetSlide;
    const feedback = regenFeedback.trim();
    const image = regenImage;

    setError(null);
    setRegenOpen(false);
    setGenerating(true);
    setRegeneratingSlideIdx(targetIdx === null ? -1 : targetIdx);
    setEvents([]);

    const form = new FormData();
    form.append("runId", result.runId);
    form.append("clientId", clientId);
    form.append("feedback", feedback);
    if (targetIdx !== null) form.append("slideIndex", String(targetIdx));
    if (image) form.append("replacementImage", image, image.name);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/carousel/regenerate", {
        method: "POST",
        body: form,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
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
              setResult(data.result);
              // Bump version so browsers reload the overwritten slide PNGs
              setResultVersion((v) => v + 1);
            }
            if (data.stage === "error") {
              setError(data.message || pick("Unbekannter Fehler", "Unknown error"));
            }
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message);
      }
    } finally {
      setGenerating(false);
      setRegeneratingSlideIdx(null);
      abortRef.current = null;
    }
  };

  const stageEvents = useMemo(() => {
    const byStage = new Map<string, ProgressEvent>();
    for (const e of events) {
      if (e.stage !== "slide") byStage.set(e.stage, e);
    }
    return Array.from(byStage.entries());
  }, [events]);

  const slideCount = events.filter((e) => e.stage === "slide").length;

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blush-light to-blush flex items-center justify-center">
            <Grid3x3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-ocean">
              {pick("Karussell-Generator", "Carousel Generator")}
            </h1>
            <p className="text-sm text-ocean/55">
              {client
                ? pick(`Für ${client.configName || client.name} · Admin-Tool`, `For ${client.configName || client.name} · Admin tool`)
                : pick("Admin-Tool", "Admin tool")}
            </p>
          </div>
        </div>

        {/* ── Mode switcher (Classic ↔ Interactive) ──────────────── */}
        <div className="inline-flex items-center rounded-xl border border-ocean/[0.08] bg-white p-0.5 shadow-[0_1px_4px_rgba(32,35,69,0.04)]">
          <button
            type="button"
            onClick={() => setCarouselMode("react")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              carouselMode === "react"
                ? "bg-ocean text-white shadow-[0_1px_4px_rgba(32,35,69,0.15)]"
                : "text-ocean/55 hover:text-ocean"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Interactive
          </button>
          <button
            type="button"
            onClick={() => setCarouselMode("classic")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              carouselMode === "classic"
                ? "bg-ocean text-white shadow-[0_1px_4px_rgba(32,35,69,0.15)]"
                : "text-ocean/55 hover:text-ocean"
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            Classic
          </button>
        </div>
      </div>

      {/* ── Interactive (React component) mode ──────────────────── */}
      {carouselMode === "react" && (
        <CarouselReactMode clientId={clientId} />
      )}

      {/* ── Back button when in create/view mode (classic only) ── */}
      {carouselMode === "classic" && viewMode !== "list" && (
        <button
          onClick={backToList}
          className="mb-5 flex items-center gap-1.5 text-sm text-ocean/60 hover:text-ocean transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {pick("Zurück zur Übersicht", "Back to overview")}
        </button>
      )}

      {/* ── LIST MODE: gallery of saved carousels with + tile ──── */}
      {carouselMode === "classic" && viewMode === "list" && (
        <div>
          {loadingHistory ? (
            <p className="text-sm text-ocean/45">{pick("Lade...", "Loading...")}</p>
          ) : savedCarousels.length === 0 ? (
            // Empty state — centered large + tile
            <div className="rounded-3xl border-2 border-dashed border-ocean/[0.12] bg-white/40 py-20 px-8 flex flex-col items-center justify-center gap-4 text-center">
              <button
                onClick={startNew}
                className="h-20 w-20 rounded-full bg-blush hover:bg-blush-dark text-white flex items-center justify-center shadow-[0_8px_28px_rgba(236,189,201,0.5)] hover:shadow-[0_10px_34px_rgba(236,189,201,0.6)] transition-all hover:scale-105 btn-press"
              >
                <PlusIcon className="h-10 w-10" />
              </button>
              <div>
                <div className="text-base font-medium text-ocean">
                  {pick("Dein erstes Karussell", "Your first carousel")}
                </div>
                <div className="text-sm text-ocean/55 mt-1 max-w-md">
                  {pick(
                    "Klick auf das Plus um ein Karussell für diesen Client zu generieren.",
                    "Click the plus to generate a carousel for this client.",
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* "+" tile — always first */}
              <button
                onClick={startNew}
                className="group relative rounded-2xl border-2 border-dashed border-ocean/[0.15] hover:border-blush bg-white hover:bg-blush-light/20 transition-all aspect-square flex flex-col items-center justify-center gap-2 text-ocean/45 hover:text-blush-dark"
              >
                <div className="h-12 w-12 rounded-full bg-ocean/[0.04] group-hover:bg-blush/20 flex items-center justify-center transition-colors">
                  <PlusIcon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium">
                  {pick("Neues Karussell", "New carousel")}
                </span>
              </button>

              {/* Saved carousel cards */}
              {savedCarousels.map((c) => {
                const date = new Date(c.updated_at).toLocaleDateString(lang === "en" ? "en-US" : "de-DE", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const previewSlide = `/api/carousel/file?run=${encodeURIComponent(c.run_id)}&file=${encodeURIComponent("slides/slide-01.png")}`;
                return (
                  <div
                    key={c.id}
                    className="group relative rounded-2xl overflow-hidden border border-ocean/[0.08] bg-white hover:border-blush/40 hover:-translate-y-0.5 transition-all shadow-[0_2px_8px_rgba(32,35,69,0.04)] hover:shadow-[0_4px_18px_rgba(32,35,69,0.08)]"
                  >
                    <button
                      onClick={() => loadSaved(c.run_id)}
                      className="block w-full text-left"
                    >
                      {/* Preview image (first slide) */}
                      <div className="relative aspect-square bg-ocean/[0.04] overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewSlide}
                          alt={c.topic || "Carousel"}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-mono font-semibold">
                          {c.slide_count} {pick("Slides", "slides")}
                        </div>
                      </div>
                      {/* Metadata */}
                      <div className="p-3">
                        <div className="text-sm text-ocean font-medium line-clamp-2 leading-tight min-h-[2.6em]">
                          {c.topic || pick("Ohne Titel", "Untitled")}
                        </div>
                        <div className="text-[11px] text-ocean/45 mt-1.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {date}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSaved(c.run_id, c.topic || "Untitled"); }}
                      className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-white/90 hover:bg-red-50 text-ocean/45 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm"
                      title={pick("Löschen", "Delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE / VIEW mode: form + slides + progress ────── */}
      {carouselMode === "classic" && viewMode !== "list" && (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-6">
        {/* ── Main form / slides gallery ─────────────────────────── */}
        <div className="space-y-5">
          {viewMode === "create" && (
          <div className="rounded-2xl bg-white border border-ocean/[0.06] p-6 space-y-4">
            <div>
              <Label className="text-ocean text-sm font-medium">
                {pick("Topic / Thema", "Topic")}
              </Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={generating}
                rows={3}
                placeholder={pick(
                  "z.B. Warum 90% aller Content-Creator nach 6 Monaten aufhören (und wie AI das verhindert)",
                  "e.g. Why 90% of content creators quit after 6 months (and how AI prevents it)",
                )}
                className="mt-1.5"
              />
              <p className="mt-1.5 text-xs text-ocean/50">
                {pick(
                  "Je konkreter der Kontrast/das Versprechen, desto stärker das Karussell.",
                  "The more concrete the contrast/promise, the stronger the carousel.",
                )}
              </p>
            </div>

            <div>
              <Label className="text-ocean text-sm font-medium mb-2 block">
                {pick("Style wählen", "Pick a style")}
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {styles.map((s) => {
                  const selected = styleId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => !generating && setStyleId(s.id)}
                      disabled={generating}
                      title={s.name}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[4/5] group ${
                        selected
                          ? "border-blush shadow-[0_4px_18px_rgba(32,35,69,0.12)]"
                          : "border-ocean/[0.08] hover:border-ocean/25 hover:-translate-y-0.5"
                      } ${generating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {s.previewFile ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/carousel/style-preview?id=${encodeURIComponent(s.id)}`}
                          alt={s.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            background: s.primaryColor
                              ? `linear-gradient(135deg, ${s.primaryColor} 0%, ${s.primaryColor}aa 100%)`
                              : "linear-gradient(135deg, #E8EAF0 0%, #D4D8E2 100%)",
                          }}
                        >
                          <Grid3x3 className={`h-8 w-8 ${s.primaryColor ? "text-white/70" : "text-ocean/40"}`} />
                        </div>
                      )}
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-blush flex items-center justify-center shadow-lg">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 py-1.5">
                        <div className="text-[10.5px] font-medium text-white leading-tight line-clamp-1">
                          {s.name}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label className="text-ocean text-sm font-medium">
                {pick("Handle-Override (optional)", "Handle override (optional)")}
              </Label>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={generating}
                placeholder={client?.instagram || "@handle"}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-ocean text-sm font-medium">
                {pick("Zusätzliche Fotos (optional)", "Additional photos (optional)")}
              </Label>
              <label
                htmlFor="carousel-photos"
                className={`mt-1.5 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ocean/[0.12] bg-ocean/[0.02] py-8 px-4 cursor-pointer hover:bg-ocean/[0.04] transition-colors ${generating ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Upload className="h-5 w-5 text-ocean/40" />
                <span className="text-sm text-ocean/60">
                  {pick("Drag & Drop oder klicken — mehrere Fotos erlaubt", "Drag & drop or click — multiple photos allowed")}
                </span>
                <input
                  id="carousel-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileAdd(e.target.files)}
                  className="hidden"
                  disabled={generating}
                />
              </label>
              {photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-ocean/[0.04] border border-ocean/[0.06] text-xs text-ocean/70"
                    >
                      <ImageIcon className="h-3 w-3" />
                      <span className="max-w-[140px] truncate">{p.name}</span>
                      <button
                        onClick={() => removePhoto(i)}
                        disabled={generating}
                        className="text-ocean/40 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {generating && (
                <Button onClick={cancel} variant="outline" size="sm">
                  {pick("Abbrechen", "Cancel")}
                </Button>
              )}
              <Button
                onClick={submit}
                disabled={!canSubmit}
                className="gap-2 bg-blush hover:bg-blush-dark text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {pick("Generiere...", "Generating...")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {pick("Karussell generieren", "Generate carousel")}
                  </>
                )}
              </Button>
            </div>
          </div>
          )}

          {/* ── Slides gallery (view mode) ──────────────────── */}
          {viewMode === "view" && result && (
            <div className="rounded-2xl bg-white border border-ocean/[0.06] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-ocean">
                    {pick(`${result.slideCount} Slides fertig`, `${result.slideCount} slides ready`)}
                  </h2>
                  <p className="text-xs text-ocean/55">
                    {result.photoCount} {pick("Client-Fotos", "client photos")} · {result.generatedImages} {pick("AI-Bilder", "AI images")} ·{" "}
                    {(result.durationMs / 1000).toFixed(1)}s ·{" "}
                    {result.tokensIn + result.tokensOut} Tokens
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => openRegen(null)}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={generating}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {pick("Alle neu generieren", "Regenerate all")}
                  </Button>
                  <Button onClick={downloadAll} variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    {pick("Alle runterladen", "Download all")}
                  </Button>
                  <a
                    href={`/api/carousel/file?run=${encodeURIComponent(result.runId)}&file=carousel.html`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-ocean/[0.12] text-ocean/70 hover:bg-ocean/[0.03]"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    HTML
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {result.slideFiles.map((f, i) => {
                  const isRegenerating = regeneratingSlideIdx === i || regeneratingSlideIdx === -1;
                  return (
                    <div
                      key={f}
                      className="group relative rounded-xl overflow-hidden bg-ocean/[0.04] border border-ocean/[0.06] hover:border-blush/40 transition-colors"
                      style={{ aspectRatio: "1080 / 1350" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slideUrl(f)}
                        alt={`Slide ${i + 1}`}
                        className={`absolute inset-0 w-full h-full object-cover transition-all ${isRegenerating ? "blur-sm opacity-60" : ""}`}
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-mono font-semibold">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      {/* Regenerating overlay */}
                      {isRegenerating && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 backdrop-blur-[2px]">
                          <Loader2 className="h-6 w-6 animate-spin text-blush" />
                          <span className="text-[11px] font-medium text-ocean">
                            {pick("Wird überarbeitet...", "Regenerating...")}
                          </span>
                        </div>
                      )}
                      {/* Hover actions (hidden while regenerating) */}
                      {!isRegenerating && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <a
                            href={slideUrl(f)}
                            target="_blank"
                            rel="noreferrer"
                            className="h-9 w-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-ocean shadow-lg transition-transform hover:scale-110"
                            title={pick("Öffnen", "Open")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => openRegen(i)}
                            disabled={generating}
                            className="h-9 px-3 rounded-full bg-blush hover:bg-blush-dark text-white flex items-center gap-1.5 text-xs font-medium shadow-lg transition-all hover:scale-105 disabled:opacity-50"
                            title={pick("Neu generieren", "Regenerate")}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            {pick("Neu", "Regen")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Progress panel ───────────────────────── */}
        <div className="rounded-2xl bg-white border border-ocean/[0.06] p-5 self-start sticky top-6 max-h-[calc(100vh-3rem)] overflow-auto">
          <h3 className="text-sm font-semibold text-ocean mb-4 flex items-center gap-2">
            <Loader2
              className={`h-4 w-4 ${generating ? "animate-spin text-blush" : "text-ocean/30"}`}
            />
            {pick("Pipeline", "Pipeline")}
          </h3>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {!generating && events.length === 0 && !result && (
            <p className="text-xs text-ocean/45 leading-relaxed">
              {pick(
                "Gib ein Thema ein, wähle einen Style, optional Fotos — dann startet die Pipeline.",
                "Enter a topic, pick a style, optionally add photos — then the pipeline starts.",
              )}
            </p>
          )}

          <ol className="space-y-2 text-sm">
            {stageEvents.map(([stage, ev]) => (
              <li key={stage} className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {ev.status === "done" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : ev.status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-blush" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-ocean/80 font-medium">
                    {STAGE_LABELS[stage] || stage}
                  </div>
                  {ev.data ? (
                    <div className="text-[11px] text-ocean/50 mt-0.5 font-mono break-words">
                      {Object.entries(ev.data)
                        .filter(([k]) => !["slideFiles", "htmlPath", "outDir"].includes(k))
                        .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60)}`)
                        .join(" · ")}
                    </div>
                  ) : ev.message ? (
                    <div className="text-[11px] text-red-500 mt-0.5">{ev.message}</div>
                  ) : null}
                </div>
              </li>
            ))}

            {slideCount > 0 && (
              <li className="flex items-start gap-2.5 pt-1">
                <div className="mt-0.5 shrink-0">
                  {result ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-blush" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-ocean/80 font-medium">
                    {pick("Slide-Rendering", "Slide rendering")} ({slideCount}{result ? `/${result.slideCount}` : ""})
                  </div>
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {events
                      .filter((e) => e.stage === "slide")
                      .map((e) => (
                        <div
                          key={e.index}
                          className="h-4 w-4 rounded bg-green-500/80 flex items-center justify-center text-[8px] font-mono text-white"
                        >
                          {e.index}
                        </div>
                      ))}
                  </div>
                </div>
              </li>
            )}
          </ol>
        </div>
      </div>
      )}

      {/* ── Regenerate Modal (classic only) ──────────────────── */}
      {carouselMode === "classic" && regenOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={closeRegen}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4">
              <h3 className="text-center text-lg font-semibold text-ocean">
                {pick("Was möchtest du ändern?", "What would you like to change?")}
              </h3>
              {regenTargetSlide !== null && (
                <p className="text-center text-xs text-ocean/55 mt-1">
                  {pick(`Slide ${regenTargetSlide + 1}`, `Slide ${regenTargetSlide + 1}`)}
                </p>
              )}
            </div>

            <div className="px-6 pb-4">
              <Textarea
                value={regenFeedback}
                onChange={(e) => setRegenFeedback(e.target.value)}
                rows={3}
                placeholder={pick(
                  "Mach den Hintergrund heller, wechsle das Farbschema, mehr Kontrast...",
                  "Make the background lighter, change the color scheme, add more contrast...",
                )}
                className="w-full"
                autoFocus
              />
            </div>

            <div className="px-6 pb-4 border-t border-ocean/[0.06] pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-ocean">
                  {pick("Eigenes Bild nutzen", "Use your own image")}
                </span>
              </div>

              <div className="space-y-2.5">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-ocean/[0.12] bg-white hover:bg-ocean/[0.03] cursor-pointer text-sm text-ocean transition-colors">
                  <Upload className="h-4 w-4" />
                  {pick("Datei auswählen", "Select file")}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setRegenImage(f);
                    }}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-ocean/55 ml-2">
                  {pick("oder Bild unten einfügen", "or paste an image below")}
                </span>

                <div
                  ref={pasteZoneRef}
                  tabIndex={0}
                  className="rounded-xl border-2 border-dashed border-ocean/[0.15] bg-ocean/[0.02] p-4 text-center text-xs text-ocean/55 focus:outline-none focus:border-blush focus:bg-blush-light/20 transition-colors"
                >
                  {regenImage ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <ImageIcon className="h-4 w-4 text-ocean/60 shrink-0" />
                        <span className="text-ocean/80 truncate">{regenImage.name}</span>
                      </div>
                      <button
                        onClick={() => setRegenImage(null)}
                        className="text-ocean/40 hover:text-red-500 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    pick(
                      "Hier klicken und Cmd/Ctrl+V drücken um ein Bild aus der Zwischenablage einzufügen",
                      "Click here and press Cmd/Ctrl+V to paste an image from clipboard",
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-ocean/[0.02] border-t border-ocean/[0.06]">
              <button
                onClick={closeRegen}
                className="text-sm text-ocean/60 hover:text-ocean transition-colors"
              >
                {pick("Schließen", "Close")}
              </button>
              <Button
                onClick={submitRegen}
                disabled={!regenFeedback.trim() && !regenImage}
                className="gap-2 bg-blush hover:bg-blush-dark text-white"
              >
                <Sparkles className="h-4 w-4" />
                {pick("Neu generieren", "Regenerate")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
