"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Script } from "@/lib/types";

// Admin script reader — same mobile-friendly layout as the portal detail
// page so what Aysun reviews on her phone is the exact thing the client
// will see. Admin-specific actions (full edit, delete) live in the top
// bar instead of the portal's feedback dock.

export default function AdminScriptDetailPage() {
  const router = useRouter();
  const { id: clientId, scriptId } = useParams<{ id: string; scriptId: string }>();

  const [script, setScript] = useState<Script | null>(null);
  const [allScripts, setAllScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!clientId || !scriptId) return;
    setLoading(true);
    fetch(`/api/scripts?clientId=${clientId}`)
      .then((r) => r.json())
      .then((rows: Script[]) => {
        const list = Array.isArray(rows) ? rows : [];
        setAllScripts(list);
        setScript(list.find((s) => s.id === scriptId) || null);
      })
      .finally(() => setLoading(false));
  }, [clientId, scriptId]);

  const { prevId, nextId, position } = useMemo(() => {
    if (!script || allScripts.length === 0) return { prevId: null, nextId: null, position: "" };
    const idx = allScripts.findIndex((s) => s.id === script.id);
    if (idx === -1) return { prevId: null, nextId: null, position: "" };
    return {
      prevId: idx > 0 ? allScripts[idx - 1].id : null,
      nextId: idx < allScripts.length - 1 ? allScripts[idx + 1].id : null,
      position: `${idx + 1} / ${allScripts.length}`,
    };
  }, [script, allScripts]);

  const goPrev = () => { if (prevId) router.push(`/clients/${clientId}/scripts/${prevId}`); };
  const goNext = () => { if (nextId) router.push(`/clients/${clientId}/scripts/${nextId}`); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft" && prevId) goPrev();
      if (e.key === "ArrowRight" && nextId) goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevId, nextId]);

  const fullText = useMemo(() => {
    if (!script) return "";
    return [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
  }, [script]);

  const copy = async () => {
    if (!script) return;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!script) return;
    if (!confirm("Skript löschen?")) return;
    const res = await fetch(`/api/scripts?id=${script.id}`, { method: "DELETE" });
    if (res.ok) router.push(`/clients/${clientId}/scripts`);
  };

  // Admin edit jumps back to the list with a query flag so the edit
  // dialog opens there. Keeps a single source of truth for the rich
  // edit form instead of duplicating it inline here.
  const openEditOnList = () => {
    if (!script) return;
    router.push(`/clients/${clientId}/scripts?edit=${script.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-white">
        <Loader2 className="h-5 w-5 animate-spin text-ocean/40" />
      </div>
    );
  }
  if (!script) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-warm-white p-6 text-center">
        <p className="text-sm text-ocean/60">Skript nicht gefunden.</p>
        <Button onClick={() => router.push(`/clients/${clientId}/scripts`)} className="mt-4 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Liste
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Sticky top bar — back · prev / pos / next · copy / edit / delete */}
      <div className="sticky top-0 z-20 bg-warm-white/95 backdrop-blur border-b border-ocean/[0.06]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
          <button
            onClick={() => router.push(`/clients/${clientId}/scripts`)}
            className="flex items-center gap-1.5 text-sm text-ocean/65 hover:text-ocean -ml-2 px-2 py-1 rounded-lg hover:bg-ocean/[0.04]"
          >
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Liste</span>
          </button>

          <div className="flex items-center gap-1 mx-auto">
            <button
              onClick={goPrev}
              disabled={!prevId}
              aria-label="Vorheriges Skript"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-ocean/65 hover:text-ocean hover:bg-ocean/[0.04] disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {position && (
              <span className="text-[11px] tabular-nums text-ocean/45 px-1 min-w-[42px] text-center">{position}</span>
            )}
            <button
              onClick={goNext}
              disabled={!nextId}
              aria-label="Nächstes Skript"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-ocean/65 hover:text-ocean hover:bg-ocean/[0.04] disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={copy}
              aria-label="Kopieren"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 text-ocean/65 hover:text-ocean hover:bg-ocean/[0.04]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copied ? "Kopiert" : "Kopieren"}</span>
            </button>
            <button
              onClick={openEditOnList}
              aria-label="Bearbeiten"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 text-ocean/65 hover:text-ocean hover:bg-ocean/[0.04]"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </button>
            <button
              onClick={handleDelete}
              aria-label="Löschen"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm rounded-lg px-2 py-1.5 text-ocean/55 hover:text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Reader body — identical to portal so admin sees what the client sees */}
      <article className="max-w-3xl mx-auto px-5 sm:px-6 py-8 pb-20">
        {/* Pillar / format chips */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {script.releasedAt ? (
            <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 font-medium">Freigegeben</span>
          ) : (
            <span className="text-[10px] text-ocean/55 bg-ocean/[0.04] border border-ocean/[0.08] rounded px-2 py-0.5 font-medium">Entwurf (intern)</span>
          )}
          {script.pillar && (
            <span className="text-[10px] text-blush-dark/70 bg-blush/15 border border-blush/25 rounded px-2 py-0.5 font-medium">
              {script.pillar}
            </span>
          )}
          {script.format && (
            <span className="text-[10px] text-ocean/55 bg-ocean/[0.04] border border-ocean/[0.06] rounded px-2 py-0.5">
              {script.format}
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold text-ocean leading-tight tracking-tight mb-8">
          {script.title || "Ohne Titel"}
        </h1>

        {/* Client feedback if any — show admin what the client said */}
        {script.clientFeedbackStatus && script.clientFeedbackText && (
          <div className={`rounded-xl border p-4 mb-6 ${
            script.clientFeedbackStatus === "approved"
              ? "border-green-200 bg-green-50/60"
              : script.clientFeedbackStatus === "rejected"
              ? "border-red-200 bg-red-50/60"
              : "border-amber-200 bg-amber-50/60"
          }`}>
            <p className={`text-[10px] uppercase tracking-wider font-medium mb-1 ${
              script.clientFeedbackStatus === "approved"
                ? "text-green-700/70"
                : script.clientFeedbackStatus === "rejected"
                ? "text-red-700/70"
                : "text-amber-700/70"
            }`}>
              Client-Feedback{script.clientFeedbackAt ? ` · ${new Date(script.clientFeedbackAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}` : ""}
            </p>
            <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap break-words">{script.clientFeedbackText}</p>
          </div>
        )}

        {/* Admin response (already given) */}
        {script.adminResponse && (
          <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 mb-8">
            <p className="text-[10px] uppercase tracking-wider text-green-700/70 font-medium mb-1">
              Deine Antwort{script.adminResponseAt ? ` · ${new Date(script.adminResponseAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}` : ""}
            </p>
            <p className="text-sm text-green-800/85 leading-relaxed whitespace-pre-wrap break-words">{script.adminResponse}</p>
          </div>
        )}

        {script.textHook && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Text on-Screen</p>
            <p className="text-base sm:text-lg font-semibold text-ocean leading-relaxed break-words">{script.textHook}</p>
          </div>
        )}
        {script.visualHook && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Visual Hook</p>
            <p className="text-base text-ocean/80 leading-relaxed break-words">{script.visualHook}</p>
          </div>
        )}
        {script.hook && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Hook</p>
            <p className="text-xl sm:text-2xl font-semibold text-ocean leading-snug break-words">{script.hook}</p>
          </div>
        )}
        {script.body && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Skript</p>
            <p className="text-lg sm:text-xl text-ocean/85 leading-[1.7] whitespace-pre-wrap break-words">{script.body}</p>
          </div>
        )}
        {script.cta && (
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-green-700/70 font-bold mb-1.5">CTA</p>
            <p className="text-lg sm:text-xl text-green-700/85 leading-relaxed italic break-words">{script.cta}</p>
          </div>
        )}
        {script.bRoll && (
          <div className="rounded-xl border border-ocean/[0.06] bg-white/60 p-4 mb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-2">Shot Liste</p>
            <p className="text-sm text-ocean/85 leading-relaxed whitespace-pre-wrap break-words">{script.bRoll}</p>
          </div>
        )}
        {script.caption && (
          <div className="rounded-xl border border-ocean/[0.06] bg-white/60 p-4 mb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-2">Videobeschreibung</p>
            <p className="text-sm text-ocean/85 leading-relaxed whitespace-pre-wrap break-words">{script.caption}</p>
          </div>
        )}
        {script.shotList && (
          <div className="rounded-xl border border-ocean/[0.06] bg-white/60 p-4 mb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-2">Schnitt &amp; Pacing</p>
            <p className="text-sm text-ocean/85 leading-relaxed whitespace-pre-wrap break-words">{script.shotList}</p>
          </div>
        )}
      </article>
    </div>
  );
}
