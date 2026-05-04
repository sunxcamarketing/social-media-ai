"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  Copy,
  Check,
  Lightbulb,
  Pencil,
  Trash2,
  Plus,
  Send,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Wrench,
  ExternalLink,
  Loader2,
} from "lucide-react";
import type { Script, Config } from "@/lib/types";
import { useClientData } from "@/context/client-data-context";
import { ClientIdeasTab } from "@/components/client-ideas-tab";
import { WeekIdeasPanel } from "@/components/week-ideas-panel";

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  Mon: "Montag", Tue: "Dienstag", Wed: "Mittwoch",
  Thu: "Donnerstag", Fri: "Freitag", Sat: "Samstag", Sun: "Sonntag",
};
const DAY_SHORT: Record<string, string> = {
  Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So",
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const STATUS_OPTIONS = [
  { value: "entwurf", label: "Entwurf", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "bereit", label: "Bereit", color: "bg-green-50 text-green-600 border-green-200" },
  { value: "review", label: "Review", color: "bg-amber-50 text-amber-700 border-amber-200" },
];

function statusColor(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color || "bg-ocean/[0.02] text-ocean/70 border-ocean/[0.06]";
}


// ── Status Picker (dropdown — also gates client portal visibility) ─────────

function StatusPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
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

  const current = STATUS_OPTIONS.find((o) => o.value === value);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center gap-1 cursor-pointer"
      >
        <Badge className={`rounded-md text-[10px] border ${statusColor(value)} hover:opacity-80 transition-opacity`}>
          {current?.label || value}
        </Badge>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 min-w-[180px] rounded-lg border border-ocean/[0.08] bg-white shadow-[0_8px_24px_rgba(32,35,69,0.10)] py-1">
          {STATUS_OPTIONS.map((opt) => {
            const isClientVisible = opt.value === "bereit" || opt.value === "review";
            const dotColor =
              opt.value === "entwurf" ? "bg-slate-400"
              : opt.value === "bereit" ? "bg-green-500"
              : opt.value === "review" ? "bg-amber-500"
              : "bg-ocean/40";
            return (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-ocean/[0.03] transition-colors flex items-center justify-between gap-3 ${value === opt.value ? "bg-ocean/[0.02]" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
                  <span className="text-ocean font-medium">{opt.label}</span>
                </div>
                <span className={`text-[9px] ${isClientVisible ? "text-green-600" : "text-ocean/40"}`}>
                  {isClientVisible ? "→ Kunde sieht es" : "intern"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ── Feedback Badge (aggregates client feedback across kurz+lang variants) ───

function FeedbackBadge({ variants }: { variants: Script[] }) {
  if (variants.length === 0) return <span className="text-xs text-ocean/30">—</span>;

  const statuses = variants.map(v => v.clientFeedbackStatus).filter(Boolean);
  // No feedback at all
  if (statuses.length === 0) return <span className="text-xs text-ocean/30">— offen</span>;

  // Mixed: variants disagree
  const allSame = statuses.every(s => s === statuses[0]);
  if (!allSame) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700" title="Unterschiedliches Feedback bei kurz/lang">
        <span>≈ gemischt</span>
      </span>
    );
  }

  const status = statuses[0];
  const fbText = variants.find(v => v.clientFeedbackText)?.clientFeedbackText;

  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
        <ThumbsUp className="h-3 w-3" />
        Mag ich
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700" title={fbText || ""}>
        <ThumbsDown className="h-3 w-3" />
        Mag ich nicht
      </span>
    );
  }
  if (status === "revision_requested") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700" title={fbText || ""}>
        <Wrench className="h-3 w-3" />
        Verbessern
      </span>
    );
  }
  return <span className="text-xs text-ocean/30">—</span>;
}


// ── Send-to-ClickUp button (manual admin trigger) ───────────────────────────

function SendToClickUpButton({
  script,
  onSynced,
}: {
  script: Script;
  onSynced: (taskId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSent = !!script.clickupCardId;

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/scripts/${script.id}/send-to-clickup`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.message || data.error || "Sync fehlgeschlagen";
        setError(msg);
        setTimeout(() => setError(null), 4000);
        return;
      }
      onSynced(data.taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync fehlgeschlagen";
      setError(msg);
      setTimeout(() => setError(null), 4000);
    } finally {
      setBusy(false);
    }
  };

  const title = error
    ? `Fehler: ${error}`
    : isSent
    ? "Card in ClickUp aktualisieren"
    : "An Editor senden (ClickUp)";

  const colorClass = error
    ? "text-red-600 bg-red-50"
    : isSent
    ? "text-purple-600 hover:text-purple-700 hover:bg-purple-50"
    : "text-ocean/40 hover:text-purple-600 hover:bg-purple-50";

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={title}
      className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${colorClass}`}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isSent ? (
        <ExternalLink className="h-3 w-3" />
      ) : (
        <span className="text-[10px] font-bold">CU</span>
      )}
    </button>
  );
}


