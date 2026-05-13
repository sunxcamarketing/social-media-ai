"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Copy,
  Check,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  Star,
  Archive,
} from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { PortalShell } from "@/components/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import type { Script, Idea } from "@/lib/types";
import { ScriptEditDialog, EMPTY_SCRIPT_FORM, scriptToForm, type ScriptEditForm } from "@/components/script-edit-dialog";

const CONTENT_TYPES = [
  "Face-to-camera",
  "Voiceover + B-Roll",
  "Storytelling",
  "Short-form video",
  "Carousel",
  "Screenshot post",
  "Blind reaction",
];

const emptyIdea = { title: "", description: "", contentType: "" };
type Tab = "scripts" | "ideas";
type FeedbackStatus = "approved" | "rejected" | "revision_requested";

export default function PortalScripts() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("scripts");
  const [archiveView, setArchiveView] = useState<"active" | "archive">("active");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [feedbackDialog, setFeedbackDialog] = useState<{ scriptId: string; status: FeedbackStatus } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [ideaEditing, setIdeaEditing] = useState<Idea | null>(null);
  const [ideaForm, setIdeaForm] = useState(emptyIdea);
  const [ideaSaving, setIdeaSaving] = useState(false);

  // Script edit. Variant-scoped: editing the Kurz post doesn't touch the Lang post.
  const [scriptEditing, setScriptEditing] = useState<Script | null>(null);
  const [scriptForm, setScriptForm] = useState<ScriptEditForm>(EMPTY_SCRIPT_FORM);
  const [scriptSaving, setScriptSaving] = useState(false);

  useEffect(() => {
    if (!effectiveClientId) return;
    Promise.all([
      fetch(`/api/scripts?clientId=${effectiveClientId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/ideas?clientId=${effectiveClientId}`).then((r) => r.json()).catch(() => []),
    ]).then(([s, i]) => {
      setScripts(Array.isArray(s) ? s : []);
      setIdeas(Array.isArray(i) ? i : []);
      setLoading(false);
    });
  }, [effectiveClientId]);

  const reloadIdeas = async () => {
    if (!effectiveClientId) return;
    const r = await fetch(`/api/ideas?clientId=${effectiveClientId}`).then((r) => r.json()).catch(() => []);
    setIdeas(Array.isArray(r) ? r : []);
  };

  const copyScript = (script: Script) => {
    const text = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedId(script.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Feedback actions ────────────────────────────────────────────────────
  const applyFeedback = async (scriptId: string, status: FeedbackStatus | null, text?: string) => {
    const body = status === null ? { status: null } : { status, text: text || "" };
    const res = await fetch(`/api/scripts/${scriptId}/feedback`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    setScripts((prev) =>
      prev.map((s) =>
        s.id === scriptId
          ? {
              ...s,
              clientFeedbackStatus: status,
              clientFeedbackText: status ? text || "" : null,
              clientFeedbackAt: status ? new Date().toISOString() : null,
            }
          : s,
      ),
    );
    return true;
  };

  const approveScript = (script: Script) => {
    if (script.clientFeedbackStatus === "approved") return applyFeedback(script.id, null);
    return applyFeedback(script.id, "approved");
  };
  const openRejectScript = (script: Script) => {
    setFeedbackText(script.clientFeedbackStatus === "rejected" ? script.clientFeedbackText || "" : "");
    setFeedbackDialog({ scriptId: script.id, status: "rejected" });
  };
  const openRevisionScript = (script: Script) => {
    setFeedbackText(script.clientFeedbackStatus === "revision_requested" ? script.clientFeedbackText || "" : "");
    setFeedbackDialog({ scriptId: script.id, status: "revision_requested" });
  };

  const submitFeedback = async () => {
    if (!feedbackDialog) return;
    const text = feedbackText.trim();
    if (!text) return;
    setFeedbackSaving(true);
    const ok = await applyFeedback(feedbackDialog.scriptId, feedbackDialog.status, text);
    setFeedbackSaving(false);
    if (ok) {
      setFeedbackDialog(null);
      setFeedbackText("");
    }
  };

  // ── Idea actions ────────────────────────────────────────────────────────
  const openNewIdea = () => {
    setIdeaEditing(null);
    setIdeaForm(emptyIdea);
    setIdeaDialogOpen(true);
  };
  const openEditIdea = (idea: Idea) => {
    setIdeaEditing(idea);
    setIdeaForm({ title: idea.title, description: idea.description, contentType: idea.contentType });
    setIdeaDialogOpen(true);
  };
  const saveIdea = async () => {
    if (!ideaForm.title || ideaSaving) return;
    setIdeaSaving(true);
    try {
      if (ideaEditing) {
        await fetch("/api/ideas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ideaEditing.id, ...ideaForm }),
        });
      } else {
        await fetch("/api/ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: effectiveClientId, ...ideaForm }),
        });
      }
      setIdeaDialogOpen(false);
      await reloadIdeas();
    } finally {
      setIdeaSaving(false);
    }
  };
  const deleteIdea = async (id: string) => {
    if (!confirm("Diese Idee wirklich löschen?")) return;
    await fetch(`/api/ideas?id=${id}`, { method: "DELETE" });
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  };

  // ── Script edit actions ─────────────────────────────────────────────────
  const openScriptEdit = (script: Script) => {
    setScriptEditing(script);
    setScriptForm(scriptToForm(script));
  };
  const saveScriptEdit = async () => {
    if (!scriptEditing || scriptSaving) return;
    setScriptSaving(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: scriptEditing.id,
          title: scriptForm.title,
          pillar: scriptForm.pillar,
          contentType: scriptForm.contentType,
          format: scriptForm.format,
          status: scriptForm.status,
          hook: scriptForm.hook,
          body: scriptForm.body,
          cta: scriptForm.cta,
          textHook: scriptForm.textHook,
          visualHook: scriptForm.visualHook,
          bRoll: scriptForm.bRoll,
          shotList: scriptForm.shotList,
          caption: scriptForm.caption,
        }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setScripts((prev) => prev.map((s) => (s.id === updated.id ? {
        ...s,
        title: updated.title,
        pillar: updated.pillar ?? s.pillar,
        contentType: updated.content_type ?? s.contentType,
        format: updated.format ?? s.format,
        status: updated.status ?? s.status,
        hook: updated.hook,
        body: updated.body,
        cta: updated.cta,
        textHook: updated.text_hook,
        visualHook: updated.visual_hook ?? s.visualHook,
        bRoll: updated.b_roll ?? s.bRoll,
        shotList: updated.shot_list ?? s.shotList,
        caption: updated.caption ?? s.caption,
        clientEditedAt: updated.client_edited_at,
      } : s)));
      setScriptEditing(null);
    } finally {
      setScriptSaving(false);
    }
  };

  // Starred first, then by createdAt desc within each group.
  const sortedIdeas = [...ideas].sort((a, b) => {
    const sa = a.starred ? 1 : 0;
    const sb = b.starred ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  const toggleStar = async (idea: Idea) => {
    const next = !idea.starred;
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, starred: next } : i)));
    const res = await fetch("/api/ideas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: idea.id, starred: next }),
    });
    if (!res.ok) {
      setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, starred: !next } : i)));
    }
  };

  // Mark a script as done (archived_at = NOW) or restore it (archived_at = NULL).
  // Optimistic — the row disappears from the active view instantly.
  const toggleArchive = async (script: Script, archive: boolean) => {
    const ts = archive ? new Date().toISOString() : null;
    setScripts((prev) => prev.map((s) => (s.id === script.id ? { ...s, archivedAt: ts } : s)));
    const res = await fetch(`/api/scripts/${script.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archive }),
    });
    if (!res.ok) {
      setScripts((prev) => prev.map((s) => (s.id === script.id ? { ...s, archivedAt: script.archivedAt ?? null } : s)));
    }
  };

  const visibleScripts = scripts.filter((s) => (archiveView === "archive" ? !!s.archivedAt : !s.archivedAt));
  const archiveCount = scripts.filter((s) => !!s.archivedAt).length;
  const items = tab === "scripts" ? visibleScripts : ideas;
  const isEmpty = items.length === 0;

  return (
    <PortalShell
      icon={FileText}
      title={t("portal.dash.scripts")}
      subtitle={tab === "scripts" ? t("portal.scripts.countScripts", { count: visibleScripts.length }) : t("portal.scripts.countIdeas", { count: ideas.length })}
      loading={authLoading || loading}
      isEmpty={isEmpty && tab === "scripts"}
      emptyMessage={t("portal.scripts.empty")}
      header={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1 w-fit">
            <button
              onClick={() => setTab("scripts")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                tab === "scripts" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
              }`}
            >
              <FileText className="h-3.5 w-3.5" /> {t("portal.scripts.tabScripts")}
            </button>
            <button
              onClick={() => setTab("ideas")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                tab === "ideas" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5" /> {t("portal.scripts.tabIdeas")}
            </button>
          </div>

          {tab === "scripts" && (
            <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1 w-fit">
              <button
                onClick={() => setArchiveView("active")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all ${
                  archiveView === "active" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
                }`}
              >
                {t("portal.scripts.viewActive")}
              </button>
              <button
                onClick={() => setArchiveView("archive")}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all inline-flex items-center gap-1.5 ${
                  archiveView === "archive" ? "bg-warm-white text-ocean" : "text-ocean/55 hover:text-ocean"
                }`}
              >
                <Archive className="h-3 w-3" /> {t("portal.scripts.viewArchive")}
                {archiveCount > 0 && <span className="text-[10px] text-ocean/45">({archiveCount})</span>}
              </button>
            </div>
          )}

          {tab === "ideas" && (
            <Button onClick={openNewIdea} className="rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5 h-9">
              <Plus className="h-4 w-4" /> {t("portal.scripts.newIdea")}
            </Button>
          )}
        </div>
      }
    >
      {tab === "scripts" ? (
        visibleScripts.length > 0 ? (
          <>
            {/* ── Mobile: card list ────────────────────────────────────── */}
            <div className="md:hidden space-y-2">
              {visibleScripts.map((script) => {
                const fb = (script.clientFeedbackStatus as FeedbackStatus | null) || null;
                const dateStr = script.createdAt
                  ? new Date(script.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
                  : "";
                const fbLabel = fb === "approved" ? "Gefällt mir" : fb === "rejected" ? "Abgelehnt" : fb === "revision_requested" ? "Verbessern" : null;
                const fbCls = fb === "approved" ? "bg-green-50 text-green-700 border-green-200"
                  : fb === "rejected" ? "bg-red-50 text-red-600 border-red-200"
                  : fb === "revision_requested" ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "";
                return (
                  <div key={script.id} className="relative">
                    <button
                      onClick={() => router.push(`/portal/scripts/${script.id}`)}
                      className="w-full text-left rounded-2xl border border-ocean/[0.06] bg-white/70 hover:bg-blush-light/20 active:bg-blush-light/30 transition-colors p-4 pr-12 space-y-2.5"
                    >
                      <p className="text-base font-semibold text-ocean leading-snug break-words">
                        {script.title || t("portal.scripts.untitled")}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {script.format && (
                          <span className="text-[10px] text-ocean/65 rounded bg-blush-light/40 border border-blush/30 px-2 py-0.5 font-medium">{script.format}</span>
                        )}
                        {script.pillar && (
                          <span className="text-[10px] text-blush-dark/70 rounded bg-blush/15 border border-blush/25 px-2 py-0.5">{script.pillar}</span>
                        )}
                        {fbLabel && (
                          <span className={`text-[10px] border rounded px-2 py-0.5 font-medium ml-auto ${fbCls}`}>{fbLabel}</span>
                        )}
                      </div>
                      {script.hook && (
                        <p className="text-[13px] text-ocean/70 leading-relaxed line-clamp-2 break-words">{script.hook}</p>
                      )}
                      <p className="text-[10px] text-ocean/40">{dateStr}</p>
                    </button>
                    <label
                      className="absolute top-3 right-3 inline-flex items-center justify-center h-8 w-8 rounded-lg cursor-pointer"
                      title={script.archivedAt ? t("portal.scripts.restore") : t("portal.scripts.markDone")}
                    >
                      <input
                        type="checkbox"
                        checked={!!script.archivedAt}
                        onChange={() => toggleArchive(script, !script.archivedAt)}
                        className="h-5 w-5 rounded border-ocean/30 text-green-600 accent-green-600 cursor-pointer"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: existing table ──────────────────────────────── */}
            <div className="hidden md:block rounded-xl border border-ocean/[0.06] overflow-hidden bg-white/50">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-ocean/[0.08] bg-ocean/[0.02]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[260px]">Titel</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50">Skript</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[140px]">Mein Feedback</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[80px]">Erledigt</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[110px]">Datum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ocean/[0.05]">
                  {visibleScripts.map((script) => {
                    const fb = (script.clientFeedbackStatus as FeedbackStatus | null) || null;
                    const dateStr = script.createdAt
                      ? new Date(script.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
                      : "—";

                    return (
                      <Fragment key={script.id}>
                        <tr
                          onClick={() => router.push(`/portal/scripts/${script.id}`)}
                          className="hover:bg-ocean/[0.01] transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-1.5">
                              <p className="text-sm font-medium text-ocean/90 leading-snug break-words">{script.title || t("portal.scripts.untitled")}</p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {script.pillar && (
                                  <span className="text-[9px] text-blush-dark/70 rounded bg-blush/15 border border-blush/25 px-1.5 py-0.5 font-medium">{script.pillar}</span>
                                )}
                                {script.format && (
                                  <span className="text-[9px] text-ocean/50 rounded bg-ocean/[0.04] border border-ocean/[0.06] px-1.5 py-0.5">{script.format}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <PortalScriptCell script={script} copiedId={copiedId} onCopy={copyScript} onEdit={openScriptEdit} />
                          <td className="px-4 py-4 align-top">
                            <FeedbackPicker
                              status={fb}
                              onApprove={() => approveScript(script)}
                              onReject={() => openRejectScript(script)}
                              onRevise={() => openRevisionScript(script)}
                              onClear={() => applyFeedback(script.id, null)}
                            />
                          </td>
                          <td className="px-4 py-4 align-top text-center">
                            <label
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center cursor-pointer"
                              title={script.archivedAt ? t("portal.scripts.restore") : t("portal.scripts.markDone")}
                            >
                              <input
                                type="checkbox"
                                checked={!!script.archivedAt}
                                onChange={() => toggleArchive(script, !script.archivedAt)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 rounded border-ocean/30 text-green-600 accent-green-600 cursor-pointer"
                              />
                            </label>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className="text-xs text-ocean/45 whitespace-nowrap">{dateStr}</span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-sm text-ocean/50">
              {archiveView === "archive" ? t("portal.scripts.viewArchive") + " — leer" : t("portal.scripts.empty")}
            </p>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {sortedIdeas.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Lightbulb className="mx-auto h-8 w-8 text-ocean/30 mb-2" />
              <p className="text-sm text-ocean/50">{t("portal.scripts.emptyIdeas")}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
              {sortedIdeas.map((idea) => (
                <div key={idea.id} className={`group glass rounded-2xl p-5 space-y-3 card-hover ${idea.starred ? "ring-1 ring-amber-300/50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-xl bg-blush-light/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Lightbulb className="h-4 w-4 text-blush-dark" />
                      </div>
                      <p className="text-sm font-semibold text-ocean leading-snug break-words">{idea.title}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 items-start">
                      <button
                        onClick={() => toggleStar(idea)}
                        title={idea.starred ? (lang === "en" ? "Remove favorite" : "Favorit entfernen") : (lang === "en" ? "Mark as favorite (top priority)" : "Als Favorit markieren (oberste Priorität)")}
                        aria-label={idea.starred ? "Unstar idea" : "Star idea"}
                        className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${
                          idea.starred
                            ? "text-amber-500 hover:bg-amber-50"
                            : "text-ocean/40 hover:text-amber-500 hover:bg-amber-50"
                        }`}
                      >
                        <Star className={`h-4 w-4 ${idea.starred ? "fill-amber-500" : ""}`} />
                      </button>
                      <button
                        onClick={() => openEditIdea(idea)}
                        title="Bearbeiten"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/60 hover:text-ocean hover:bg-ocean/[0.04] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => deleteIdea(idea.id)}
                        title="Löschen"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/60 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  {idea.description && (
                    <p className="text-xs text-ocean/60 leading-relaxed line-clamp-4 break-words">{idea.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {idea.contentType && (
                      <span className="rounded-md text-[10px] px-2 py-0.5 bg-ocean/[0.04] text-ocean/55 border border-ocean/[0.06]">
                        {idea.contentType}
                      </span>
                    )}
                    {idea.createdAt && (
                      <span className="text-[10px] text-ocean/40 ml-auto">{idea.createdAt}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Feedback Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!feedbackDialog} onOpenChange={(open) => { if (!open) { setFeedbackDialog(null); setFeedbackText(""); } }}>
        <DialogContent className="max-w-md glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>
              {feedbackDialog?.status === "rejected"
                ? t("portal.scripts.feedbackTitle")
                : t("portal.scripts.feedbackTitleImprove")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-ocean/60 leading-relaxed">
              {feedbackDialog?.status === "rejected"
                ? t("portal.scripts.feedbackBody")
                : t("portal.scripts.feedbackBodyImprove")}
            </p>
            <Textarea
              autoFocus
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
              placeholder={feedbackDialog?.status === "rejected" ? t("portal.scripts.feedbackPlaceholderReject") : t("portal.scripts.feedbackPlaceholderImprove")}
              className="rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => { setFeedbackDialog(null); setFeedbackText(""); }}
                className="rounded-xl"
              >
                {t("portal.scripts.cancel")}
              </Button>
              <Button
                onClick={submitFeedback}
                disabled={!feedbackText.trim() || feedbackSaving}
                className="rounded-xl bg-ocean hover:bg-ocean-light border-0"
              >
                {feedbackSaving ? t("portal.scripts.saving") : t("portal.scripts.submitFeedback")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Idea Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={ideaDialogOpen} onOpenChange={setIdeaDialogOpen}>
        <DialogContent className="max-w-lg glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>{ideaEditing ? t("portal.scripts.editIdea") : t("portal.scripts.newIdea")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-ocean/60">{t("portal.scripts.ideaTitle")}</Label>
              <Input
                autoFocus
                value={ideaForm.title}
                onChange={(e) => setIdeaForm({ ...ideaForm, title: e.target.value })}
                placeholder={t("portal.scripts.ideaTitlePlaceholder")}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">{t("portal.scripts.ideaDescription")}</Label>
              <Textarea
                value={ideaForm.description}
                onChange={(e) => setIdeaForm({ ...ideaForm, description: e.target.value })}
                rows={4}
                placeholder={t("portal.scripts.ideaDescriptionPlaceholder")}
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">{t("portal.scripts.ideaContentType")}</Label>
              <Select value={ideaForm.contentType} onValueChange={(v) => setIdeaForm({ ...ideaForm, contentType: v })}>
                <SelectTrigger className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11">
                  <SelectValue placeholder={t("portal.scripts.ideaSelectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setIdeaDialogOpen(false)} className="rounded-xl">
                {t("portal.scripts.cancel")}
              </Button>
              <Button
                onClick={saveIdea}
                disabled={!ideaForm.title || ideaSaving}
                className="rounded-xl bg-ocean hover:bg-ocean-light border-0"
              >
                {ideaSaving ? t("portal.scripts.saving") : ideaEditing ? t("portal.scripts.save") : t("portal.scripts.create")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScriptEditDialog
        open={!!scriptEditing}
        onOpenChange={(open) => { if (!open) setScriptEditing(null); }}
        form={scriptForm}
        onFormChange={setScriptForm}
        mode="edit"
        saving={scriptSaving}
        onSave={saveScriptEdit}
      />
    </PortalShell>
  );
}

// ── UI helpers ──────────────────────────────────────────────────────────────

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blush" }) {
  const cls = tone === "blush" ? "bg-blush-light/50 text-ocean/60" : "bg-ocean/[0.04] text-ocean/60";
  return <span className={`text-[10px] ${cls} px-2 py-0.5 rounded-md font-medium`}>{children}</span>;
}

function FeedbackBadge({ status }: { status: FeedbackStatus }) {
  const map = {
    approved: { label: "Gefällt mir", cls: "bg-green-50 text-green-700 border-green-200" },
    rejected: { label: "Abgelehnt", cls: "bg-red-50 text-red-600 border-red-200" },
    revision_requested: { label: "Verbesserung gewünscht", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  } as const;
  const { label, cls } = map[status];
  return <span className={`text-[10px] ${cls} border px-2 py-0.5 rounded-md font-medium`}>{label}</span>;
}

// Inline feedback picker for the table column. Replaces the row of buttons
// in the expanded section — keeps everything in one click without scrolling
// and lets the client see + change feedback without expanding.
function FeedbackPicker({
  status,
  onApprove,
  onReject,
  onRevise,
  onClear,
}: {
  status: FeedbackStatus | null;
  onApprove: () => void;
  onReject: () => void;
  onRevise: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Stop the row's onClick (which toggles expanded) from firing.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="relative inline-block" ref={ref} onClick={stop}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="cursor-pointer"
      >
        {status ? <FeedbackBadge status={status} /> : <span className="text-xs text-ocean/40 hover:text-ocean transition-colors">— offen ▾</span>}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 min-w-[210px] rounded-lg border border-ocean/[0.08] bg-white shadow-[0_8px_24px_rgba(32,35,69,0.10)] py-1">
          <button
            onClick={() => { setOpen(false); onApprove(); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 hover:text-green-700 transition-colors flex items-center gap-2"
          >
            <ThumbsUp className="h-3.5 w-3.5 text-green-600" />
            <span className="font-medium">Gefällt mir</span>
          </button>
          <button
            onClick={() => { setOpen(false); onReject(); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-2"
          >
            <ThumbsDown className="h-3.5 w-3.5 text-red-500" />
            <span className="font-medium">Gefällt mir nicht</span>
          </button>
          <button
            onClick={() => { setOpen(false); onRevise(); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-medium">Verbesserungsvorschlag</span>
          </button>
          {status && (
            <>
              <div className="border-t border-ocean/[0.06] my-1" />
              <button
                onClick={() => { setOpen(false); onClear(); }}
                className="w-full text-left px-3 py-2 text-[10px] text-ocean/50 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
              >
                Feedback zurücknehmen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}


function FeedbackButton({
  active, onClick, icon: Icon, label, tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "approve" | "reject" | "revise";
}) {
  const tones = {
    approve: active
      ? "bg-green-500 text-white border-green-500"
      : "text-ocean/65 border-ocean/[0.08] hover:bg-green-50 hover:text-green-700 hover:border-green-200",
    reject: active
      ? "bg-red-500 text-white border-red-500"
      : "text-ocean/65 border-ocean/[0.08] hover:bg-red-50 hover:text-red-600 hover:border-red-200",
    revise: active
      ? "bg-amber-500 text-white border-amber-500"
      : "text-ocean/65 border-ocean/[0.08] hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200",
  } as const;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${tones[tone]}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// Per-script production details: hook variants, b-roll, shot list, caption.
// Renders only the fields that have content — no empty rows.
function ScriptDetailFields({ script }: { script?: Script }) {
  if (!script) return null;

  const items: Array<{ label: string; text: string }> = [];
  if (script.format) items.push({ label: "Format", text: script.format });
  if (script.textHook) items.push({ label: "Text-Hook (On-Screen)", text: script.textHook });
  if (script.visualHook) items.push({ label: "Visual-Hook", text: script.visualHook });
  if (script.hook) items.push({ label: "Audio-Hook (gesprochen)", text: script.hook });
  if (script.bRoll) items.push({ label: "B-Roll", text: script.bRoll });
  if (script.shotList) items.push({ label: "Shot-List / Filmanweisungen", text: script.shotList });
  if (script.caption) items.push({ label: "Videobeschreibung (Caption)", text: script.caption });

  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-ocean/[0.06] bg-white/60 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-[10px] uppercase tracking-wider text-ocean/40 mb-1.5 font-medium">{it.label}</p>
          <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap break-words">{it.text}</p>
        </div>
      ))}
    </div>
  );
}


function ScriptSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ocean/40 mb-1.5 font-medium">{label}</p>
      <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}

function PortalScriptCell({
  script,
  copiedId,
  onCopy,
  onEdit,
}: {
  script?: Script;
  copiedId: string | null;
  onCopy: (s: Script) => void;
  onEdit?: (s: Script) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!script) {
    return <td className="px-4 py-4 align-top text-xs text-ocean/25 italic">—</td>;
  }

  const isLong = (script.body || "").length > 200;

  return (
    <td className="px-4 py-4 align-top">
      <div
        className="space-y-2 max-w-md"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
      >
        {script.hook && (
          <p className="text-[13px] text-ocean/90 leading-relaxed font-semibold break-words">{script.hook}</p>
        )}
        {script.body && (
          <p className={`text-[13px] text-ocean/65 leading-relaxed whitespace-pre-wrap break-words ${!expanded && isLong ? "line-clamp-4" : ""}`}>
            {script.body}
          </p>
        )}
        {script.cta && (
          <p className="text-[13px] text-green-700/70 leading-relaxed italic break-words">{script.cta}</p>
        )}
        {isLong && !expanded && (
          <span className="text-[11px] text-blush-dark/60 hover:text-blush-dark cursor-pointer">... mehr anzeigen</span>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy(script);
            }}
            className="inline-flex items-center gap-1 text-[10px] text-ocean/40 hover:text-ocean transition-colors"
          >
            {copiedId === script.id ? <><Check className="h-2.5 w-2.5 text-green-600" /> Kopiert</> : <><Copy className="h-2.5 w-2.5" /> Kopieren</>}
          </button>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(script);
              }}
              className="inline-flex items-center gap-1 text-[10px] text-ocean/40 hover:text-ocean transition-colors"
            >
              <Pencil className="h-2.5 w-2.5" /> Bearbeiten
            </button>
          )}
        </div>
      </div>
    </td>
  );
}
