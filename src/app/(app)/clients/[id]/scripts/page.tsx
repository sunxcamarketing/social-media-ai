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
  Sparkles,
  Loader2,
  ChevronDown,
  Copy,
  Check,
  Lightbulb,
  Pencil,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Mic,
} from "lucide-react";
import type { Script, Config } from "@/lib/types";
import { useGeneration } from "@/context/generation-context";
import { DevelopIdeaDialog } from "@/components/develop-idea-dialog";
import { useClientData } from "@/context/client-data-context";
import { ClientIdeasTab } from "@/components/client-ideas-tab";

// ── Helpers ─────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  Mon: "Montag", Tue: "Dienstag", Wed: "Mittwoch",
  Thu: "Donnerstag", Fri: "Freitag", Sat: "Samstag", Sun: "Sonntag",
};
const DAY_SHORT: Record<string, string> = {
  Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So",
};

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

function buildIdeaChatSeed(idea: WeekIdea): string {
  const parts = [
    `Ich will die folgende Wochenidee zu einem kompletten Skript ausformulieren:`,
    ``,
    `**Titel:** ${idea.title}`,
    `**Tag:** ${idea.day}`,
    `**Pillar:** ${idea.pillar}`,
    `**Content-Typ:** ${idea.contentType}`,
    `**Format:** ${idea.format}`,
    ``,
    `**Winkel:** ${idea.angle}`,
  ];
  if (idea.hookDirection) parts.push(`**Hook-Richtung:** ${idea.hookDirection}`);
  if (idea.keyPoints.length > 0) {
    parts.push(`**Kernpunkte:**`);
    idea.keyPoints.forEach(p => parts.push(`- ${p}`));
  }
  if (idea.emotion) parts.push(``, `**Emotion:** ${idea.emotion}`);
  parts.push(
    ``,
    `Schreib mir daraus ein Skript in zwei Versionen (kurz 30-40 Sek + lang 60+ Sek). Bleib beim Winkel, erfinde keinen neuen. Wenn das Skript fertig ist, frag ob du es unter "Skripte" speichern sollst.`,
  );
  return parts.join("\n");
}

// ── Types ───────────────────────────────────────────────────────────────────

type WeekIdea = {
  day: string;
  pillar: string;
  contentType: string;
  format: string;
  title: string;
  angle: string;
  hookDirection: string;
  keyPoints: string[];
  whyNow: string;
  emotion: string;
};

type GenerationMeta = {
  hasAudit: boolean;
  hasVoiceProfile: boolean;
  ownVideosUsed: number;
  creatorVideosUsed: number;
};

// Pipeline steps mirror what the server actually does in sequence:
// context + voice run in parallel → trends → generate. The "context" state
// covers both context and voice load (server emits both done at the same
// time after Promise.all), so we collapse them in the UI to stay honest.
type PipelineStep = "idle" | "context" | "trends" | "generate" | "done" | "error";