// ── Script Cell (renders script content inside a table cell) ────────────────

function ScriptCell({ script }: { script?: Script }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!script) {
    return <td className="px-4 py-4 align-top text-xs text-ocean/25 italic">—</td>;
  }

  const fullText = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
  const isLong = (script.body || "").length > 200;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fbStatus = script.clientFeedbackStatus;
  const fbLabel = fbStatus === "approved"
    ? { text: "Client: Gefällt mir", cls: "bg-green-50 text-green-700 border-green-200" }
    : fbStatus === "rejected"
    ? { text: "Client: Abgelehnt", cls: "bg-red-50 text-red-600 border-red-200" }
    : fbStatus === "revision_requested"
    ? { text: "Client: Verbesserung", cls: "bg-amber-50 text-amber-700 border-amber-200" }
    : null;

  return (
    <td className="px-4 py-4 align-top">
      <div
        className="space-y-2 max-w-md cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {fbLabel && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${fbLabel.cls}`}>
              {fbLabel.text}
            </span>
            {script.clientFeedbackAt && (
              <span className="text-[10px] text-ocean/40">{script.clientFeedbackAt.slice(0, 10)}</span>
            )}
          </div>
        )}
        {script.hook && (
          <p className="text-[13px] text-ocean/90 leading-relaxed font-semibold">{script.hook}</p>
        )}
        {script.body && (
          <p className={`text-[13px] text-ocean/65 leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-4" : ""}`}>{script.body}</p>
        )}
        {script.cta && (
          <p className="text-[13px] text-green-700/70 leading-relaxed italic">{script.cta}</p>
        )}
        {isLong && !expanded && (
          <span className="text-[11px] text-blush-dark/60 hover:text-blush-dark">... mehr anzeigen</span>
        )}
        {fbLabel && script.clientFeedbackText && (
          <div className="rounded-lg border border-ocean/[0.06] bg-ocean/[0.02] p-2">
            <p className="text-[10px] uppercase tracking-wider text-ocean/45 font-medium mb-0.5">Client-Kommentar</p>
            <p className="text-[12px] text-ocean/75 leading-relaxed whitespace-pre-wrap break-words">{script.clientFeedbackText}</p>
          </div>
        )}
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] text-ocean/40 hover:text-ocean transition-colors"
        >
          {copied ? <><Check className="h-2.5 w-2.5 text-green-600" /> Kopiert</> : <><Copy className="h-2.5 w-2.5" /> Kopieren</>}
        </button>
      </div>
    </td>
  );
}


// ── Main Page ───────────────────────────────────────────────────────────────

const emptyForm = {
  title: "", pillar: "", contentType: "", format: "",
  hook: "", body: "", cta: "", status: "entwurf", fullScript: "",
  textHook: "", visualHook: "", bRoll: "", shotList: "", caption: "",
};

type ScriptTab = "scripts" | "ideas";

