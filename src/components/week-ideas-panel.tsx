"use client";

import { useEffect, useState } from "react";
import {
  FileText, Sparkles, Loader2, ChevronDown, Lightbulb, CheckCircle2,
  AlertTriangle, Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DevelopIdeaDialog } from "@/components/develop-idea-dialog";
import {
  useWeekIdeasStream,
  type WeekIdea,
  type WeekIdeasPipelineStep,
  type WeekIdeasTopic,
} from "@/hooks/use-week-ideas-stream";

const DAY_SHORT: Record<string, string> = {
  Mon: "Mo", Tue: "Di", Wed: "Mi", Thu: "Do", Fri: "Fr", Sat: "Sa", Sun: "So",
};

const PIPELINE_STEPS: { key: WeekIdeasPipelineStep; label: string; icon: React.ElementType }[] = [
  { key: "context", label: "Kontext + Stimmprofil laden", icon: FileText },
  { key: "trends", label: "Trend-Recherche", icon: Lightbulb },
  { key: "generate", label: "Ideen entwickeln (Opus)", icon: Mic },
];

interface WeekIdeasPanelProps {
  clientId: string;
  hasAudit: boolean | null;
  /** Called when a script gets saved from the develop dialog — caller refreshes its list. */
  onScriptSaved?: () => void;
}

/**
 * Full week-ideas generation surface: the "Wochenideen generieren" button,
 * pipeline progress, generated idea cards (each with "Save as idea" and
 * "Develop into script"), and the develop-dialog.
 *
 * Owns the SSE stream via useWeekIdeasStream, and the per-idea UI state
 * (saved keys, developing idea) keyed stably by ${day}::${title}.
 */
export function WeekIdeasPanel({ clientId, hasAudit, onScriptSaved }: WeekIdeasPanelProps) {
  const {
    ideas: weekIdeas, reasoning: weekReasoning, meta: weekMeta,
    topics: selectedTopics, step: pipelineStep, loading: weekLoading,
    error: weekError, generate: generateWeek, ideaKey,
  } = useWeekIdeasStream({ clientId });

  const [developIdea, setDevelopIdea] = useState<WeekIdea | null>(null);
  const [savedIdeaKeys, setSavedIdeaKeys] = useState<Set<string>>(new Set());
  const [savingIdeaKey, setSavingIdeaKey] = useState<string | null>(null);

  useEffect(() => {
    setSavedIdeaKeys(new Set());
    setSavingIdeaKey(null);
  }, [weekIdeas]);

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
          clientId, title: idea.title, description, contentType: idea.contentType, status: "idea",
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

  const isPipelineActive = pipelineStep !== "idle" && pipelineStep !== "done" && pipelineStep !== "error";

  return (
    <>
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

        {(isPipelineActive || pipelineStep === "done" || pipelineStep === "error") && (
          <PipelineProgress currentStep={pipelineStep} topics={selectedTopics} error={weekError} />
        )}

        {weekError && pipelineStep === "idle" && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{weekError}</p>
        )}

        {weekIdeas.length > 0 && (
          <div className="space-y-3">
            {weekMeta && (
              <div className="flex items-center gap-3 text-[11px] text-ocean/50 flex-wrap">
                {weekMeta.hasAudit && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" /> Audit integriert</span>}
                {weekMeta.hasVoiceProfile && <span className="flex items-center gap-1"><Mic className="h-3 w-3 text-green-500" /> Stimmprofil aktiv</span>}
                {weekMeta.ownVideosUsed > 0 && <span>{weekMeta.ownVideosUsed} eigene Top-Videos</span>}
                {weekMeta.creatorVideosUsed > 0 && <span>{weekMeta.creatorVideosUsed} Competitor-Videos</span>}
              </div>
            )}

            {weekReasoning && (
              <div className="flex gap-2.5 rounded-xl bg-amber-50/80 border border-amber-200/50 px-4 py-3">
                <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800/80 leading-relaxed">{weekReasoning}</p>
              </div>
            )}

            <p className="text-[11px] text-ocean/50 pt-1">
              {weekIdeas.length} Ideen für die Woche. Entweder direkt zu einem Skript ausformulieren, oder als Idee für später im Ideen-Tab speichern. Was du nicht aufnimmst, verwirfst sich beim Neugenerieren.
            </p>

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

      {developIdea && (
        <DevelopIdeaDialog
          open={!!developIdea}
          onClose={() => { setDevelopIdea(null); onScriptSaved?.(); }}
          clientId={clientId}
          title={developIdea.title}
          subtitle={developIdea.angle}
          seedMessage={buildIdeaChatSeed(developIdea)}
          dialogKey={`${developIdea.day}-${developIdea.title}`}
          onScriptSaved={onScriptSaved}
        />
      )}
    </>
  );
}

// ── Internals ───────────────────────────────────────────────────────────────

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

function PipelineProgress({
  currentStep, topics, error,
}: {
  currentStep: WeekIdeasPipelineStep;
  topics: WeekIdeasTopic[];
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

function GeneratedIdeaCard({
  idea, onDevelop, onSaveAsIdea, ideaSaved, ideaSaving,
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
