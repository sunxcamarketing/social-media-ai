"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Mic,
  Target,
  Zap,
  PenTool,
  Shield,
} from "lucide-react";
import { BookOpen } from "lucide-react";
import type { Script, Config, TrainingScript } from "@/lib/types";
import { useGeneration } from "@/context/generation-context";
import { useClientData } from "@/context/client-data-context";
import { BUILT_IN_FORMATS } from "@/lib/strategy";
import type { ContentFormat } from "@/lib/strategy";

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

function baseTitle(title: string): string {
  return title.replace(/\s*(?:\(Kurz\)|\(Lang\)|—\s*Kurz|—\s*Lang)\s*$/, "").trim();
}

function scriptVariant(title: string): "kurz" | "lang" | null {
  if (/(?:\(Kurz\)|—\s*Kurz)\s*$/.test(title)) return "kurz";
  if (/(?:\(Lang\)|—\s*Lang)\s*$/.test(title)) return "lang";
  return null;
}

type ScriptGroup = {
  base: string;
  kurz?: Script;
  lang?: Script;
  single?: Script; // no variant suffix
};

function groupScripts(scripts: Script[]): ScriptGroup[] {
  const map = new Map<string, ScriptGroup>();
  for (const s of scripts) {
    const variant = scriptVariant(s.title);
    const base = baseTitle(s.title);
    if (!map.has(base)) map.set(base, { base });
    const group = map.get(base)!;
    if (variant === "kurz") group.kurz = s;
    else if (variant === "lang") group.lang = s;
    else group.single = s;
  }
  return Array.from(map.values());
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
  hookPattern: string;
  body: string;
  cta: string;
  reasoning: string;
};

type GenerationMeta = {
  hasAudit: boolean;
  hasVoiceProfile: boolean;
  ownVideosUsed: number;
  creatorVideosUsed: number;
  avgViralDurationSeconds: number | null;
  targetWords: number | null;
  reviewIssuesFixed: number;
};

type PipelineStep = "idle" | "context" | "voice" | "trends" | "topics" | "hooks" | "bodies" | "review" | "done" | "error";

const PIPELINE_STEPS: { key: PipelineStep; label: string; icon: React.ElementType }[] = [
  { key: "context", label: "Kontext laden", icon: FileText },
  { key: "voice", label: "Stimmprofil", icon: Mic },
  { key: "trends", label: "Trend-Recherche", icon: Lightbulb },
  { key: "topics", label: "Themen auswählen", icon: Target },
  { key: "hooks", label: "Hooks generieren", icon: Zap },
  { key: "bodies", label: "Skripte schreiben", icon: PenTool },
  { key: "review", label: "Qualitätsprüfung", icon: Shield },
];