export default function ClientScriptsPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ScriptTab>("scripts");

  // Client data
  const [client, setClient] = useState<Config | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [hasAudit, setHasAudit] = useState<boolean | null>(null);

  // Saved scripts
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadScripts = useCallback(() =>
    fetch(`/api/scripts?clientId=${id}`).then(r => r.json()).then((data: Script[]) => {
      setScripts(data);
      setSelectedIds(new Set()); // clear selection after reload
    }),
  [id]);

  const { loadClient: loadClientCached } = useClientData();

  useEffect(() => {
    loadScripts();
    loadClientCached(id).then(setClient);
    fetch(`/api/analyses?clientId=${id}`).then(r => r.json()).then((analyses: unknown[]) => setHasAudit(analyses.length > 0));
  }, [id, loadScripts]);

  // ── Saved scripts CRUD ──────────────────────────────────────────────────
  const openEdit = (script: Script) => {
    setEditing(script);
    // De-dup hook/cta from body — chat-saved scripts store hook as the
    // first paragraph and body as the full text, so naively concatenating
    // hook+body+cta produces the duplicated content the user reported.
    const body = (script.body || "").trim();
    const hook = (script.hook || "").trim();
    const cta = (script.cta || "").trim();
    const parts: string[] = [];
    if (hook && !body.startsWith(hook)) parts.push(hook);
    if (body) parts.push(body);
    if (cta && !body.endsWith(cta)) parts.push(cta);
    const fullScript = parts.join("\n\n");
    setForm({
      title: script.title, pillar: script.pillar, contentType: script.contentType,
      format: script.format, hook: "", body: "", cta: "", status: script.status, fullScript,
      textHook: script.textHook || "",
      visualHook: script.visualHook || "",
      bRoll: script.bRoll || "",
      shotList: script.shotList || "",
      caption: script.caption || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title, pillar: form.pillar, contentType: form.contentType,
      format: form.format, status: form.status,
      hook: "", body: form.fullScript, cta: "",
      textHook: form.textHook,
      visualHook: form.visualHook,
      bRoll: form.bRoll,
      shotList: form.shotList,
      caption: form.caption,
    };
    if (editing) {
      await fetch("/api/scripts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...payload }) });
    } else {
      await fetch("/api/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: id, ...payload }) });
    }
    setDialogOpen(false);
    loadScripts();
  };

  const deleteScriptIds = async (ids: string[]) => {
    // Optimistic: remove from UI immediately
    setScripts(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedIds(new Set());
    // Single request — all IDs comma-separated
    await fetch(`/api/scripts?id=${ids.join(",")}`, { method: "DELETE" });
  };

  const handleDelete = async (scriptId: string) => {
    await deleteScriptIds([scriptId]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size} Skript(e) löschen?`)) return;
    await deleteScriptIds(Array.from(selectedIds));
  };

  // Status change. Coupled with the release flag: setting status to "bereit"
  // or "review" makes the script visible in the client portal; "entwurf"
  // hides it again. ("review" appears automatically when the client leaves
  // feedback — see /api/scripts/[id]/feedback.)
  const handleStatusChange = async (groupIds: string[], newStatus: string) => {
    const shouldRelease = newStatus === "bereit" || newStatus === "review";
    const ts = shouldRelease ? new Date().toISOString() : null;
    // Optimistic update for both fields.
    setScripts((prev) =>
      prev.map((s) =>
        groupIds.includes(s.id) ? { ...s, status: newStatus, releasedAt: ts } : s,
      ),
    );
    await Promise.all(
      groupIds.map((id) =>
        Promise.all([
          fetch("/api/scripts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: newStatus }),
          }),
          fetch(`/api/scripts/${id}/release`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ released: shouldRelease }),
          }),
        ]),
      ),
    );
  };

  // Toggle whether a script (or a Kurz/Lang group) is released to the client portal.
  // Optimistic update so the badge flips instantly even though the request is over WAN.
  const toggleRelease = async (ids: string[], release: boolean) => {
    const ts = release ? new Date().toISOString() : null;
    setScripts((prev) =>
      prev.map((s) => (ids.includes(s.id) ? { ...s, releasedAt: ts } : s)),
    );
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/scripts/${id}/release`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ released: release }),
        }),
      ),
    );
  };

  const toggleSelect = (ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  };

  const filtered = useMemo(() => filterStatus === "all" ? scripts : scripts.filter(s => s.status === filterStatus), [scripts, filterStatus]);
  const allScriptIds = useMemo(() => filtered.map(s => s.id), [filtered]);
  const allSelected = allScriptIds.length > 0 && allScriptIds.every(id => selectedIds.has(id));

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skripte</h1>
          <p className="mt-1 text-sm text-ocean/60">
            Strategische Video-Skripte für {client?.name || client?.configName || "..."}
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1">
          <button onClick={() => setActiveTab("scripts")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${activeTab === "scripts" ? "bg-warm-white text-ocean" : "text-ocean/60 hover:text-ocean"}`}>
            <FileText className="h-3.5 w-3.5" /> Skripte
          </button>
          <button onClick={() => setActiveTab("ideas")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${activeTab === "ideas" ? "bg-warm-white text-ocean" : "text-ocean/60 hover:text-ocean"}`}>
            <Lightbulb className="h-3.5 w-3.5" /> Ideen
          </button>
        </div>
      </div>

      {activeTab === "ideas" ? (
        <ClientIdeasTab clientId={id} />
      ) : (
      <>
      <WeekIdeasPanel clientId={id} hasAudit={hasAudit} onScriptSaved={loadScripts} />

      {/* ── Saved Scripts — Table Layout ────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {[{ value: "all", label: "Alle" }, ...STATUS_OPTIONS].map((s) => (
              <button key={s.value} onClick={() => setFilterStatus(s.value)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-all ${
                  filterStatus === s.value
                    ? "bg-blush/30 text-blush-dark border border-blush/50"
                    : "border border-ocean/[0.06] text-ocean/60 hover:text-ocean"
                }`}>
                {s.label}
              </button>
            ))}
            <span className="ml-1 text-[11px] text-ocean/50">{filtered.length} Skripte</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="ghost" onClick={handleBulkDelete}
                className="rounded-xl h-9 gap-1.5 border border-red-200 text-xs text-red-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" /> {selectedIds.size} löschen
              </Button>
            )}
            <Button variant="ghost" onClick={openNew}
              className="rounded-xl h-9 gap-1.5 border border-ocean/[0.06] text-xs text-ocean/60">
              <Plus className="h-3.5 w-3.5" /> Manuell
            </Button>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="rounded-xl border border-ocean/[0.06] overflow-hidden bg-white/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ocean/[0.08] bg-ocean/[0.02]">
                  <th className="pl-4 pr-1 py-3 w-[40px]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleSelect(allScriptIds)}
                      className="h-3.5 w-3.5 rounded border-ocean/20 text-ocean accent-ocean cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[260px]">Titel</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50">Skript</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[120px]">Kunden-Feedback</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[100px]">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[100px]">Datum</th>
                  <th className="px-4 py-3 w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean/[0.05]">
                {filtered.map((script) => {
                  const isSelected = selectedIds.has(script.id);

                  const handleDeleteRow = async () => {
                    if (!confirm("Skript löschen?")) return;
                    await deleteScriptIds([script.id]);
                  };

                  const dateStr = script.createdAt
                    ? new Date(script.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
                    : "—";

                  return (
                    <tr key={script.id} className={`group/row hover:bg-ocean/[0.01] transition-colors ${isSelected ? "bg-blush/[0.04]" : ""}`}>
                      {/* Checkbox */}
                      <td className="pl-4 pr-1 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect([script.id])}
                          className="h-3.5 w-3.5 rounded border-ocean/20 text-ocean accent-ocean cursor-pointer"
                        />
                      </td>
                      {/* Title + meta */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium text-ocean/90 leading-snug">{script.title || "Ohne Titel"}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {script.releasedAt ? (
                              <span className="text-[9px] text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 font-medium">Freigegeben</span>
                            ) : (
                              <span className="text-[9px] text-ocean/55 bg-ocean/[0.04] border border-ocean/[0.08] rounded px-1.5 py-0.5 font-medium">Entwurf (intern)</span>
                            )}
                            {script.clientEditedAt && (
                              <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-medium" title="Kunde hat das Skript im Portal bearbeitet">
                                ✏️ Vom Kunden bearbeitet
                              </span>
                            )}
                            {script.clickupCardId && (
                              <a
                                href={`https://app.clickup.com/t/${script.clickupCardId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded px-1.5 py-0.5 font-medium"
                                title="Card in ClickUp öffnen"
                              >
                                📋 In ClickUp
                              </a>
                            )}
                            {script.source === "viral-script" && (
                              <span className="text-[9px] text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 font-medium">Viral Script</span>
                            )}
                            {script.pillar && (
                              <span className="text-[9px] text-blush-dark/60 rounded bg-blush/15 border border-blush/25 px-1.5 py-0.5">{script.pillar}</span>
                            )}
                            {script.format && (
                              <span className="text-[9px] text-ocean/50 rounded bg-ocean/[0.04] border border-ocean/[0.06] px-1.5 py-0.5">{script.format}</span>
                            )}
                            {script.contentType && (
                              <span className="text-[9px] text-ocean/45">{script.contentType}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Skript-Inhalt */}
                      <ScriptCell script={script} />

                      {/* Client feedback */}
                      <td className="px-4 py-4 align-top">
                        <FeedbackBadge variants={[script]} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 align-top">
                        <StatusPicker
                          value={script.status}
                          onChange={(next) => handleStatusChange([script.id], next)}
                        />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 align-top">
                        <span className="text-xs text-ocean/45">{dateStr}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          {script.releasedAt ? (
                            <button
                              onClick={() => toggleRelease([script.id], false)}
                              title="Freigabe zurückziehen"
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                              <EyeOff className="h-3 w-3" />
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleRelease([script.id], true)}
                              title="Für Kunden freigeben"
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-green-600 hover:bg-green-50 transition-colors">
                              <Send className="h-3 w-3" />
                            </button>
                          )}
                          <SendToClickUpButton
                            script={script}
                            onSynced={(taskId) =>
                              setScripts((prev) =>
                                prev.map((s) => (s.id === script.id ? { ...s, clickupCardId: taskId } : s)),
                              )
                            }
                          />
                          <button onClick={() => openEdit(script)} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-ocean hover:bg-ocean/5 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={handleDeleteRow} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-ocean/5 bg-ocean/[0.01] p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-ocean/15 mb-3" />
            <p className="text-sm text-ocean/50">Noch keine gespeicherten Skripte.</p>
            <p className="text-xs text-ocean/40 mt-1">Generiere eine Woche um loszulegen.</p>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>{editing ? "Skript bearbeiten" : "Neues Skript"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-ocean/60">Titel</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1.5 rounded-xl border-ocean/[0.06] h-10 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-ocean/60">Pillar</Label>
                <Input value={form.pillar} onChange={(e) => setForm({ ...form, pillar: e.target.value })}
                  className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Content-Type</Label>
                <Input value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}
                  className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Format</Label>
                <Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                  className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Skript</Label>
              <Textarea value={form.fullScript} onChange={(e) => setForm({ ...form, fullScript: e.target.value })}
                rows={10} className="mt-1.5 rounded-xl border-ocean/[0.06] text-sm" />
            </div>

            <div className="border-t border-ocean/[0.06] pt-4 space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-ocean/45 font-medium">Produktion (für Editor)</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-ocean/60">Text-Hook (On-Screen)</Label>
                  <Input value={form.textHook} onChange={(e) => setForm({ ...form, textHook: e.target.value })}
                    placeholder='z.B. „94 kg → 65 kg"' className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-ocean/60">Visual-Hook</Label>
                  <Input value={form.visualHook} onChange={(e) => setForm({ ...form, visualHook: e.target.value })}
                    placeholder="z.B. Talking head + Spiegel-Cut" className="mt-1.5 rounded-xl border-ocean/[0.06] h-9 text-sm" />
                </div>
              </div>

              <div>
                <Label className="text-xs text-ocean/60">B-Roll / Aufnahme-Shots</Label>
                <Textarea value={form.bRoll} onChange={(e) => setForm({ ...form, bRoll: e.target.value })}
                  rows={3} placeholder="Eine Liste was als B-Roll gefilmt werden soll, eine Zeile pro Shot."
                  className="mt-1.5 rounded-xl border-ocean/[0.06] text-sm" />
              </div>

              <div>
                <Label className="text-xs text-ocean/60">Shot-List / Filmanweisungen</Label>
                <Textarea value={form.shotList} onChange={(e) => setForm({ ...form, shotList: e.target.value })}
                  rows={3} placeholder="Sekunden-Regie, Schnitte, Pacing-Hinweise."
                  className="mt-1.5 rounded-xl border-ocean/[0.06] text-sm" />
              </div>

              <div>
                <Label className="text-xs text-ocean/60">Videobeschreibung (Caption)</Label>
                <Textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })}
                  rows={4} placeholder="Instagram-Caption mit Hashtags, Emojis, Folge-CTA."
                  className="mt-1.5 rounded-xl border-ocean/[0.06] text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end pt-2">
              <button onClick={() => setDialogOpen(false)} className="text-xs text-ocean/60 hover:text-ocean">Abbrechen</button>
              <Button onClick={handleSave} className="h-9 px-5 rounded-xl bg-ocean hover:bg-ocean-light border-0 text-white text-xs">
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      </>
      )}
    </div>
  );
}
