"use client";

import { useEffect, useState, useCallback } from "react";
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
  Sparkles,
  Loader2,
  ChevronDown,
  Copy,
  Check,
  Save,
  Lightbulb,
  Pencil,
  Trash2,
  Clock,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Script, Config } from "@/lib/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  Mon: "Montag", Tue: "Dienstag", Wed: "Mittwoch",
  Thu: "Donnerstag", Fri: "Freitag", Sat: "Samstag", Sun: "Sonntag",
};
const DAY_SHORT: Record<string, string> = {
  Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So",
};

function fmtDuration(s: number): string {
  if (!s) return "?s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Types ───────────────────────────────────────────────────────────────────

type WeekScript = {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  reasoning: string;
};

type GenerationMeta = {
  hasAudit: boolean;
  ownVideosUsed: number;
  creatorVideosUsed: number;
  trainingScriptsUsed: number;
  avgViralDurationSeconds: number | null;
  targetWords: number | null;
};

const STATUS_OPTIONS = [
  { value: "entwurf", label: "Entwurf", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "bereit", label: "Bereit", color: "bg-green-50 text-green-600 border-green-200" },
  { value: "veröffentlicht", label: "Veröffentlicht", color: "bg-blush/20 text-blush-dark border-blush/40" },
];

function statusColor(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color || "bg-ocean/[0.02] text-ocean/70 border-ocean/[0.06]";
}

// ── Generated Script Card (the main star) ───────────────────────────────────

function GeneratedScriptCard({
  script,
  onSave,
  saved,
}: {
  script: WeekScript;
  onSave: () => Promise<void>;
  saved: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const fullText = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
  const words = wordCount(fullText);
  const dur = fmtDuration(Math.round((words / 125) * 60));

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    await onSave();
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-ocean/[0.08] overflow-hidden bg-white/50">
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-warm-white/50 transition-colors cursor-pointer"
      >
        <span className="text-xs font-bold text-blush-dark bg-blush/25 rounded-lg px-2.5 py-1 shrink-0">
          {DAY_SHORT[script.day] || script.day}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-ocean/50 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold block truncate">{script.title}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-ocean/50">{script.contentType}</span>
            <span className="text-[10px] text-ocean/30">·</span>
            <span className="text-[10px] text-ocean/50">{script.format}</span>
            <span className="text-[10px] text-ocean/30">·</span>
            <span className="text-[10px] text-ocean/50 flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{dur}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={handleCopy} className="h-8 w-8 flex items-center justify-center rounded-lg text-ocean/50 hover:text-ocean hover:bg-ocean/5 transition-colors">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {!saved ? (
            <button onClick={handleSave} disabled={saving} className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs text-green-600 hover:bg-green-50 border border-green-200 transition-colors">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Speichern
            </button>
          ) : (
            <span className="h-8 flex items-center gap-1.5 px-3 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Gespeichert
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-ocean/5">
          {/* Reasoning — always prominent */}
          {script.reasoning && (
            <div className="flex gap-2.5 mt-3 rounded-xl bg-amber-50/80 border border-amber-200/50 px-4 py-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800/80 leading-relaxed">{script.reasoning}</p>
            </div>
          )}

          {/* Script sections */}
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 overflow-hidden">
            {script.hook && (
              <div className="px-4 py-3 border-b border-ocean/5">
                <p className="text-[9px] uppercase tracking-wider text-blush-dark/60 font-medium mb-1.5">Hook</p>
                <p className="text-sm text-ocean/90 leading-relaxed font-medium">{script.hook}</p>
              </div>
            )}
            {script.body && (
              <div className="px-4 py-3 border-b border-ocean/5">
                <p className="text-[9px] uppercase tracking-wider text-ocean/40 font-medium mb-1.5">Skript</p>
                <p className="text-sm text-ocean/75 leading-relaxed whitespace-pre-wrap">{script.body}</p>
              </div>
            )}
            {script.cta && (
              <div className="px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider text-green-600/60 font-medium mb-1.5">CTA</p>
                <p className="text-sm text-ocean/75 leading-relaxed">{script.cta}</p>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-blush-dark/60 rounded-md bg-blush/20 border border-blush/30 px-2 py-0.5">{script.pillar}</span>
            <span className="text-[10px] text-ocean/50">{words} Wörter · ~{dur}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Saved Script Card (compact) ─────────────────────────────────────────────

function SavedScriptCard({
  script,
  onEdit,
  onDelete,
}: {
  script: Script;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullText = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
  const words = wordCount(fullText);
  const dur = words > 0 ? fmtDuration(Math.round((words / 125) * 60)) : null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-ocean/[0.06] overflow-hidden group transition-all hover:border-ocean/[0.1]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-warm-white transition-colors cursor-pointer"
      >
        <ChevronDown className={`h-3 w-3 text-ocean/50 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        <span className="flex-1 text-sm font-medium truncate">{script.title || "Ohne Titel"}</span>
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {script.contentType && <span className="text-[10px] text-ocean/60 bg-ocean/[0.02] border border-ocean/[0.06] rounded px-1.5 py-0.5">{script.contentType}</span>}
          {dur && <span className="text-[10px] text-ocean/50 flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{dur}</span>}
          <Badge className={`rounded-md text-[10px] border ${statusColor(script.status)}`}>
            {STATUS_OPTIONS.find(o => o.value === script.status)?.label || script.status}
          </Badge>
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={handleCopy} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/50 hover:text-ocean hover:bg-warm-white transition-colors">
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/50 hover:text-ocean hover:bg-warm-white transition-colors">
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/50 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/5">
          <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-4 py-3">
            <p className="text-sm text-ocean/80 leading-relaxed whitespace-pre-wrap">{fullText}</p>
          </div>
          <div className="flex items-center gap-2">
            {script.pillar && <span className="text-[10px] text-blush-dark/60 rounded bg-blush/20 border border-blush/30 px-2 py-0.5">{script.pillar}</span>}
            {script.format && <span className="text-[10px] text-ocean/50">{script.format}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const emptyForm = {
  title: "", pillar: "", contentType: "", format: "",
  hook: "", body: "", cta: "", status: "entwurf", fullScript: "",
};

export default function ClientScriptsPage() {
  const { id } = useParams<{ id: string }>();

  // Client data
  const [client, setClient] = useState<Config | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [hasAudit, setHasAudit] = useState<boolean | null>(null);

  // Week generation
  const [weekScripts, setWeekScripts] = useState<WeekScript[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [weekMeta, setWeekMeta] = useState<GenerationMeta | null>(null);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());

  // Saved scripts
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadScripts = useCallback(() =>
    fetch(`/api/scripts?clientId=${id}`).then(r => r.json()).then(setScripts),
  [id]);

  useEffect(() => {
    loadScripts();
    fetch(`/api/configs/${id}`).then(r => r.json()).then((cfg: Config) => setClient(cfg));
    fetch(`/api/analyses?clientId=${id}`).then(r => r.json()).then((analyses: unknown[]) => setHasAudit(analyses.length > 0));
  }, [id, loadScripts]);

  // ── Generate full week ──────────────────────────────────────────────────
  const generateWeek = async () => {
    setWeekLoading(true);
    setWeekError(null);
    setWeekScripts([]);
    setSavedSet(new Set());
    setWeekMeta(null);

    try {
      const res = await fetch(`/api/configs/${id}/generate-week-scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generierung fehlgeschlagen");
      setWeekScripts(data.scripts || []);
      setWeekMeta(data._meta || null);
    } catch (e) {
      setWeekError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setWeekLoading(false);
    }
  };

  // ── Save individual script ──────────────────────────────────────────────
  const saveScript = async (index: number) => {
    const s = weekScripts[index];
    if (!s) return;
    await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        title: s.title,
        pillar: s.pillar,
        contentType: s.contentType,
        format: s.format,
        hook: s.hook,
        body: s.body,
        cta: s.cta,
        status: "entwurf",
      }),
    });
    setSavedSet(prev => new Set(prev).add(index));
    loadScripts();
  };

  // ── Save all scripts ────────────────────────────────────────────────────
  const [savingAll, setSavingAll] = useState(false);
  const saveAll = async () => {
    setSavingAll(true);
    for (let i = 0; i < weekScripts.length; i++) {
      if (!savedSet.has(i)) {
        await saveScript(i);
      }
    }
    setSavingAll(false);
  };

  const allSaved = weekScripts.length > 0 && weekScripts.every((_, i) => savedSet.has(i));
  const someSaved = savedSet.size > 0;

  // ── Saved scripts CRUD ──────────────────────────────────────────────────
  const openEdit = (script: Script) => {
    setEditing(script);
    const fullScript = [script.hook, script.body, script.cta].filter(Boolean).join("\n\n");
    setForm({
      title: script.title, pillar: script.pillar, contentType: script.contentType,
      format: script.format, hook: "", body: "", cta: "", status: script.status, fullScript,
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
    };
    if (editing) {
      await fetch("/api/scripts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...payload }) });
    } else {
      await fetch("/api/scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: id, ...payload }) });
    }
    setDialogOpen(false);
    loadScripts();
  };

  const handleDelete = async (scriptId: string) => {
    if (!confirm("Skript löschen?")) return;
    await fetch(`/api/scripts?id=${scriptId}`, { method: "DELETE" });
    loadScripts();
  };

  const filtered = filterStatus === "all" ? scripts : scripts.filter(s => s.status === filterStatus);

  return (
    <div className="space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Skripte</h1>
        <p className="mt-1 text-sm text-ocean/60">
          Strategische Video-Skripte für {client?.name || client?.configName || "..."}
        </p>
      </div>

      {/* ── Generate Week Panel ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-blush/40 bg-gradient-to-br from-blush-light/20 to-white p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush/30 border border-blush/50 shrink-0">
              <Sparkles className="h-5 w-5 text-blush-dark" />
            </div>
            <div>
              <p className="text-base font-semibold">Woche generieren</p>
              <p className="text-xs text-ocean/60 mt-0.5">
                KI erstellt strategisch begründete Skripte basierend auf Audit, Performance & Strategie
              </p>
            </div>
          </div>

          {/* Data sources */}
          <div className="hidden sm:flex flex-col gap-1 items-end shrink-0">
            {hasAudit === true && (
              <span className="text-[11px] text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Audit vorhanden
              </span>
            )}
            {hasAudit === false && (
              <span className="text-[11px] text-amber-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Kein Audit — für bessere Ergebnisse zuerst analysieren
              </span>
            )}
          </div>
        </div>

        <Button
          onClick={generateWeek}
          disabled={weekLoading}
          className="h-11 px-8 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-2.5 text-white text-sm"
        >
          {weekLoading
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Strategische Skripte werden erstellt...</>
            : weekScripts.length > 0
              ? <><Sparkles className="h-4 w-4" /> Neue Woche generieren</>
              : <><Sparkles className="h-4 w-4" /> Woche generieren</>}
        </Button>

        {weekError && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{weekError}</p>
        )}

        {/* Generated scripts */}
        {weekScripts.length > 0 && (
          <div className="space-y-3">
            {/* Meta info */}
            {weekMeta && (
              <div className="flex items-center gap-3 text-[11px] text-ocean/50 flex-wrap">
                {weekMeta.hasAudit && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Audit integriert</span>}
                {weekMeta.ownVideosUsed > 0 && <span>{weekMeta.ownVideosUsed} eigene Top-Videos</span>}
                {weekMeta.creatorVideosUsed > 0 && <span>{weekMeta.creatorVideosUsed} Competitor-Videos</span>}
                {weekMeta.trainingScriptsUsed > 0 && <span>{weekMeta.trainingScriptsUsed} Voice-Beispiele</span>}
                {weekMeta.targetWords && <span>Ziel: ~{weekMeta.targetWords} Wörter/Skript</span>}
              </div>
            )}

            {/* Script cards */}
            {weekScripts.map((script, i) => (
              <GeneratedScriptCard
                key={`${script.day}-${i}`}
                script={script}
                onSave={() => saveScript(i)}
                saved={savedSet.has(i)}
              />
            ))}

            {/* Save all button */}
            {!allSaved && (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={saveAll}
                  disabled={savingAll}
                  className="h-10 px-6 rounded-xl bg-green-600 hover:bg-green-700 border-0 gap-2 text-white text-sm"
                >
                  {savingAll
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert...</>
                    : <><Save className="h-4 w-4" /> Alle speichern ({weekScripts.length - savedSet.size})</>}
                </Button>
              </div>
            )}
            {allSaved && (
              <div className="flex items-center justify-center gap-2 py-3 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" /> Alle {weekScripts.length} Skripte gespeichert
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Saved Scripts ─────────────────────────────────────────────────── */}
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
          <Button variant="ghost" onClick={openNew}
            className="rounded-xl h-9 gap-1.5 border border-ocean/[0.06] text-xs text-ocean/60">
            <Plus className="h-3.5 w-3.5" /> Manuell
          </Button>
        </div>

        <div className="space-y-2">
          {filtered.map(script => (
            <SavedScriptCard key={script.id} script={script} onEdit={() => openEdit(script)} onDelete={() => handleDelete(script.id)} />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-ocean/5 bg-ocean/[0.01] p-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-ocean/15 mb-3" />
              <p className="text-sm text-ocean/50">Noch keine gespeicherten Skripte.</p>
              <p className="text-xs text-ocean/40 mt-1">Generiere eine Woche um loszulegen.</p>
            </div>
          )}
        </div>
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
            <div className="grid grid-cols-3 gap-3">
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
            <div className="flex items-center gap-3 justify-end pt-2">
              <button onClick={() => setDialogOpen(false)} className="text-xs text-ocean/60 hover:text-ocean">Abbrechen</button>
              <Button onClick={handleSave} className="h-9 px-5 rounded-xl bg-ocean hover:bg-ocean-light border-0 text-white text-xs">
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