const PIPELINE_STEPS: { key: PipelineStep; label: string; icon: React.ElementType }[] = [
  { key: "context", label: "Kontext + Stimmprofil laden", icon: FileText },
  { key: "trends", label: "Trend-Recherche", icon: Lightbulb },
  { key: "generate", label: "Ideen entwickeln (Opus)", icon: Mic },
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
  topics,
  error,
}: {
  currentStep: PipelineStep;
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
                {step.label}
              </span>
              {i < PIPELINE_STEPS.length - 1 && (
                <span className="text-ocean/15 mx-1">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Show titles once the one-shot generator returns them */}
      {topics.length > 0 && (currentStep === "generate" || currentStep === "done") && (
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

// ── Generated Idea Card ─────────────────────────────────────────────────────

function GeneratedIdeaCard({
  idea,
  onDevelop,
  onSaveAsIdea,
  ideaSaved,
  ideaSaving,
}: {
  idea: WeekIdea;
  onDevelop: () => void;
  onSaveAsIdea: () => void;
  ideaSaved: boolean;
  ideaSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

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
          {DAY_SHORT[idea.day] || idea.day}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-ocean/50 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold block truncate">{idea.title}</span>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-ocean/50">{idea.contentType}</span>
            <span className="text-[10px] text-ocean/30">·</span>
            <span className="text-[10px] text-ocean/50">{idea.format}</span>
            {idea.emotion && (
              <>
                <span className="text-[10px] text-ocean/30">·</span>
                <span className="text-[10px] text-blush-dark/60">{idea.emotion}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {ideaSaved ? (
            <span className="h-8 flex items-center gap-1.5 px-3 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Als Idee gespeichert
            </span>
          ) : (
            <button
              onClick={onSaveAsIdea}
              disabled={ideaSaving}
              className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs text-ocean/70 border border-ocean/[0.08] bg-white hover:bg-warm-white/60 hover:text-ocean transition-colors disabled:opacity-50"
            >
              {ideaSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
              Als Idee speichern
            </button>
          )}
          <button
            onClick={onDevelop}
            className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-xs text-white bg-ocean hover:bg-ocean-light transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            Zu Skript ausformulieren
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-ocean/5">
          <div className="mt-3 rounded-xl bg-ocean/[0.02] border border-ocean/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-ocean/5">
              <p className="text-[9px] uppercase tracking-wider text-blush-dark/60 font-medium mb-1.5">Winkel</p>
              <p className="text-sm text-ocean/90 leading-relaxed">{idea.angle}</p>
            </div>
            {idea.hookDirection && (
              <div className="px-4 py-3 border-b border-ocean/5">
                <p className="text-[9px] uppercase tracking-wider text-ocean/40 font-medium mb-1.5">Hook-Richtung</p>
                <p className="text-sm text-ocean/75 leading-relaxed italic">{idea.hookDirection}</p>
              </div>
            )}
            {idea.keyPoints.length > 0 && (
              <div className="px-4 py-3 border-b border-ocean/5">
                <p className="text-[9px] uppercase tracking-wider text-ocean/40 font-medium mb-2">Kernpunkte</p>
                <ul className="space-y-1">
                  {idea.keyPoints.map((p, i) => (
                    <li key={i} className="text-sm text-ocean/75 leading-relaxed flex gap-2">
                      <span className="text-ocean/30 shrink-0">·</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {idea.whyNow && (
              <div className="px-4 py-3">
                <p className="text-[9px] uppercase tracking-wider text-green-600/60 font-medium mb-1.5">Warum jetzt</p>
                <p className="text-sm text-ocean/75 leading-relaxed">{idea.whyNow}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-blush-dark/60 rounded-md bg-blush/20 border border-blush/30 px-2 py-0.5">{idea.pillar}</span>
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
        {!script.hook && !script.cta && script.body && (
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
};

type ScriptTab = "scripts" | "ideas";

export default function ClientScriptsPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<ScriptTab>("scripts");

  // Client data
  const [client, setClient] = useState<Config | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [hasAudit, setHasAudit] = useState<boolean | null>(null);

  // Week generation — pipeline state
  const [weekIdeas, setWeekIdeas] = useState<WeekIdea[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [weekMeta, setWeekMeta] = useState<GenerationMeta | null>(null);
  const [weekReasoning, setWeekReasoning] = useState<string>("");
  const [developIdea, setDevelopIdea] = useState<WeekIdea | null>(null);
  // Stable-key Sets — key by ${day}-${title} so state survives reindexing
  const [savedIdeaKeys, setSavedIdeaKeys] = useState<Set<string>>(new Set());
  const [savingIdeaKey, setSavingIdeaKey] = useState<string | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);

  // Pipeline progress
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
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

  // Stable key per idea (survives array reindexing across regenerations)
  const ideaKey = useCallback((idea: WeekIdea) => `${idea.day}::${idea.title}`, []);

  // ── Save a generated idea to the Ideas tab ──────────────────────────────
  const saveIdeaToTab = async (idea: WeekIdea) => {
    const key = ideaKey(idea);
    if (savedIdeaKeys.has(key)) return;
    setSavingIdeaKey(key);
    try {
      const descParts: string[] = [];
      if (idea.angle) descParts.push(`Winkel: ${idea.angle}`);
      if (idea.hookDirection) descParts.push(`Hook-Richtung: ${idea.hookDirection}`);
      if (idea.keyPoints.length > 0) descParts.push(`Kernpunkte:\n${idea.keyPoints.map(p => `- ${p}`).join("\n")}`);
      if (idea.whyNow) descParts.push(`Warum jetzt: ${idea.whyNow}`);
      if (idea.emotion) descParts.push(`Emotion: ${idea.emotion}`);
      if (idea.day || idea.pillar || idea.format) {
        descParts.push(`Wochenplan: ${idea.day || "?"} · ${idea.pillar || "?"} · ${idea.format || "?"}`);
      }
      const description = descParts.join("\n\n");

      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: id,
          title: idea.title,
          description,
          contentType: idea.contentType,
          status: "idea",
        }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      setSavedIdeaKeys(prev => new Set(prev).add(key));
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSavingIdeaKey(null);
    }
  };

  // ── Generate full week of IDEAS (SSE streaming) ─────────────────────────
  const generateWeek = async () => {
    // Abort any in-flight generation before starting a new one
    if (generateAbortRef.current) {
      try { generateAbortRef.current.abort(); } catch {}
    }
    const abort = new AbortController();
    generateAbortRef.current = abort;

    setWeekLoading(true);
    setWeekError(null);
    setWeekIdeas([]);
    setWeekReasoning("");
    setWeekMeta(null);
    setPipelineStep("context");
    setSelectedTopics([]);
    setSavedIdeaKeys(new Set());
    setSavingIdeaKey(null);

    try {
      const res = await fetch(`/api/configs/${id}/generate-week-scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
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

          if (data.step === "error") {
            setWeekError(data.message || "Unbekannter Fehler");
            setPipelineStep("error");
          } else if (data.step === "voice" && data.status === "done") {
            // voice and context finish simultaneously on the server. Advance
            // UI to trends only after BOTH are in — skip the fake "voice" step.
            setPipelineStep("trends");
          } else if (data.step === "trends" && data.status === "done") {
            setPipelineStep("generate");
          } else if (data.step === "generate" && data.status === "done") {
            setSelectedTopics(data.ideaTitles || []);
          } else if (data.step === "done") {
            setPipelineStep("done");
            setWeekIdeas(data.ideas || []);
            setWeekReasoning(data.weekReasoning || "");
            setWeekMeta(data._meta || null);
          }
        }
      }
    } catch (e) {
      // AbortError (user navigated away or restarted) is expected — stay silent.
      if ((e as Error)?.name !== "AbortError") {
        setWeekError(e instanceof Error ? e.message : "Unbekannter Fehler");
        setPipelineStep("error");
      }
    } finally {
      setWeekLoading(false);
      if (generateAbortRef.current === abort) generateAbortRef.current = null;
    }
  };

  // Abort in-flight pipeline on unmount to prevent setState-on-unmounted-component
  useEffect(() => {
    return () => {
      if (generateAbortRef.current) {
        try { generateAbortRef.current.abort(); } catch {}
      }
    };
  }, []);

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
      {/* ── Generate Week Panel ───────────────────────────────────────────── */}
      <div className="rounded-2xl border border-blush/40 bg-gradient-to-br from-blush-light/20 to-white p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blush/30 border border-blush/50 shrink-0">
              <Sparkles className="h-5 w-5 text-blush-dark" />
            </div>
            <div>
              <p className="text-base font-semibold">Wochenideen generieren</p>
              <p className="text-xs text-ocean/60 mt-0.5">
                Opus plant 5 spezifische Video-Ideen für die Woche. Du wählst welche du zum Skript ausformulierst.
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
            : weekIdeas.length > 0
              ? <><Sparkles className="h-4 w-4" /> Neue Wochenideen</>
              : <><Sparkles className="h-4 w-4" /> Wochenideen generieren</>}
        </Button>

        {/* Pipeline Progress */}
        {(isPipelineActive || pipelineStep === "done" || pipelineStep === "error") && (
          <PipelineProgress
            currentStep={pipelineStep}
            topics={selectedTopics}
            error={weekError}
          />
        )}

        {/* Error outside pipeline */}
        {weekError && pipelineStep === "idle" && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{weekError}</p>
        )}

        {/* Generated ideas */}
        {weekIdeas.length > 0 && (
          <div className="space-y-3">
            {/* Meta info */}
            {weekMeta && (
              <div className="flex items-center gap-3 text-[11px] text-ocean/50 flex-wrap">
                {weekMeta.hasAudit && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Audit integriert</span>}
                {weekMeta.hasVoiceProfile && <span className="flex items-center gap-1"><Mic className="h-3 w-3 text-green-500" /> Stimmprofil aktiv</span>}
                {weekMeta.ownVideosUsed > 0 && <span>{weekMeta.ownVideosUsed} eigene Top-Videos</span>}
                {weekMeta.creatorVideosUsed > 0 && <span>{weekMeta.creatorVideosUsed} Competitor-Videos</span>}
              </div>
            )}

            {/* Week reasoning */}
            {weekReasoning && (
              <div className="flex gap-2.5 rounded-xl bg-amber-50/80 border border-amber-200/50 px-4 py-3">
                <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800/80 leading-relaxed">{weekReasoning}</p>
              </div>
            )}

            <p className="text-[11px] text-ocean/50 pt-1">
              {weekIdeas.length} Ideen für die Woche. Entweder direkt zu einem Skript ausformulieren, oder als Idee für später im Ideen-Tab speichern. Was du nicht aufnimmst, verwirfst sich beim Neugenerieren.
            </p>

            {/* Idea cards */}
            {weekIdeas.map((idea) => {
              const k = ideaKey(idea);
              return (
                <GeneratedIdeaCard
                  key={k}
                  idea={idea}
                  onDevelop={() => setDevelopIdea(idea)}
                  onSaveAsIdea={() => saveIdeaToTab(idea)}
                  ideaSaved={savedIdeaKeys.has(k)}
                  ideaSaving={savingIdeaKey === k}
                />
              );
            })}
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
            <div className="flex items-center gap-3 justify-end pt-2">
              <button onClick={() => setDialogOpen(false)} className="text-xs text-ocean/60 hover:text-ocean">Abbrechen</button>
              <Button onClick={handleSave} className="h-9 px-5 rounded-xl bg-ocean hover:bg-ocean-light border-0 text-white text-xs">
                Speichern
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Develop idea → script chat dialog */}
      {developIdea && (
        <DevelopIdeaDialog
          open={!!developIdea}
          onClose={() => { setDevelopIdea(null); loadScripts(); }}
          clientId={id}
          title={developIdea.title}
          subtitle={developIdea.angle}
          seedMessage={buildIdeaChatSeed(developIdea)}
          dialogKey={`${developIdea.day}-${developIdea.title}`}
          onScriptSaved={() => loadScripts()}
        />
      )}
      </>
      )}
    </div>
  );
}