const STATUS_OPTIONS = [
  { value: "entwurf", label: "Entwurf", color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { value: "bereit", label: "Bereit", color: "bg-green-50 text-green-600 border-green-200" },
  { value: "veröffentlicht", label: "Veröffentlicht", color: "bg-blush/20 text-blush-dark border-blush/40" },
];

function statusColor(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color || "bg-ocean/[0.02] text-ocean/70 border-ocean/[0.06]";
}

// ── Pipeline Progress Component ─────────────────────────────────────────────

function PipelineProgress({
  currentStep,
  hooksProgress,
  bodiesProgress,
  totalScripts,
  topics,
  error,
}: {
  currentStep: PipelineStep;
  hooksProgress: number;
  bodiesProgress: number;
  totalScripts: number;
  topics: { day: string; title: string; pillar: string }[];
  error: string | null;
}) {
  const stepOrder = PIPELINE_STEPS.map(s => s.key);
  const currentIdx = stepOrder.indexOf(currentStep);

  return (
    <div className="rounded-xl bg-gradient-to-r from-ocean/[0.03] to-blush/[0.03] border border-ocean/[0.08] p-5 space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {PIPELINE_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isDone = currentIdx > i || currentStep === "done";
          const isPending = currentIdx < i && currentStep !== "done";

          let progressText = "";
          if (step.key === "hooks" && isActive) progressText = ` (${hooksProgress}/${totalScripts})`;
          if (step.key === "bodies" && isActive) progressText = ` (${bodiesProgress}/${totalScripts})`;

          return (
            <div key={step.key} className="flex items-center gap-1.5">
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : isActive ? (
                <Loader2 className="h-4 w-4 text-ocean animate-spin" />
              ) : (
                <Icon className="h-4 w-4 text-ocean/25" />
              )}
              <span className={`text-xs font-medium ${
                isDone ? "text-green-600" : isActive ? "text-ocean" : "text-ocean/30"
              }`}>
                {step.label}{progressText}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="text-ocean/15 mx-1">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Show selected topics once available */}
      {topics.length > 0 && (currentStep === "hooks" || currentStep === "bodies" || currentStep === "review" || currentStep === "done") && (
        <div className="flex flex-wrap gap-2">
          {topics.map((t, i) => (
            <span key={i} className="text-[10px] bg-white/80 border border-ocean/[0.06] rounded-lg px-2.5 py-1 text-ocean/70">
              <span className="font-semibold text-blush-dark">{DAY_SHORT[t.day] || t.day}</span> {t.title}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}
    </div>
  );
}

// ── Generated Script Card ───────────────────────────────────────────────────

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

      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-ocean/5">
          {script.reasoning && (
            <div className="flex gap-2.5 mt-3 rounded-xl bg-amber-50/80 border border-amber-200/50 px-4 py-3">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800/80 leading-relaxed">{script.reasoning}</p>
            </div>
          )}

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

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-blush-dark/60 rounded-md bg-blush/20 border border-blush/30 px-2 py-0.5">{script.pillar}</span>
            <span className="text-[10px] text-ocean/50">{words} Wörter · ~{dur}</span>
          </div>
        </div>
      )}
    </div>
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

  return (
    <td className="px-4 py-4 align-top">
      <div
        className="space-y-2 max-w-md cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {script.hook && (
          <p className="text-[13px] text-ocean/90 leading-relaxed font-semibold">{script.hook}</p>
        )}
        {script.body && (
          <p className={`text-[13px] text-ocean/65 leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-4" : ""}`}>{script.body}</p>
        )}
        {!script.hook && !script.cta && script.body && (
          <p className={`text-[13px] text-ocean/65 leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? "line-clamp-4" : ""}`}>{script.body}</p>
        )}
        {script.cta && (
          <p className="text-[13px] text-green-700/70 leading-relaxed italic">{script.cta}</p>
        )}
        {isLong && !expanded && (
          <span className="text-[11px] text-blush-dark/60 hover:text-blush-dark">... mehr anzeigen</span>
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

// ── Training Tab ────────────────────────────────────────────────────────────

const EMPTY_TRAINING: Omit<TrainingScript, "id" | "createdAt"> = {
  clientId: "", format: "", textHook: "", visualHook: "", audioHook: "", script: "", cta: "", sourceId: "",
};

function formatTrainingDate(iso: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso.split("T")[0]; }
}

function ClientTrainingTab({ clientId }: { clientId: string }) {
  const [scripts, setScripts] = useState<TrainingScript[]>([]);
  const [allFormats, setAllFormats] = useState<ContentFormat[]>(BUILT_IN_FORMATS);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingScript | null>(null);
  const [form, setForm] = useState<Omit<TrainingScript, "id" | "createdAt">>({ ...EMPTY_TRAINING, clientId });
  const [saving, setSaving] = useState(false);
  const { voiceProfileGen, startVoiceProfileGen, clearVoiceProfileGen } = useGeneration();
  const voiceState = voiceProfileGen.get(clientId);
  const generatingVoice = voiceState?.status === "running";
  const voiceGenDone = voiceState?.status === "done";

  function regenerateVoiceProfile() {
    startVoiceProfileGen(clientId);
  }

  // Auto-clear "done" status after 30 seconds (long enough to notice)
  useEffect(() => {
    if (voiceGenDone) {
      const t = setTimeout(() => clearVoiceProfileGen(clientId), 30000);
      return () => clearTimeout(t);
    }
  }, [voiceGenDone, clientId, clearVoiceProfileGen]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/training-scripts?clientId=${clientId}`).then(r => r.json()),
      fetch("/api/strategy").then(r => r.json()),
    ]).then(([clientScripts, strategy]) => {
      setScripts(clientScripts as TrainingScript[]);
      setAllFormats([...BUILT_IN_FORMATS, ...(strategy.customFormats || [])]);
    }).finally(() => setLoading(false));
  }, [clientId]);

  function openAdd() { setEditing(null); setForm({ ...EMPTY_TRAINING, clientId }); setDialogOpen(true); }
  function openEdit(s: TrainingScript) {
    setEditing(s);
    setForm({ clientId: s.clientId, format: s.format, textHook: s.textHook, visualHook: s.visualHook, audioHook: s.audioHook, script: s.script, cta: s.cta, sourceId: s.sourceId || "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editing) {
        const updated = await fetch("/api/training-scripts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editing.id, createdAt: editing.createdAt }) }).then(r => r.json());
        setScripts(prev => prev.map(s => s.id === updated.id ? updated : s));
      } else {
        const created = await fetch("/api/training-scripts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).then(r => r.json());
        setScripts(prev => [created, ...prev]);
      }
      setDialogOpen(false);
      fetch(`/api/configs/${clientId}/generate-voice-profile`, { method: "POST" }).catch(() => {});
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Training-Skript löschen?")) return;
    await fetch(`/api/training-scripts?id=${id}`, { method: "DELETE" });
    setScripts(prev => prev.filter(s => s.id !== id));
    fetch(`/api/configs/${clientId}/generate-voice-profile`, { method: "POST" }).catch(() => {});
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-ocean/60 text-sm">Laden…</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ocean/60">{scripts.length} Training-Skripte für Voice Profile & Stilanalyse</p>
        <div className="flex items-center gap-2">
          {scripts.length > 0 && (
            <Button
              onClick={regenerateVoiceProfile}
              disabled={generatingVoice}
              variant="outline"
              className="rounded-xl h-9 px-4 border-ocean/[0.06] text-[13px] gap-1.5"
            >
              {generatingVoice ? <><Loader2 className="h-4 w-4 animate-spin" /> Generiert...</> : voiceGenDone ? <><CheckCircle2 className="h-4 w-4 text-green-500" /> Gespeichert</> : <><Mic className="h-4 w-4" /> Voice Profile generieren</>}
            </Button>
          )}
          <Button onClick={openAdd} className="rounded-xl h-9 px-4 bg-ocean hover:bg-ocean-light border-0 gap-1.5 text-[13px]">
            <Plus className="h-4 w-4" /> Neues Skript
          </Button>
        </div>
      </div>

      {/* Voice Profile Status Banner */}
      {generatingVoice && (
        <div className="flex items-center gap-2 rounded-xl bg-ocean/[0.03] border border-ocean/[0.06] px-4 py-3 mb-4 text-sm text-ocean/70">
          <Loader2 className="h-4 w-4 animate-spin text-ocean/50 shrink-0" />
          Voice Profile wird generiert... Du kannst den Tab wechseln, es läuft im Hintergrund weiter.
        </div>
      )}
      {voiceGenDone && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 mb-4 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          Voice Profile erfolgreich generiert und gespeichert.
        </div>
      )}
      {voiceState?.status === "error" && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-4 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          Voice Profile Generierung fehlgeschlagen: {voiceState.error || "Unbekannter Fehler"}
        </div>
      )}

      {scripts.length === 0 ? (
        <div className="rounded-2xl border border-ocean/5 bg-ocean/[0.01] p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-ocean/15 mb-3" />
          <p className="text-sm text-ocean/50">Noch keine Training-Skripte.</p>
          <p className="text-xs text-ocean/40 mt-1">Füge Beispiel-Skripte hinzu, damit die KI den Stil lernt.</p>
          <Button onClick={openAdd} variant="outline" className="rounded-xl border-ocean/[0.06] text-[13px] gap-1.5 mt-4">
            <Plus className="h-4 w-4" /> Erstes Skript hinzufügen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {scripts.map(s => (
            <div key={s.id} className="glass rounded-2xl border border-ocean/[0.06] p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {s.format && (
                    <Badge className="rounded-lg border text-[11px] font-medium px-2 py-0.5 bg-ocean/[0.02] text-ocean/60 border-ocean/5">
                      {s.format}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-ocean/60 hover:text-ocean hover:bg-warm-white transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg text-ocean/60 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {s.textHook && (
                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Text Hook</p>
                    <p className="text-[13px] text-ocean/80 leading-relaxed">{s.textHook}</p>
                  </div>
                )}
                {s.audioHook && (
                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Audio Hook</p>
                    <p className="text-[13px] text-ocean/80 leading-relaxed">{s.audioHook}</p>
                  </div>
                )}
                {s.script && (
                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">Skript</p>
                    <p className="text-[13px] text-ocean/80 leading-relaxed whitespace-pre-wrap line-clamp-5">{s.script}</p>
                  </div>
                )}
                {s.cta && (
                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-ocean/65 mb-1">CTA</p>
                    <p className="text-[13px] text-ocean/80 leading-relaxed">{s.cta}</p>
                  </div>
                )}
              </div>
              <div className="pt-1 border-t border-ocean/5">
                <span className="text-[11px] text-ocean/70">{formatTrainingDate(s.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl glass border-ocean/[0.06] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{editing ? "Training-Skript bearbeiten" : "Neues Training-Skript"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">Format</Label>
              <div className="relative">
                <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}
                  className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 pr-8 text-[13px] text-ocean appearance-none cursor-pointer focus:outline-none">
                  <option value="">Auswählen…</option>
                  {allFormats.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">Text Hook</Label>
              <Input placeholder="Text der in den ersten Sekunden erscheint" value={form.textHook}
                onChange={e => setForm({ ...form, textHook: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">Audio Hook</Label>
              <Input placeholder="Erste gesprochene Worte" value={form.audioHook}
                onChange={e => setForm({ ...form, audioHook: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">Skript / Transkript</Label>
              <Textarea rows={8} placeholder="Vollständiges Skript oder Transkript" value={form.script}
                onChange={e => setForm({ ...form, script: e.target.value })}
                className="rounded-xl bg-ocean/[0.02] border-ocean/[0.06] resize-y" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/60">CTA</Label>
              <Input placeholder="Call to Action" value={form.cta}
                onChange={e => setForm({ ...form, cta: e.target.value })}
                className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06]" />
            </div>
            <Button onClick={handleSave} disabled={saving}
              className="w-full rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0 mt-1">
              {saving ? "Speichern…" : editing ? "Änderungen speichern" : "Skript hinzufügen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const emptyForm = {
  title: "", pillar: "", contentType: "", format: "",
  hook: "", body: "", cta: "", status: "entwurf", fullScript: "",
};

type ScriptTab = "scripts" | "training";

export default function ClientScriptsPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ScriptTab>("scripts");

  // Client data
  const [client, setClient] = useState<Config | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [hasAudit, setHasAudit] = useState<boolean | null>(null);

  // Week generation — pipeline state
  const [weekScripts, setWeekScripts] = useState<WeekScript[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [weekMeta, setWeekMeta] = useState<GenerationMeta | null>(null);
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());

  // Pipeline progress
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [hooksProgress, setHooksProgress] = useState(0);
  const [bodiesProgress, setBodiesProgress] = useState(0);
  const [totalScripts, setTotalScripts] = useState(0);
  const [selectedTopics, setSelectedTopics] = useState<{ day: string; title: string; pillar: string }[]>([]);

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

  // ── Generate full week (SSE streaming) ──────────────────────────────────
  const generateWeek = async () => {
    setWeekLoading(true);
    setWeekError(null);
    setWeekScripts([]);
    setSavedSet(new Set());
    setWeekMeta(null);
    setPipelineStep("context");
    setHooksProgress(0);
    setBodiesProgress(0);
    setTotalScripts(0);
    setSelectedTopics([]);

    try {
      const res = await fetch(`/api/configs/${id}/generate-week-scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Keine Server-Antwort");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let data;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }

          // Handle pipeline events
          if (data.step === "error") {
            setWeekError(data.message || "Unbekannter Fehler");
            setPipelineStep("error");
          } else if (data.step === "context" && data.status === "done") {
            setPipelineStep("voice");
          } else if (data.step === "voice" && data.status === "done") {
            setPipelineStep("trends");
          } else if (data.step === "trends" && data.status === "done") {
            setPipelineStep("topics");
          } else if (data.step === "topics" && data.status === "done") {
            setPipelineStep("hooks");
            setSelectedTopics(data.topics || []);
            setTotalScripts(data.topics?.length || 0);
          } else if (data.step === "hooks" && data.status === "loading") {
            setTotalScripts(data.total || 0);
          } else if (data.step === "hooks" && data.status === "done" && data.index !== undefined) {
            setHooksProgress(prev => prev + 1);
          } else if (data.step === "hooks" && data.status === "all_done") {
            setPipelineStep("bodies");
          } else if (data.step === "bodies" && data.status === "done" && data.index !== undefined) {
            setBodiesProgress(prev => prev + 1);
          } else if (data.step === "bodies" && data.status === "all_done") {
            setPipelineStep("review");
          } else if (data.step === "review" && data.status === "done") {
            setPipelineStep("done");
          } else if (data.step === "done") {
            setPipelineStep("done");
            setWeekScripts(data.scripts || []);
            setWeekMeta(data._meta || null);
          }
        }
      }
    } catch (e) {
      setWeekError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setPipelineStep("error");
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
        hookPattern: s.hookPattern || "",
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

  const handleStatusChange = async (scriptId: string, newStatus: string) => {
    await fetch("/api/scripts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: scriptId, status: newStatus }),
    });
    loadScripts();
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
  const grouped = useMemo(() => groupScripts(filtered), [filtered]);
  const allScriptIds = useMemo(() => filtered.map(s => s.id), [filtered]);
  const allSelected = allScriptIds.length > 0 && allScriptIds.every(id => selectedIds.has(id));
  const isPipelineActive = pipelineStep !== "idle" && pipelineStep !== "done" && pipelineStep !== "error";

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
          <button onClick={() => setActiveTab("training")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${activeTab === "training" ? "bg-warm-white text-ocean" : "text-ocean/60 hover:text-ocean"}`}>
            <BookOpen className="h-3.5 w-3.5" /> Training
          </button>
        </div>
      </div>

      {activeTab === "training" ? (
        <ClientTrainingTab clientId={id} />
      ) : (
      <>
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
                Multi-Step Pipeline: Themen → Hooks → Skripte → Qualitätsprüfung
              </p>
            </div>
          </div>

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
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Pipeline läuft...</>
            : weekScripts.length > 0
              ? <><Sparkles className="h-4 w-4" /> Neue Woche generieren</>
              : <><Sparkles className="h-4 w-4" /> Woche generieren</>}
        </Button>

        {/* Pipeline Progress */}
        {(isPipelineActive || pipelineStep === "done" || pipelineStep === "error") && (
          <PipelineProgress
            currentStep={pipelineStep}
            hooksProgress={hooksProgress}
            bodiesProgress={bodiesProgress}
            totalScripts={totalScripts}
            topics={selectedTopics}
            error={weekError}
          />
        )}

        {/* Error outside pipeline */}
        {weekError && pipelineStep === "idle" && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{weekError}</p>
        )}

        {/* Generated scripts */}
        {weekScripts.length > 0 && (
          <div className="space-y-3">
            {/* Meta info */}
            {weekMeta && (
              <div className="flex items-center gap-3 text-[11px] text-ocean/50 flex-wrap">
                {weekMeta.hasAudit && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Audit integriert</span>}
                {weekMeta.hasVoiceProfile && <span className="flex items-center gap-1"><Mic className="h-3 w-3 text-green-500" /> Stimmprofil aktiv</span>}
                {weekMeta.ownVideosUsed > 0 && <span>{weekMeta.ownVideosUsed} eigene Top-Videos</span>}
                {weekMeta.creatorVideosUsed > 0 && <span>{weekMeta.creatorVideosUsed} Competitor-Videos</span>}
                {weekMeta.targetWords && <span>Ziel: ~{weekMeta.targetWords} Wörter/Skript</span>}
                {weekMeta.reviewIssuesFixed > 0 && <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-green-500" /> {weekMeta.reviewIssuesFixed} Korrekturen</span>}
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
            <span className="ml-1 text-[11px] text-ocean/50">{grouped.length} Skripte</span>
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

        {grouped.length > 0 ? (
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
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[200px]">Titel</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50">Post Short</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50">Post Long</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[100px]">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ocean/50 w-[100px]">Datum</th>
                  <th className="px-4 py-3 w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean/[0.05]">
                {grouped.map((g) => {
                  const primary = g.single || g.lang || g.kurz;
                  if (!primary) return null;

                  const cycleStatus = () => {
                    const order = STATUS_OPTIONS.map(o => o.value);
                    const idx = order.indexOf(primary.status);
                    const next = order[(idx + 1) % order.length];
                    handleStatusChange(primary.id, next);
                  };

                  const groupIds = [g.kurz?.id, g.lang?.id, g.single?.id].filter(Boolean) as string[];
                  const isGroupSelected = groupIds.some(gid => selectedIds.has(gid));

                  const handleDeleteGroup = async () => {
                    if (!confirm("Skript löschen?")) return;
                    await deleteScriptIds(groupIds);
                  };

                  const dateStr = primary.createdAt
                    ? new Date(primary.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })
                    : "—";

                  return (
                    <tr key={g.base} className={`group/row hover:bg-ocean/[0.01] transition-colors ${isGroupSelected ? "bg-blush/[0.04]" : ""}`}>
                      {/* Checkbox */}
                      <td className="pl-4 pr-1 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={isGroupSelected}
                          onChange={() => toggleSelect(groupIds)}
                          className="h-3.5 w-3.5 rounded border-ocean/20 text-ocean accent-ocean cursor-pointer"
                        />
                      </td>
                      {/* Title + meta */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1.5">
                          <p className="text-sm font-medium text-ocean/90 leading-snug">{g.base || primary.title || "Ohne Titel"}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {primary.source === "viral-script" && (
                              <span className="text-[9px] text-purple-600 bg-purple-50 border border-purple-200 rounded px-1.5 py-0.5 font-medium">Viral Script</span>
                            )}
                            {primary.pillar && (
                              <span className="text-[9px] text-blush-dark/60 rounded bg-blush/15 border border-blush/25 px-1.5 py-0.5">{primary.pillar}</span>
                            )}
                            {primary.contentType && (
                              <span className="text-[9px] text-ocean/45">{primary.contentType}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Post Short */}
                      <ScriptCell script={g.kurz || (g.single ? g.single : undefined)} />

                      {/* Post Long */}
                      <ScriptCell script={g.lang} />

                      {/* Status */}
                      <td className="px-4 py-4 align-top">
                        <button onClick={cycleStatus} className="cursor-pointer">
                          <Badge className={`rounded-md text-[10px] border ${statusColor(primary.status)} hover:opacity-80 transition-opacity`}>
                            {STATUS_OPTIONS.find(o => o.value === primary.status)?.label || primary.status}
                          </Badge>
                        </button>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-4 align-top">
                        <span className="text-xs text-ocean/45">{dateStr}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(primary)} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-ocean hover:bg-ocean/5 transition-colors">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={handleDeleteGroup} className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors">
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
      </>
      )}
    </div>
  );
}
