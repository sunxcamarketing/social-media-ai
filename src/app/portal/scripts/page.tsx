"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  ChevronDown,
  Copy,
  Check,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  X as XIcon,
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
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("scripts");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [feedbackDialog, setFeedbackDialog] = useState<{ script: Script; status: FeedbackStatus } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const [ideaDialogOpen, setIdeaDialogOpen] = useState(false);
  const [ideaEditing, setIdeaEditing] = useState<Idea | null>(null);
  const [ideaForm, setIdeaForm] = useState(emptyIdea);
  const [ideaSaving, setIdeaSaving] = useState(false);

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

  const approve = (script: Script) => {
    if (script.clientFeedbackStatus === "approved") return applyFeedback(script.id, null);
    return applyFeedback(script.id, "approved");
  };
  const openReject = (script: Script) => {
    setFeedbackText(script.clientFeedbackStatus === "rejected" ? script.clientFeedbackText || "" : "");
    setFeedbackDialog({ script, status: "rejected" });
  };
  const openRevision = (script: Script) => {
    setFeedbackText(script.clientFeedbackStatus === "revision_requested" ? script.clientFeedbackText || "" : "");
    setFeedbackDialog({ script, status: "revision_requested" });
  };

  const submitFeedback = async () => {
    if (!feedbackDialog) return;
    const text = feedbackText.trim();
    if (!text) return;
    setFeedbackSaving(true);
    const ok = await applyFeedback(feedbackDialog.script.id, feedbackDialog.status, text);
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

  const sortedIdeas = [...ideas].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const items = tab === "scripts" ? scripts : ideas;
  const isEmpty = items.length === 0;

  return (
    <PortalShell
      icon={FileText}
      title={t("portal.dash.scripts")}
      subtitle={tab === "scripts" ? t("portal.scripts.countScripts", { count: scripts.length }) : t("portal.scripts.countIdeas", { count: ideas.length })}
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

          {tab === "ideas" && (
            <Button onClick={openNewIdea} className="rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5 h-9">
              <Plus className="h-4 w-4" /> {t("portal.scripts.newIdea")}
            </Button>
          )}
        </div>
      }
    >
      {tab === "scripts" ? (
        <div className="space-y-3 stagger">
          {scripts.map((script) => {
            const isExpanded = expandedId === script.id;
            const fb = script.clientFeedbackStatus;
            return (
              <div key={script.id} className="glass rounded-2xl overflow-hidden card-hover">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : script.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-ocean break-words">{script.title || t("portal.scripts.untitled")}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {script.pillar && <Badge>{script.pillar}</Badge>}
                      {script.format && <Badge tone="blush">{script.format}</Badge>}
                      {script.createdAt && <span className="text-[10px] text-ocean/35">{script.createdAt.slice(0, 10)}</span>}
                      {fb && <FeedbackBadge status={fb} />}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-ocean/30 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-ocean/[0.06] pt-4 animate-fade">
                    {script.hook && <ScriptSection label={t("portal.scripts.hook")} text={script.hook} />}
                    {script.body && <ScriptSection label={t("portal.scripts.body")} text={script.body} />}
                    {script.cta && <ScriptSection label={t("portal.scripts.cta")} text={script.cta} />}

                    {fb && script.clientFeedbackText && (
                      <div className="rounded-xl border border-ocean/[0.06] bg-white/40 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-ocean/45 font-medium mb-1">Dein Feedback</p>
                        <p className="text-xs text-ocean/75 leading-relaxed whitespace-pre-wrap break-words">{script.clientFeedbackText}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <FeedbackButton
                        active={fb === "approved"}
                        onClick={() => approve(script)}
                        icon={ThumbsUp}
                        label={fb === "approved" ? "Gefällt mir ✓" : "Gefällt mir"}
                        tone="approve"
                      />
                      <FeedbackButton
                        active={fb === "rejected"}
                        onClick={() => openReject(script)}
                        icon={ThumbsDown}
                        label={fb === "rejected" ? "Abgelehnt ✓" : "Gefällt mir nicht"}
                        tone="reject"
                      />
                      <FeedbackButton
                        active={fb === "revision_requested"}
                        onClick={() => openRevision(script)}
                        icon={RotateCcw}
                        label={fb === "revision_requested" ? "Überarbeitung ✓" : "Verbesserungsvorschlag"}
                        tone="revise"
                      />
                      <button
                        onClick={() => copyScript(script)}
                        className="ml-auto flex items-center gap-1.5 text-xs text-ocean/50 hover:text-ocean transition-all rounded-lg px-2 py-1 hover:bg-ocean/[0.03]"
                      >
                        {copiedId === script.id ? (
                          <><Check className="h-3 w-3 text-green-500" /> {t("portal.scripts.copied")}</>
                        ) : (
                          <><Copy className="h-3 w-3" /> {t("portal.scripts.copy")}</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {scripts.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-sm text-ocean/50">{t("portal.scripts.empty")}</p>
            </div>
          )}
        </div>
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
                <div key={idea.id} className="group glass rounded-2xl p-5 space-y-3 card-hover">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-xl bg-blush-light/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Lightbulb className="h-4 w-4 text-blush-dark" />
                      </div>
                      <p className="text-sm font-semibold text-ocean leading-snug break-words">{idea.title}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditIdea(idea)}
                        title="Bearbeiten"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/60 hover:text-ocean hover:bg-ocean/[0.04]"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => deleteIdea(idea.id)}
                        title="Löschen"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/60 hover:text-red-500 hover:bg-red-50"
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

function ScriptSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ocean/40 mb-1.5 font-medium">{label}</p>
      <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}
