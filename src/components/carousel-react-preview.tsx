"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * CarouselReactPreview
 *
 * Renders a Claude-generated React component (TSX string) inside a sandboxed
 * same-origin iframe. Uses @babel/standalone to compile JSX on the fly,
 * React/ReactDOM + Tailwind CDN are pre-loaded, plus a curated Google Fonts set.
 *
 * - The iframe is 1080×1440 (Instagram 3:4 cover); we apply a CSS transform
 *   scale so it visually fits the surrounding container.
 * - Export uses `html-to-image` from the parent window to rasterize each
 *   `<section className="slide">` element inside the iframe into PNG at the
 *   real 1080×1440 pixel dimensions.
 * - allow-scripts + allow-same-origin is required because the parent needs
 *   DOM access for PNG export. Admin-only tool; we trust Claude's output.
 */

// ── Curated Google Fonts palette matching the generator prompt ─────────────
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@100..900",
    "family=Plus+Jakarta+Sans:wght@200..800",
    "family=Space+Grotesk:wght@300..700",
    "family=DM+Sans:opsz,wght@9..40,100..1000",
    "family=Playfair+Display:wght@400..900",
    "family=Fraunces:opsz,wght@9..144,100..900",
    "family=DM+Serif+Display",
    "family=Instrument+Serif",
    "family=Archivo:wght@100..900",
    "family=Bricolage+Grotesque:opsz,wght@12..96,200..800",
    "family=Unbounded:wght@200..900",
    "family=JetBrains+Mono:wght@100..800",
  ].join("&") +
  "&display=swap";

// jsdelivr has reliable CORS headers; unpkg's redirect (react@19 → react@19.x)
// drops CORS on the redirect target, which blocks iframe script loading.
// Pin exact versions so there's no redirect to begin with.
const REACT_CDN = "https://cdn.jsdelivr.net/npm/react@19.2.5/umd/react.production.min.js";
const REACT_DOM_CDN = "https://cdn.jsdelivr.net/npm/react-dom@19.2.5/umd/react-dom.production.min.js";
const BABEL_CDN = "https://cdn.jsdelivr.net/npm/@babel/standalone@7.25.9/babel.min.js";
const TAILWIND_CDN = "https://cdn.tailwindcss.com";

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1440;

