"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClientsCache } from "@/hooks/use-clients-cache";

interface StyleOption {
  id: string;
  name: string;
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

interface ProgressEvent {
  stage: string;
  status: string;
  message?: string;
  index?: number;
  total?: number;
  data?: Record<string, unknown>;
  result?: CompleteResult;
}

const STAGE_LABELS: Record<string, string> = {
  config: "Client-Config laden",
  photos: "Fotos verarbeiten",
  claude: "Claude generiert Layout",
  normalize: "Slide-Zähler normalisieren",
  "nano-banana": "AI-Bilder generieren (Nano Banana)",
  puppeteer: "Slides als PNG rendern",
  slide: "Slide gerendert",
  done: "Fertig",
  complete: "Fertig",
  error: "Fehler",
};

export default function CarouselPage() {
  const clients = useClientsCache();
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [styleId, setStyleId] = useState<string>("02-split-screen");
  const [handle, setHandle] = useState<string>("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/carousel/styles")
      .then((r) => r.json())
      .then((d) => setStyles(d.styles || []))
      .catch(() => {});
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clientId, clients],
  );

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

  const canSubmit = clientId && topic.trim().length > 0 && !generating;

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
            }
            if (data.stage === "error") {
              setError(data.message || "Unbekannter Fehler");
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
    result ? `/api/carousel/file?run=${encodeURIComponent(result.runId)}&file=${encodeURIComponent(file)}` : "";

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

  const stageEvents = useMemo(() => {
    const byStage = new Map<string, ProgressEvent>();
    for (const e of events) {
      if (e.stage !== "slide") byStage.set(e.stage, e);
    }
    return Array.from(byStage.entries());
  }, [events]);

  const slideCount = events.filter((e) => e.stage === "slide").length;

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blush-light to-blush flex items-center justify-center">
          <Grid3x3 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-ocean">Karussell-Generator</h1>
          <p className="text-sm text-ocean/55">
            Admin-Tool für Instagram-Karussells · Claude + Nano Banana + Puppeteer
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-6">
        {/* ── Main form ─────────────────────────── */}
        <div className="space-y-5">
          <div className="rounded-2xl bg-white border border-ocean/[0.06] p-6 space-y-4">
            <div>
              <Label className="text-ocean text-sm font-medium">Client</Label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={generating}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-ocean/[0.12] bg-white text-sm text-ocean focus:outline-none focus:ring-2 focus:ring-blush/40 disabled:opacity-50"
              >
                <option value="">— Client wählen —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.configName || c.name || c.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              {selectedClient && (
                <p className="mt-1.5 text-xs text-ocean/50">
                  @{handle.trim() || selectedClient.instagram || "kein-handle"}
                </p>
              )}
            </div>

            <div>
              <Label className="text-ocean text-sm font-medium">Topic / Thema</Label>
              <Textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={generating}
                rows={3}
                placeholder="z.B. Warum 90% aller Content-Creator nach 6 Monaten aufhören (und wie AI das verhindert)"
                className="mt-1.5"
              />
              <p className="mt-1.5 text-xs text-ocean/50">
                Je konkreter der Kontrast/das Versprechen, desto stärker das Karussell.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-ocean text-sm font-medium">Style</Label>
                <select
                  value={styleId}
                  onChange={(e) => setStyleId(e.target.value)}
                  disabled={generating}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-ocean/[0.12] bg-white text-sm text-ocean focus:outline-none focus:ring-2 focus:ring-blush/40 disabled:opacity-50"
                >
                  {styles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-ocean text-sm font-medium">Handle-Override (optional)</Label>
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  disabled={generating}
                  placeholder="z.B. aysun.caliskan"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label className="text-ocean text-sm font-medium">
                Zusätzliche Fotos (optional, werden mit Client-Bibliothek gemerged)
              </Label>
              <label
                htmlFor="carousel-photos"
                className={`mt-1.5 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ocean/[0.12] bg-ocean/[0.02] py-8 px-4 cursor-pointer hover:bg-ocean/[0.04] transition-colors ${generating ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Upload className="h-5 w-5 text-ocean/40" />
                <span className="text-sm text-ocean/60">Drag & Drop oder klicken — mehrere Fotos erlaubt</span>
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
                  Abbrechen
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
                    Generiere...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Karussell generieren
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* ── Slides gallery ──────────────────── */}
          {result && (
            <div className="rounded-2xl bg-white border border-ocean/[0.06] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-ocean">
                    {result.slideCount} Slides fertig
                  </h2>
                  <p className="text-xs text-ocean/55">
                    {result.photoCount} Client-Fotos · {result.generatedImages} AI-Bilder ·{" "}
                    {(result.durationMs / 1000).toFixed(1)}s ·{" "}
                    {result.tokensIn + result.tokensOut} Tokens
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={downloadAll} variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Alle runterladen
                  </Button>
                  <a
                    href={`/api/carousel/file?run=${encodeURIComponent(result.runId)}&file=carousel.html`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-ocean/[0.12] text-ocean/70 hover:bg-ocean/[0.03]"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    HTML öffnen
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {result.slideFiles.map((f, i) => (
                  <a
                    key={f}
                    href={slideUrl(f)}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative rounded-xl overflow-hidden bg-ocean/[0.04] border border-ocean/[0.06] hover:border-blush/40 transition-colors"
                    style={{ aspectRatio: "1080 / 1350" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slideUrl(f)}
                      alt={`Slide ${i + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-mono font-semibold">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <ExternalLink className="h-5 w-5 text-white opacity-0 group-hover:opacity-90 transition-opacity drop-shadow" />
                    </div>
                  </a>
                ))}
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
            Pipeline
          </h3>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {!generating && events.length === 0 && !result && (
            <p className="text-xs text-ocean/45 leading-relaxed">
              Wähle Client + Thema, dann startet die Pipeline: Claude erzeugt das Layout, Nano Banana
              füllt fehlende Bilder, Puppeteer rendert die PNGs.
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
                    Slide-Rendering ({slideCount}{result ? `/${result.slideCount}` : ""})
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
    </div>
  );
}
