"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Pencil,
  Loader2,
} from "lucide-react";
import { usePortalClient } from "../../use-portal-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import type { Script } from "@/lib/types";

type FeedbackStatus = "approved" | "rejected" | "revision_requested";

export default function PortalScriptDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { id: scriptId } = useParams<{ id: string }>();
  const { effectiveClientId, loading: authLoading } = usePortalClient();

  const [script, setScript] = useState<Script | null>(null);
  const [allScripts, setAllScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Feedback dialog
  const [feedbackOpen, setFeedbackOpen] = useState<FeedbackStatus | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", textHook: "", hook: "", body: "", cta: "" });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!effectiveClientId || !scriptId) return;
    setLoading(true);
    fetch(`/api/scripts?clientId=${effectiveClientId}`)
      .then((r) => r.json())
      .then((rows: Script[]) => {
        const list = Array.isArray(rows) ? rows : [];
        setAllScripts(list);
        setScript(list.find((s) => s.id === scriptId) || null);
      })
      .finally(() => setLoading(false));
  }, [effectiveClientId, scriptId]);

  // Prev/next navigation across the client's full list — keeps the user
  // in the reader instead of forcing them back to the list every time.
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

  const goPrev = () => { if (prevId) router.push(`/portal/scripts/${prevId}`); };
  const goNext = () => { if (nextId) router.push(`/portal/scripts/${nextId}`); };

  // Keyboard arrows for desktop power-users
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

  // ── Feedback ──────────────────────────────────────────────────────────
  const applyFeedback = async (status: FeedbackStatus | null, text?: string) => {
    if (!script) return false;
    const body = status === null ? { status: null } : { status, text: text || "" };
    const res = await fetch(`/api/scripts/${script.id}/feedback`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    setScript({
      ...script,
      clientFeedbackStatus: status,
      clientFeedbackText: status ? text || "" : null,
      clientFeedbackAt: status ? new Date().toISOString() : null,
    });
    return true;
  };

  const onApprove = () =>
    script?.clientFeedbackStatus === "approved" ? applyFeedback(null) : applyFeedback("approved");
  const openReject = () => {
    setFeedbackText(script?.clientFeedbackStatus === "rejected" ? script.clientFeedbackText || "" : "");
    setFeedbackOpen("rejected");
  };
  const openRevise = () => {
    setFeedbackText(script?.clientFeedbackStatus === "revision_requested" ? script.clientFeedbackText || "" : "");
    setFeedbackOpen("revision_requested");
  };
  const submitFeedback = async () => {
    if (!feedbackOpen) return;
    if (!feedbackText.trim()) return;
    setFeedbackSaving(true);
    const ok = await applyFeedback(feedbackOpen, feedbackText.trim());
    setFeedbackSaving(false);
    if (ok) { setFeedbackOpen(null); setFeedbackText(""); }
  };

  // ── Edit ──────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!script) return;
    setEditForm({
      title: script.title || "",
      textHook: script.textHook || "",
      hook: script.hook || "",
      body: script.body || "",
      cta: script.cta || "",
    });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    if (!script || editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: script.id, ...editForm }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setScript({
        ...script,
        title: updated.title,
        textHook: updated.text_hook,
        hook: updated.hook,
        body: updated.body,
        cta: updated.cta,
        clientEditedAt: updated.client_edited_at,
      });
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  };

  if (authLoading || loading) {
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
        <Button onClick={() => router.push("/portal/scripts")} className="mt-4 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Zurück zur Liste
        </Button>
      </div>
    );
  }

  const fb = script.clientFeedbackStatus;

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Sticky top bar — back · prev / pos / next · copy / edit */}
      <div className="sticky top-0 z-20 bg-warm-white/95 backdrop-blur border-b border-ocean/[0.06]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
          <button
            onClick={() => router.push("/portal/scripts")}
            className="flex items-center gap-1.5 text-sm text-ocean/65 hover:text-ocean -ml-2 px-2 py-1 rounded-lg hover:bg-ocean/[0.04]"
          >
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">{t("portal.scripts.backToList") || "Liste"}</span>
          </button>

          {/* Prev / position / next — center group */}
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
              onClick={openEdit}
              aria-label="Bearbeiten"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 text-ocean/65 hover:text-ocean hover:bg-ocean/[0.04]"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bearbeiten</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reader body — large, mobile-friendly */}
      <article className="max-w-3xl mx-auto px-5 sm:px-6 py-8 pb-32">
        {/* Pillar / format chips */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
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

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-semibold text-ocean leading-tight tracking-tight mb-8">
          {script.title || "Ohne Titel"}
        </h1>

        {/* Admin response — show first if set so the client sees the latest update */}
        {script.adminResponse && (
          <div className="rounded-xl border border-green-200 bg-green-50/60 p-4 mb-8">
            <p className="text-[10px] uppercase tracking-wider text-green-700/70 font-medium mb-1">
              Antwort{script.adminResponseAt ? ` · ${new Date(script.adminResponseAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}` : ""}
            </p>
            <p className="text-sm text-green-800/85 leading-relaxed whitespace-pre-wrap break-words">{script.adminResponse}</p>
          </div>
        )}

        {/* Text-Hook (on-screen) — small + bold so it stands out */}
        {script.textHook && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Text on-Screen</p>
            <p className="text-base sm:text-lg font-semibold text-ocean leading-relaxed break-words">{script.textHook}</p>
          </div>
        )}

        {/* Visual hook */}
        {script.visualHook && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Visual Hook</p>
            <p className="text-base text-ocean/80 leading-relaxed break-words">{script.visualHook}</p>
          </div>
        )}

        {/* Audio hook — first spoken line, biggest emphasis */}
        {script.hook && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Hook</p>
            <p className="text-xl sm:text-2xl font-semibold text-ocean leading-snug break-words">{script.hook}</p>
          </div>
        )}

        {/* Body */}
        {script.body && (
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-1.5">Skript</p>
            <p className="text-lg sm:text-xl text-ocean/85 leading-[1.7] whitespace-pre-wrap break-words">{script.body}</p>
          </div>
        )}

        {/* CTA — green, italic, like in the list */}
        {script.cta && (
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-green-700/70 font-bold mb-1.5">CTA</p>
            <p className="text-lg sm:text-xl text-green-700/85 leading-relaxed italic break-words">{script.cta}</p>
          </div>
        )}

        {/* Production extras — Shot Liste etc. */}
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

        {/* Feedback already given (read-only summary) */}
        {fb && script.clientFeedbackText && (
          <div className="rounded-xl border border-ocean/[0.06] bg-ocean/[0.02] p-4 mt-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-ocean/45 font-bold mb-2">Dein Feedback</p>
            <p className="text-sm text-ocean/75 leading-relaxed whitespace-pre-wrap break-words">{script.clientFeedbackText}</p>
          </div>
        )}
      </article>

      {/* Sticky feedback dock at bottom — always reachable while filming */}
      <div className="fixed bottom-0 inset-x-0 bg-warm-white/95 backdrop-blur border-t border-ocean/[0.06] z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <FeedbackButton
            active={fb === "approved"}
            tone="approve"
            label="Gefällt mir"
            icon={ThumbsUp}
            onClick={onApprove}
          />
          <FeedbackButton
            active={fb === "revision_requested"}
            tone="revise"
            label="Verbessern"
            icon={RotateCcw}
            onClick={openRevise}
          />
          <FeedbackButton
            active={fb === "rejected"}
            tone="reject"
            label="Ablehnen"
            icon={ThumbsDown}
            onClick={openReject}
          />
        </div>
      </div>

      {/* ── Feedback Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!feedbackOpen} onOpenChange={(v) => { if (!v) { setFeedbackOpen(null); setFeedbackText(""); } }}>
        <DialogContent className="max-w-md glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>
              {feedbackOpen === "rejected" ? "Was passt nicht?" : "Was verbessern?"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              autoFocus
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
              placeholder="Kurze Notiz für Aysun…"
              className="rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setFeedbackOpen(null); setFeedbackText(""); }} className="rounded-xl">
                Abbrechen
              </Button>
              <Button
                onClick={submitFeedback}
                disabled={!feedbackText.trim() || feedbackSaving}
                className="rounded-xl bg-ocean hover:bg-ocean-light border-0"
              >
                {feedbackSaving ? "Speichere…" : "Senden"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) setEditOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>Skript anpassen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-ocean/60">Titel</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Text on-Screen</Label>
              <Input
                value={editForm.textHook}
                onChange={(e) => setEditForm({ ...editForm, textHook: e.target.value })}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Hook</Label>
              <Textarea
                value={editForm.hook}
                onChange={(e) => setEditForm({ ...editForm, hook: e.target.value })}
                rows={2}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Skript</Label>
              <Textarea
                value={editForm.body}
                onChange={(e) => setEditForm({ ...editForm, body: e.target.value })}
                rows={10}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">CTA</Label>
              <Textarea
                value={editForm.cta}
                onChange={(e) => setEditForm({ ...editForm, cta: e.target.value })}
                rows={2}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
              />
            </div>
            <div className="flex items-center gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setEditOpen(false)} className="rounded-xl">
                Abbrechen
              </Button>
              <Button
                onClick={saveEdit}
                disabled={editSaving}
                className="rounded-xl bg-ocean hover:bg-ocean-light border-0"
              >
                {editSaving ? "Speichere…" : "Speichern"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeedbackButton({
  active, tone, label, icon: Icon, onClick,
}: {
  active: boolean;
  tone: "approve" | "reject" | "revise";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  const cls = active
    ? tone === "approve"
      ? "bg-green-500 text-white border-green-500"
      : tone === "reject"
      ? "bg-red-500 text-white border-red-500"
      : "bg-amber-500 text-white border-amber-500"
    : tone === "approve"
    ? "text-ocean/65 border-ocean/[0.08] hover:bg-green-50 hover:text-green-700 hover:border-green-200"
    : tone === "reject"
    ? "text-ocean/65 border-ocean/[0.08] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
    : "text-ocean/65 border-ocean/[0.08] hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200";
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border text-sm font-medium transition-colors ${cls}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