function buildSrcDoc(tsxCode: string): string {
  // Inline the TSX as a JS string literal so the iframe's Babel can compile it.
  // Backticks escaped so the template literal stays intact.
  const safeCode = tsxCode
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${FONTS_HREF}" rel="stylesheet" />
<script src="${REACT_CDN}"></script>
<script src="${REACT_DOM_CDN}"></script>
<script src="${BABEL_CDN}"></script>
<script src="${TAILWIND_CDN}"></script>
<style>
  html, body { margin: 0; padding: 0; background: #fafafa; overflow: hidden; }
  #root { display: flex; align-items: flex-start; justify-content: center; }
  .__error {
    margin: 24px; padding: 20px; border-radius: 12px;
    background: #FEF2F2; border: 1px solid #FECACA;
    color: #991B1B; font: 13px/1.5 ui-monospace, SFMono-Regular, monospace;
    white-space: pre-wrap; word-break: break-word;
  }
</style>
</head>
<body>
<div id="root"></div>
<script>
(function(){
  function boot(){
    try {
      if (!window.Babel || !window.React || !window.ReactDOM) {
        setTimeout(boot, 50);
        return;
      }
      var src = \`${safeCode}\n\nreturn Carousel;\`;
      var out = window.Babel.transform(src, { presets: ['react'] }).code;
      var factory = new Function('React', out);
      var Carousel = factory(window.React);
      var root = window.ReactDOM.createRoot(document.getElementById('root'));
      root.render(window.React.createElement(Carousel));
      window.parent.postMessage({ type: 'carousel-ready' }, '*');
    } catch (err) {
      var pre = document.createElement('pre');
      pre.className = '__error';
      pre.textContent = String(err && err.stack ? err.stack : err);
      document.body.innerHTML = '';
      document.body.appendChild(pre);
      window.parent.postMessage({
        type: 'carousel-error',
        message: String(err && err.message ? err.message : err)
      }, '*');
    }
  }
  boot();
})();
</script>
</body>
</html>`;
}

interface Props {
  tsxCode: string;
  /** Used for filenames on PNG export. */
  topic?: string;
}

export function CarouselReactPreview({ tsxCode, topic }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [slideCount, setSlideCount] = useState<number>(0);
  const [exporting, setExporting] = useState<false | number>(false);
  const [scale, setScale] = useState<number>(0.5);

  // Re-compute scale whenever the container size changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      // Always keep some vertical padding so the full slide is visible
      const h = Math.max(320, el.clientHeight || 720);
      const s = Math.min(w / SLIDE_WIDTH, h / SLIDE_HEIGHT);
      setScale(Math.max(0.15, Math.min(1, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Listen for ready/error postMessages from the iframe
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== "object") return;
      if (ev.data.type === "carousel-ready") {
        setStatus("ready");
        setErrorMsg(null);
        // Count slides once rendered
        const doc = iframeRef.current?.contentDocument;
        const slides = doc?.querySelectorAll("section.slide") || [];
        setSlideCount(slides.length);
      } else if (ev.data.type === "carousel-error") {
        setStatus("error");
        setErrorMsg(String(ev.data.message || "Unknown error"));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Reset status when the code changes
  const srcDoc = useMemo(() => {
    setStatus("loading");
    setErrorMsg(null);
    setSlideCount(0);
    return buildSrcDoc(tsxCode);
  }, [tsxCode]);

  const safeFilename = (base: string, idx: number) => {
    const slug = (base || "carousel")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "carousel";
    return `${slug}-${String(idx + 1).padStart(2, "0")}.png`;
  };

  const scrollSlideIntoView = (idx: number) => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const slide = doc.querySelectorAll<HTMLElement>("section.slide")[idx];
    if (slide && typeof slide.scrollIntoView === "function") {
      slide.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  };

  const exportAll = async () => {
    if (status !== "ready") return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const slides = Array.from(doc.querySelectorAll<HTMLElement>("section.slide"));
    if (slides.length === 0) {
      setErrorMsg("Keine Slides mit className='slide' gefunden — kann nicht exportieren");
      return;
    }

    // Lazy-load html-to-image only when needed — ~40kb
    const { toPng } = await import("html-to-image");

    for (let i = 0; i < slides.length; i++) {
      setExporting(i);
      try {
        // Render at native 1080×1440 regardless of the on-screen scale.
        const dataUrl = await toPng(slides[i], {
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          pixelRatio: 2,
          cacheBust: true,
          style: {
            transform: "none",
            transformOrigin: "top left",
          },
          // Required so the font faces from the iframe's stylesheet load
          // into the html-to-image virtual document.
          fontEmbedCSS: undefined,
        });
        const link = doc.defaultView?.document.createElement("a") ?? document.createElement("a");
        link.href = dataUrl;
        link.download = safeFilename(topic || "carousel", i);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise((r) => setTimeout(r, 150));
      } catch (err) {
        console.error("[carousel-react-preview] export failed for slide", i, err);
        setErrorMsg(`Export fehlgeschlagen bei Slide ${i + 1}: ${(err as Error).message}`);
        break;
      }
    }
    setExporting(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ocean/[0.06] bg-white/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-sm">
          {status === "loading" && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-blush" />
              <span className="text-ocean/70">Rendere Preview…</span>
            </>
          )}
          {status === "ready" && (
            <>
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-ocean/70">
                {slideCount} {slideCount === 1 ? "Slide" : "Slides"} bereit
              </span>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">Fehler beim Rendern</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {status === "ready" && slideCount > 1 && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-ocean/50">
              <ChevronLeft className="h-3 w-3" />
              <span>Scroll im iFrame</span>
              <ChevronRight className="h-3 w-3" />
            </div>
          )}
          <Button
            onClick={exportAll}
            disabled={status !== "ready" || exporting !== false}
            size="sm"
            className="gap-1.5 bg-blush hover:bg-blush-dark text-white"
          >
            {exporting !== false ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Slide {exporting + 1}…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Alle als PNG
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ── Error message ───────────────────────────────────────── */}
      {errorMsg && (
        <div className="px-4 py-2 text-xs font-mono text-red-700 bg-red-50 border-b border-red-200 whitespace-pre-wrap break-all">
          {errorMsg}
        </div>
      )}

      {/* ── Preview stage ───────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gradient-to-br from-ocean/[0.02] to-blush-light/20 flex items-center justify-center p-4"
      >
        <div
          style={{
            width: SLIDE_WIDTH * scale,
            height: SLIDE_HEIGHT * scale,
            position: "relative",
          }}
        >
          <iframe
            ref={iframeRef}
            title="Carousel preview"
            sandbox="allow-scripts allow-same-origin"
            srcDoc={srcDoc}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: SLIDE_WIDTH,
              height: SLIDE_HEIGHT,
              border: "none",
              borderRadius: 12,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              background: "white",
              boxShadow: "0 8px 40px rgba(32,35,69,0.08)",
            }}
          />
        </div>
      </div>

      {/* ── Slide nav dots ─────────────────────────────────────── */}
      {status === "ready" && slideCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-3 bg-white/60 border-t border-ocean/[0.06]">
          {Array.from({ length: slideCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollSlideIntoView(i)}
              className="h-2 w-2 rounded-full bg-ocean/20 hover:bg-blush transition-colors"
              aria-label={`Zu Slide ${i + 1} springen`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
