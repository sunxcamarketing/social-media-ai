"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sparkles,
  TrendingUp,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Heart,
  ExternalLink,
  Wand2,
  Brain,
  Layers,
  Target,
  FileText,
  ArrowRight,
  CalendarDays,
  Loader2,
  BarChart3,
  Lightbulb,
  Shield,
  CheckCircle2,
  Circle,
  Search,
  Users,
  Film,
  ChevronDown,
} from "lucide-react";
import { safeJsonParse } from "@/lib/safe-json";
import type { Config, Analysis } from "@/lib/types";
import { AuditReport, type ProfileData } from "@/components/audit-report";
import { useAudit } from "@/context/audit-context";
import type { PerformanceInsights, VideoInsight } from "@/lib/performance-helpers";
import { parseInsights } from "@/lib/performance-helpers";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { ContentType, ContentFormat } from "@/lib/strategy";
import { FormatPicker } from "@/components/format-picker";
import { useGeneration } from "@/context/generation-context";
import { useClientData } from "@/context/client-data-context";
import { useI18n } from "@/lib/i18n";
import { fmt } from "@/lib/format";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const GOAL_LABELS: Record<string, { label: string; description: string; color: string }> = {
  reach:   { label: "Reach",   description: "Education + Polarisation", color: "from-blue-500/20 to-cyan-500/20 border-blue-500/20 text-blue-400" },
  trust:   { label: "Trust",   description: "Story + Social Proof",     color: "from-green-500/20 to-emerald-500/20 border-green-500/20 text-green-600" },
  revenue: { label: "Revenue", description: "Authority + Social Proof", color: "from-amber-500/20 to-orange-500/20 border-amber-500/20 text-amber-400" },
};

const TYPE_COLORS: Record<string, string> = {
  "Authority":                 "bg-blush/20 text-blush-dark border-blush/40",
  "Story / Personality":       "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Social Proof":              "bg-green-50 text-green-600 border-green-200",
  "Education":                 "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Education / Value":         "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Polarisation":              "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Opinion / Polarisation":    "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Behind the Scenes":         "bg-slate-500/10 text-slate-400 border-slate-500/20",
  "Inspiration / Motivation":  "bg-blush/20 text-blush-dark border-blush/40",
  "Entertainment":             "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Community / Interaction":   "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Promotion / Offer":         "bg-blush/20 text-blush-dark border-blush/40",
};

interface StructuredSubTopic { title: string; angle: string; }
interface Pillar { name: string; why?: string; subTopics: string | StructuredSubTopic[]; }
// Edit form uses string-only subTopics
interface PillarForm { name: string; subTopics: string; }
interface DaySlot { type: string; format: string; pillar?: string; reason?: string; }
type WeeklyStructure = Record<string, DaySlot>;

function parsePillars(raw: string): Pillar[] {
  return safeJsonParse<Pillar[]>(raw, []);
}
function parseWeekly(raw: string): WeeklyStructure {
  return safeJsonParse<WeeklyStructure>(raw, {});
}
function VideoInsightCard({ video }: { video: VideoInsight }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass rounded-2xl overflow-hidden border border-ocean/[0.06]">
      <div className="flex gap-4 p-4">
        <div className="shrink-0 relative">
          {video.thumbnail ? (
            <img src={`/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`} alt="" className="h-20 w-14 rounded-xl object-cover" />
          ) : (
            <div className="h-20 w-14 rounded-xl bg-ocean/[0.02] flex items-center justify-center">
              <Eye className="h-4 w-4 text-ocean/60" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug line-clamp-2">{video.topic || "—"}</p>
            <a href={video.url} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-ocean/65 hover:text-ocean transition-colors mt-0.5">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-ocean">
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(video.views)}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(video.likes)}</span>
            <span>{video.datePosted}</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {video.audioHook && video.audioHook !== "none" && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-medium text-blush-dark uppercase tracking-wider shrink-0 mt-0.5">Audio</span>
                <p className="text-xs text-ocean italic leading-relaxed">&ldquo;{video.audioHook}&rdquo;</p>
              </div>
            )}
            {video.textHook && video.textHook !== "none" && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-medium text-red-500 uppercase tracking-wider shrink-0 mt-0.5">Text</span>
                <p className="text-xs text-ocean italic leading-relaxed">&ldquo;{video.textHook}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 pb-1 text-left text-[11px] text-ocean/60 hover:text-ocean transition-colors">
        {expanded ? t("strategy.hideAnalysis") : t("strategy.showAnalysis")}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/[0.06]">
          {video.scriptSummary && (
            <div>
              <p className="text-[10px] font-medium text-ocean uppercase tracking-wider mb-1">{t("strategy.scriptSummary")}</p>
              <p className="text-xs text-ocean leading-relaxed">{video.scriptSummary}</p>
            </div>
          )}
          {video.whyItWorked && (
            <div>
              <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider mb-1">{t("strategy.whyItWorked")}</p>
              <p className="text-xs text-ocean leading-relaxed">{video.whyItWorked}</p>
            </div>
          )}
          {video.howToReplicate && (
            <div>
              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-1">{t("strategy.howToReplicate")}</p>
              <p className="text-xs text-ocean leading-relaxed">{video.howToReplicate}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface StrategyForm {
  strategyGoal: string;
  pillars: PillarForm[];
  weekly: WeeklyStructure;
}

function StrategyEditDialog({ open, onClose, initial, onSave, contentTypes, formats, postsPerWeek }: {
  open: boolean; onClose: () => void;
  initial: StrategyForm; onSave: (f: StrategyForm) => Promise<void>;
  contentTypes: string[]; formats: string[];
  postsPerWeek: number;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<StrategyForm>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(initial); }, [open, initial]);

  const setPillar = (i: number, field: keyof PillarForm, val: string) => {
    const next = [...form.pillars];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, pillars: next });
  };
  const addPillar = () => {
    if (form.pillars.length >= 5) return;
    setForm({ ...form, pillars: [...form.pillars, { name: "", subTopics: "" } as PillarForm] });
  };
  const removePillar = (i: number) => setForm({ ...form, pillars: form.pillars.filter((_, idx) => idx !== i) });
  const setDay = (day: string, field: keyof DaySlot, val: string) =>
    setForm({ ...form, weekly: { ...form.weekly, [day]: { ...form.weekly[day], [field]: val } } });

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-ocean/[0.06]">
        <DialogHeader><DialogTitle>{t("strategyEdit.title")}</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <p className="text-xs font-medium text-ocean uppercase tracking-wider">{t("strategyEdit.primaryGoal")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.entries(GOAL_LABELS).map(([key, { label, description }]) => (
                <button key={key} type="button"
                  onClick={() => setForm({ ...form, strategyGoal: form.strategyGoal === key ? "" : key })}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    form.strategyGoal === key
                      ? "bg-blush/30 border-blush/40 text-ocean"
                      : "glass border-ocean/[0.06] text-ocean hover:border-ocean/[0.15]"
                  }`}>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[11px] mt-0.5 opacity-70">{description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 border-t border-ocean/[0.06] pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ocean uppercase tracking-wider">Content Pillars</p>
              {form.pillars.length < 5 && (
                <Button variant="ghost" size="sm" onClick={addPillar}
                  className="h-7 gap-1 text-xs rounded-lg px-2 text-ocean hover:text-ocean">
                  <Plus className="h-3 w-3" /> {t("strategyEdit.addPillar")}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {form.pillars.map((pillar, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input value={pillar.name} onChange={(e) => setPillar(i, "name", e.target.value)}
                      placeholder="Pillar-Name" className="rounded-xl glass border-ocean/[0.06] h-10 text-sm" />
                    <Input value={pillar.subTopics} onChange={(e) => setPillar(i, "subTopics", e.target.value)}
                      placeholder={t("strategyEdit.subTopics")} className="rounded-xl glass border-ocean/[0.06] h-10 text-sm" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removePillar(i)}
                    className="h-10 w-10 p-0 rounded-xl text-ocean hover:text-red-500 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {form.pillars.length === 0 && (
                <p className="text-xs text-ocean italic">{t("strategyEdit.noPillars")}</p>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-ocean/[0.06] pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ocean uppercase tracking-wider">{t("strategyEdit.weeklyStructure")}</p>
              <span className="flex items-center gap-1 text-[11px] text-ivory/80">
                <CalendarDays className="h-3 w-3" />
                {postsPerWeek} {t("strategy.postsPerWeek")}
              </span>
            </div>
            <div className="space-y-3">
              {ALL_DAYS.slice(0, postsPerWeek).map((day) => (
                <div key={day} className="space-y-1.5">
                  <span className="text-xs font-semibold text-ocean">{day}</span>
                  <div className="grid grid-cols-[180px_1fr] gap-2">
                    <select value={form.weekly[day]?.type || ""} onChange={(e) => setDay(day, "type", e.target.value)}
                      className="h-10 rounded-xl glass border border-ocean/[0.06] bg-transparent px-3 text-sm text-ocean focus:outline-none focus:border-ocean/20">
                      <option value="">— Content Type —</option>
                      {contentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="glass border border-ocean/[0.06] rounded-xl px-3 py-2 min-h-[40px]">
                      <FormatPicker
                        value={form.weekly[day]?.format || ""}
                        options={formats}
                        onChange={(val) => setDay(day, "format", val)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}
            className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0">
            {saving ? t("info.saving") : t("strategyEdit.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Strategy Pipeline Progress ───────────────────────────────────────────────

type StrategyPipelineStep = "context" | "analysis" | "strategy" | "review" | "done";

const STRATEGY_PIPELINE_STEPS: { key: StrategyPipelineStep; label: string; icon: React.ElementType }[] = [
  { key: "context", label: "Daten laden", icon: FileText },
  { key: "analysis", label: "Analyse & Ziel", icon: BarChart3 },
  { key: "strategy", label: "Pillars & Wochenplan", icon: Lightbulb },
  { key: "review", label: "Qualitätsprüfung", icon: Shield },
];

function StrategyPipelineProgress({
  currentStep,
  streamedGoal,
  streamedGoalReasoning,
  insightCount,
  pillarNames,
  reviewIssueCount,
  assessment,
}: {
  currentStep: StrategyPipelineStep | null;
  streamedGoal: string | null;
  streamedGoalReasoning: string | null;
  insightCount: number;
  pillarNames: string[];
  reviewIssueCount: number;
  assessment: string;
}) {
  const stepIndex = currentStep
    ? STRATEGY_PIPELINE_STEPS.findIndex(s => s.key === currentStep)
    : -1;
  const isDone = currentStep === "done";

  return (
    <div className="space-y-3">
      {STRATEGY_PIPELINE_STEPS.map((step, i) => {
        const isComplete = isDone || i < stepIndex;
        const isCurrent = !isDone && i === stepIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {isComplete ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 text-blush-dark animate-spin" />
              ) : (
                <Circle className="h-4 w-4 text-ocean/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${isComplete ? "text-green-500" : isCurrent ? "text-blush-dark" : "text-ocean/30"}`} />
                <span className={`text-sm ${isComplete ? "text-ocean" : isCurrent ? "text-ocean font-medium" : "text-ocean/40"}`}>
                  {step.label}
                  {step.key === "analysis" && isComplete && insightCount > 0 && (
                    <span className="ml-1.5 text-[10px] text-green-600">({insightCount} Erkenntnisse)</span>
                  )}
                  {step.key === "strategy" && isComplete && pillarNames.length > 0 && (
                    <span className="ml-1.5 text-[10px] text-green-600">({pillarNames.length} Pillars)</span>
                  )}
                  {step.key === "review" && isComplete && (
                    <span className="ml-1.5 text-[10px] text-green-600">
                      ({reviewIssueCount === 0 ? "alles gut" : `${reviewIssueCount} Korrekturen`})
                    </span>
                  )}
                </span>
              </div>
              {/* Show goal after analysis completes */}
              {step.key === "analysis" && isComplete && streamedGoal && (
                <div className="mt-1.5 ml-5">
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-medium border ${
                    GOAL_LABELS[streamedGoal]?.color || "bg-ocean/5 text-ocean border-ocean/10"
                  }`}>
                    Ziel: {GOAL_LABELS[streamedGoal]?.label || streamedGoal}
                  </span>
                  {streamedGoalReasoning && (
                    <p className="text-[11px] text-ocean/70 mt-1 leading-relaxed">{streamedGoalReasoning}</p>
                  )}
                </div>
              )}
              {/* Show pillar names after strategy completes */}
              {step.key === "strategy" && isComplete && pillarNames.length > 0 && (
                <div className="mt-1.5 ml-5 flex flex-wrap gap-1">
                  {pillarNames.map((name, pi) => (
                    <span key={pi} className="inline-flex items-center rounded-lg bg-blush/20 border border-blush/40 px-2 py-0.5 text-[10px] text-blush-dark">
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {/* Show assessment after review */}
              {step.key === "review" && isComplete && assessment && (
                <p className="mt-1.5 ml-5 text-[11px] text-ocean/70 leading-relaxed">{assessment}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StrategyMeta {
  contentTypeCount: number;
  formatCount: number;
  trainingCount: number;
  allContentTypes: ContentType[];
  allFormats: ContentFormat[];
}

export default function ClientStrategyPage() {
  const { t, lang } = useI18n();
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Config | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [meta, setMeta] = useState<StrategyMeta>({
    contentTypeCount: BUILT_IN_CONTENT_TYPES.length,
    formatCount: BUILT_IN_FORMATS.length,
    trainingCount: 0,
    allContentTypes: BUILT_IN_CONTENT_TYPES,
    allFormats: BUILT_IN_FORMATS,
  });

  // Audit state
  const { audit, startAudit, clearAudit } = useAudit(`client-${id}`);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [auditSaved, setAuditSaved] = useState(false);
  const [auditLang, setAuditLang] = useState<"de" | "en">("de");

  const auditRunning = audit?.running ?? false;
  const auditPhase = audit?.phase ?? "";
  const auditProfile = audit?.profile ?? null;
  const auditReport = audit?.report ?? "";
  const auditError = audit?.error ?? "";

  const { analysisGen, startAnalysis, clearAnalysisGen, strategyGen, startStrategyGeneration } = useGeneration();
  const analysisState = analysisGen.get(id);
  const analyzing = analysisState?.status === "running";
  const analyzeError = analysisState?.status === "error" ? (analysisState.error ?? "Analysis failed") : null;

  // SSE pipeline state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<StrategyPipelineStep | null>(null);
  const [streamedGoal, setStreamedGoal] = useState<string | null>(null);
  const [streamedGoalReasoning, setStreamedGoalReasoning] = useState<string | null>(null);
  const [insightCount, setInsightCount] = useState(0);
  const [pillarNames, setPillarNames] = useState<string[]>([]);
  const [reviewIssueCount, setReviewIssueCount] = useState(0);
  const [reviewAssessment, setReviewAssessment] = useState("");

  const { loadClient: loadClientCached } = useClientData();

  const loadClient = () => loadClientCached(id, true);

  useEffect(() => { loadClientCached(id).then(setClient); loadAnalyses(); }, [id]);

  // Reload client data when background tasks complete
  useEffect(() => {
    if (analysisState?.status === "done") {
      loadClient().then(setClient);
      clearAnalysisGen(id);
    }
  }, [analysisState?.status]);

  useEffect(() => {
    fetch("/api/strategy").then(r => r.json()).then((data: {
      customContentTypes: ContentType[];
      customFormats: ContentFormat[];
      trainingExamples: { id: string }[];
    }) => {
      const allCT = [...BUILT_IN_CONTENT_TYPES, ...(data.customContentTypes || [])];
      const allFmt = [...BUILT_IN_FORMATS, ...(data.customFormats || [])];
      setMeta({
        contentTypeCount: allCT.length,
        formatCount: allFmt.length,
        trainingCount: (data.trainingExamples || []).length,
        allContentTypes: allCT,
        allFormats: allFmt,
      });
    });
  }, []);

  // Audit helpers
  function loadAnalyses() {
    fetch(`/api/analyses?clientId=${id}`)
      .then((r) => r.json())
      .then((data: Analysis[]) => {
        setAnalyses(
          data.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      })
      .catch(() => {});
  }

  function getHandle(): string {
    const raw = client?.instagram || "";
    return raw.replace(/^@/, "").replace(/.*instagram\.com\/([^/?]+).*/, "$1").replace(/\/$/, "").trim();
  }

  function handleStartAudit() {
    const handle = getHandle();
    if (!handle) return;
    setAuditSaved(false);
    setExpandedAuditId(null);
    startAudit(handle, auditLang);
  }

  async function saveAudit() {
    if (!auditReport || !auditProfile) return;
    const handle = getHandle();
    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        instagramHandle: handle,
        lang: auditLang,
        report: auditReport,
        profileFollowers: auditProfile.followers,
        profileReels30d: auditProfile.reelsCount30d,
        profileAvgViews30d: auditProfile.avgViews30d,
        profilePicUrl: auditProfile.profilePicUrl || "",
      }),
    });
    if (res.ok) {
      setAuditSaved(true);
      clearAudit();
      loadAnalyses();
    }
  }

  async function deleteAnalysis(analysisId: string) {
    if (!confirm("Audit wirklich löschen?")) return;
    await fetch(`/api/analyses?id=${analysisId}`, { method: "DELETE" });
    if (expandedAuditId === analysisId) setExpandedAuditId(null);
    loadAnalyses();
  }

  function toggleAnalysis(analysisId: string) {
    setExpandedAuditId((prev) => (prev === analysisId ? null : analysisId));
  }

  // Auto-save when audit completes
  useEffect(() => {
    if (auditReport && !auditRunning && !auditSaved && auditProfile) {
      saveAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditReport, auditRunning]);

  const auditPhaseLabels: Record<string, string> = {
    scraping: "Profil wird geladen…",
    reels: "Videos werden analysiert…",
    analyzing: "Audit wird erstellt…",
    done: "Fertig!",
  };

  const runAnalysis = () => { startAnalysis(id); };

  const generateStrategy = () => {
    setGenerating(true);
    setGenerateError(null);
    setPipelineStep("context");
    setStreamedGoal(null);
    setStreamedGoalReasoning(null);
    setInsightCount(0);
    setPillarNames([]);
    setReviewIssueCount(0);
    setReviewAssessment("");

    // Fire-and-forget: runs in the GenerationProvider context, survives tab switches.
    startStrategyGeneration(id);
  };

  // Watch the context-level strategy state. When it completes or errors,
  // update local UI state and reload the client data.
  const strategyState = strategyGen.get(id);
  useEffect(() => {
    if (!strategyState) return;
    if (strategyState.status === "done") {
      setPipelineStep("done");
      setGenerating(false);
      loadClient().then(setClient);
    } else if (strategyState.status === "error") {
      setGenerateError(strategyState.error || "Fehler bei der Generierung");
      setGenerating(false);
    }
  }, [strategyState?.status]);

  // If we navigate back to this page while strategy is still running, restore the generating state.
  useEffect(() => {
    if (strategyState?.status === "running") {
      setGenerating(true);
      setPipelineStep("context");
    }
  }, []);

  const saveStrategy = async (form: StrategyForm) => {
    if (!client) return;
    await fetch("/api/configs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...client,
        strategyGoal: form.strategyGoal,
        strategyPillars: JSON.stringify(form.pillars),
        strategyWeekly: JSON.stringify(form.weekly),
      }),
    });
    loadClient().then(setClient);
  };

  if (!client) {
    return <div className="flex items-center justify-center h-64 text-ocean text-sm">{t("common.loading")}</div>;
  }

  const pillars = parsePillars(client.strategyPillars);
  const weeklyRaw = parseWeekly(client.strategyWeekly);
  const strategyReasoning = (weeklyRaw as Record<string, unknown>)._reasoning as string | undefined;
  const { _reasoning, ...weekly } = weeklyRaw as WeeklyStructure & { _reasoning?: string };
  const goal = GOAL_LABELS[client.strategyGoal];
  const insights = parseInsights(client.performanceInsights);
  const hasStrategy = client.strategyGoal || pillars.length > 0;
  const postsPerWeek = Math.min(7, Math.max(1, parseInt(client.postsPerWeek || "5", 10)));
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);

  const strategyInitial: StrategyForm = {
    strategyGoal: client.strategyGoal || "",
    pillars: pillars.length > 0 ? pillars.map(p => ({
      ...p,
      subTopics: Array.isArray(p.subTopics)
        ? p.subTopics.map((st: StructuredSubTopic) => st.title).join(", ")
        : p.subTopics,
    })) : [{ name: "", subTopics: "" }],
    weekly: Object.fromEntries(activeDays.map((d) => [d, weekly[d] || { type: "", format: "" }])),
  };

  // Which types are used in the weekly plan
  const usedTypeNames = [...new Set(activeDays.map(d => weekly[d]?.type).filter(Boolean))];
  const usedTypeObjects = usedTypeNames.map(name =>
    meta.allContentTypes.find(t => t.name === name)
  ).filter(Boolean) as ContentType[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("strategy.title")}</h1>
        <p className="mt-1 text-sm text-ocean">{t("strategy.subtitle")}</p>
      </div>

      {/* Framework Connection Strip */}
      <div className="rounded-2xl border border-blush/40 bg-gradient-to-r from-blush/10 to-ocean/[0.02] px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blush-dark shrink-0" />
            <p className="text-xs font-medium text-blush-dark">{t("strategy.frameworkActive")}</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-ocean flex-wrap">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 text-ivory" />
              <span>
                <select
                  value={postsPerWeek}
                  onChange={async (e) => {
                    const val = e.target.value;
                    await fetch("/api/configs", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...client, postsPerWeek: val }),
                    });
                    setClient((c) => c ? { ...c, postsPerWeek: val } : c);
                  }}
                  className="bg-transparent border-none text-ivory font-bold text-[11px] cursor-pointer focus:outline-none hover:text-ivory/80 transition-colors"
                >
                  {[1,2,3,4,5,6,7].map((n) => (
                    <option key={n} value={n} className="bg-white/80 text-ocean">{n}×</option>
                  ))}
                </select>
                {" "}{t("strategy.perWeek")}
              </span>
            </span>
            <span className="text-ocean/[0.15]">·</span>
            <span className="flex items-center gap-1.5">
              <Target className="h-3 w-3 text-blue-400" />
              <span><strong className="text-ocean">{meta.contentTypeCount}</strong> Content Types</span>
            </span>
            <span className="text-ocean/[0.15]">·</span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-green-600" />
              <span><strong className="text-ocean">{meta.formatCount}</strong> {t("strategy.formats")}</span>
            </span>
            <span className="text-ocean/[0.15]">·</span>
            <span className="flex items-center gap-1.5">
              <Brain className="h-3 w-3 text-blush-dark" />
              <span>
                <strong className={meta.trainingCount > 0 ? "text-blush-dark" : "text-ocean"}>
                  {meta.trainingCount}
                </strong>{" "}
                {t("strategy.trainingExamples")}
              </span>
            </span>
            <a href="/strategy" className="flex items-center gap-1 text-blush-dark/70 hover:text-blush-dark transition-colors ml-1">
              {t("strategy.viewFramework")} <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>
        {/* Formula mini */}
        <div className="mt-3 flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 rounded-lg bg-blush/20 border border-blush/40 px-2 py-0.5">
            <Layers className="h-2.5 w-2.5 text-blush-dark" /><span className="text-blush-dark font-medium">PILLAR</span>
          </span>
          <span className="text-ocean/65">+</span>
          <span className="flex items-center gap-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-0.5">
            <Target className="h-2.5 w-2.5 text-blue-400" /><span className="text-blue-300 font-medium">TYPE</span>
          </span>
          <span className="text-ocean/65">+</span>
          <span className="flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 px-2 py-0.5">
            <FileText className="h-2.5 w-2.5 text-green-600" /><span className="text-green-600 font-medium">FORMAT</span>
          </span>
          <span className="text-ocean/65">=</span>
          <span className="text-ocean font-medium">CONTENT</span>
        </div>
      </div>

      {/* Instagram Audit */}
      <div className="glass rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-blush-dark" /> Instagram Audit
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={auditLang}
              onChange={(e) => setAuditLang(e.target.value as "de" | "en")}
              className="h-8 rounded-xl border border-ocean/10 bg-warm-white px-3 text-xs text-ocean focus:outline-none focus:border-blush"
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStartAudit}
              disabled={auditRunning || !getHandle()}
              className="h-8 gap-1.5 rounded-lg px-3 text-xs text-ocean hover:text-ocean"
            >
              {auditRunning ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Audit läuft…</>
              ) : (
                <><Search className="h-3 w-3" /> {analyses.length > 0 ? "Neuer Audit" : "Audit starten"}</>
              )}
            </Button>
          </div>
        </div>

        {!getHandle() && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Kein Instagram-Handle hinterlegt. Bitte zuerst unter &quot;Informationen&quot; den Instagram-Handle eintragen.
          </div>
        )}

        {/* Audit Progress */}
        {auditRunning && (
          <div className="rounded-xl bg-gradient-to-r from-ocean to-ocean-light p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{auditPhaseLabels[auditPhase] || auditPhase}</p>
                <p className="text-xs text-white/50">Du kannst in der Zwischenzeit andere Tabs nutzen</p>
              </div>
            </div>
            {auditProfile && (
              <div className="flex items-center gap-4 rounded-xl bg-white/10 px-4 py-3">
                {auditProfile.profilePicUrl && (
                  <img src={`/api/proxy-image?url=${encodeURIComponent(auditProfile.profilePicUrl)}`} alt="" className="h-10 w-10 rounded-full object-cover border border-white/20" />
                )}
                <div className="flex items-center gap-4 text-xs text-white/70">
                  <span className="font-medium text-white">@{auditProfile.username}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{fmt(auditProfile.followers)}</span>
                  <span className="flex items-center gap-1"><Film className="h-3 w-3" />{auditProfile.reelsCount30d} Reels</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(auditProfile.avgViews30d)} Ø</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span className={auditPhase === "scraping" || auditPhase === "reels" || auditPhase === "analyzing" ? "text-white" : ""}>Scraping</span>
              <span>→</span>
              <span className={auditPhase === "reels" || auditPhase === "analyzing" ? "text-white" : ""}>Videos</span>
              <span>→</span>
              <span className={auditPhase === "analyzing" ? "text-white" : ""}>Audit erstellen</span>
            </div>
          </div>
        )}

        {/* Audit Error */}
        {auditError && !auditRunning && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{auditError}</div>
        )}

        {/* Just-completed report (auto-saved) */}
        {auditReport && !auditRunning && (
          <div className="space-y-3">
            {auditSaved && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                Audit automatisch gespeichert
              </div>
            )}
            <AuditReport report={auditReport} profile={auditProfile} saved />
          </div>
        )}

        {/* Saved Audits (accordion) */}
        {!auditRunning && (
          <div className="space-y-3">
            {analyses.length > 0 ? (
              <>
                <p className="text-[11px] font-medium text-ocean uppercase tracking-wider">Gespeicherte Audits</p>
                <div className="space-y-2">
                  {analyses.map((a) => {
                    const isOpen = expandedAuditId === a.id;
                    return (
                      <div key={a.id} className="rounded-xl border border-ocean/[0.06] overflow-hidden transition-all">
                        <div
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-ocean/[0.02] transition-colors"
                          onClick={() => toggleAnalysis(a.id)}
                        >
                          <div className="flex items-center gap-3">
                            {a.profilePicUrl && (
                              <img
                                src={`/api/proxy-image?url=${encodeURIComponent(a.profilePicUrl)}`}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <CalendarDays className="h-3 w-3 text-ocean/40" />
                                <span className="text-xs font-semibold text-ocean">
                                  {new Date(a.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-ocean/50 mt-0.5">
                                <span>@{a.instagramHandle}</span>
                                <span>{fmt(a.profileFollowers)} Follower</span>
                                <span>{a.profileReels30d} Reels</span>
                                <span>{fmt(a.profileAvgViews30d)} Ø Views</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/30 hover:text-red-500 hover:bg-red-50 transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                            <ChevronDown className={`h-4 w-4 text-ocean/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                          </div>
                        </div>

                        {isOpen && (
                          <div className="border-t border-ocean/[0.06] px-4 py-4">
                            <AuditReport
                              report={a.report}
                              profile={{
                                username: a.instagramHandle,
                                followers: a.profileFollowers,
                                reelsCount30d: a.profileReels30d,
                                avgViews30d: a.profileAvgViews30d,
                                profilePicUrl: a.profilePicUrl,
                              }}
                              saved
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : !auditReport && getHandle() ? (
              <div className="text-center py-6">
                <Search className="mx-auto h-7 w-7 text-ocean/20 mb-2" />
                <p className="text-sm text-ocean/70">Noch kein Audit vorhanden.</p>
                <p className="text-xs text-ocean/50 mt-1">Starte einen Audit um einen detaillierten Report zu erhalten.</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Performance Analysis */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" /> {t("strategy.performance")}
            </h2>
            {insights && (
              <p className="text-[11px] text-ocean mt-0.5">
                {t("strategy.lastAnalyzed")} {insights.scrapedAt} · {t("strategy.last")} {insights.scrapeWindowDays ?? 365} {t("strategy.days")}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={runAnalysis} disabled={analyzing}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-ocean hover:text-ocean">
            <RefreshCw className={`h-3 w-3 ${analyzing ? "animate-spin" : ""}`} />
            {analyzing ? t("strategy.analyzing") : insights ? t("strategy.reanalyze") : t("strategy.analyze")}
          </Button>
        </div>

        {analyzeError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-500">
            {analyzeError}
          </div>
        )}

        {analyzing && (
          <div className="space-y-2 text-sm text-ocean">
            <p>{t("strategy.scrapingProfile")}</p>
            <p>{t("strategy.downloadingVideos")}</p>
            <p>{t("strategy.analyzingHooks")}</p>
            <p className="text-[11px] opacity-60">{t("strategy.analysisDuration")}</p>
          </div>
        )}

        {!analyzing && !insights && !analyzeError && (
          <div className="text-center py-8">
            <TrendingUp className="mx-auto h-8 w-8 text-ocean/20 mb-3" />
            <p className="text-sm text-ocean">{t("strategy.noAnalysis")}</p>
            <p className="text-xs text-ocean/60 mt-1">
              {t("strategy.analyzeHint")}
            </p>
          </div>
        )}

        {!analyzing && insights && (
          <div className="space-y-6">
            {insights.top30Days.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-green-600 uppercase tracking-wider mb-3">{t("strategy.topLast30")}</p>
                <div className="space-y-3">
                  {insights.top30Days.map((v, i) => <VideoInsightCard key={i} video={v} />)}
                </div>
              </div>
            )}
            {insights.topAllTime.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-blush-dark uppercase tracking-wider mb-3">
                  {t("strategy.topLast")} {insights.scrapeWindowDays ? `${insights.scrapeWindowDays} ${t("strategy.days")}` : t("scripts.12months")} {t("strategy.excludingLast30")}
                </p>
                <div className="space-y-3">
                  {insights.topAllTime.map((v, i) => <VideoInsightCard key={i} video={v} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content Strategy */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ivory" /> {t("strategy.contentStrategy")}
          </h2>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={generateStrategy} disabled={generating}
              className="h-8 gap-1.5 rounded-lg px-3 text-xs text-blush-dark hover:text-blush-dark hover:bg-blush/20 disabled:opacity-40">
              {generating
                ? <><Loader2 className="h-3 w-3 animate-spin" /> {t("strategy.generating")}</>
                : <><Wand2 className="h-3 w-3" /> {hasStrategy ? "Neu generieren" : t("strategy.generateWithAI")}</>
              }
            </Button>
            {hasStrategy && (
              <Button variant="ghost" size="sm" onClick={() => setStrategyOpen(true)}
                className="h-8 gap-1.5 rounded-lg px-3 text-xs text-ocean hover:text-ocean">
                <Pencil className="h-3 w-3" /> {t("common.edit")}
              </Button>
            )}
          </div>
        </div>

        {generateError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-500">
            {generateError}
          </div>
        )}
        {generating && pipelineStep && (
          <div className="rounded-xl bg-blush/10 border border-blush/40 px-5 py-4">
            <StrategyPipelineProgress
              currentStep={pipelineStep}
              streamedGoal={streamedGoal}
              streamedGoalReasoning={streamedGoalReasoning}
              insightCount={insightCount}
              pillarNames={pillarNames}
              reviewIssueCount={reviewIssueCount}
              assessment={reviewAssessment}
            />
          </div>
        )}

        {!generating && !hasStrategy ? (
          <div className="text-center py-8">
            <Wand2 className="mx-auto h-8 w-8 text-ocean/20 mb-3" />
            <p className="text-sm text-ocean">{t("strategy.noStrategy")}</p>
            <p className="text-xs text-ocean/60 mt-1 mb-4">
              {t("strategy.aiSuggestion")}
              {meta.trainingCount > 0 && ` und ${meta.trainingCount} ${t("strategy.savedTraining")}`}.
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={generateStrategy} disabled={generating}
                className="rounded-xl h-9 gap-1.5 bg-ocean hover:bg-ocean-light border-0 text-xs">
                <Wand2 className="h-3 w-3" /> {t("strategy.generateWithAI")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStrategyOpen(true)}
                className="rounded-xl h-9 gap-1 text-xs text-ocean hover:text-ocean">
                <Plus className="h-3 w-3" /> {t("strategy.addManually")}
              </Button>
            </div>
          </div>
        ) : !generating && (
          <div className="space-y-6">

            {/* Goal + Reasoning */}
            {goal && (
              <div>
                <p className="text-[11px] text-ocean uppercase tracking-wider mb-2">{t("strategy.primaryGoal")}</p>
                <div className={`inline-flex items-center gap-2 rounded-xl border bg-gradient-to-br px-4 py-2 ${goal.color}`}>
                  <span className="text-sm font-semibold">{goal.label}</span>
                  <span className="text-xs opacity-70">→ {goal.description}</span>
                </div>
                {strategyReasoning && (
                  <div className="mt-3 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-4 py-3">
                    <p className="text-[10px] font-medium text-blush-dark uppercase tracking-wider mb-1">AI Begründung</p>
                    <p className="text-xs text-ocean leading-relaxed">{String(strategyReasoning)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Content Pillars */}
            {pillars.filter(p => p.name).length > 0 && (
              <div>
                <p className="text-[11px] text-ocean uppercase tracking-wider mb-3">{t("strategy.contentPillars")}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pillars.filter(p => p.name).map((pillar, i) => (
                    <div key={i} className="rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blush/30 text-[10px] font-bold text-blush-dark">{i + 1}</span>
                        <p className="text-sm font-medium">{pillar.name}</p>
                      </div>
                      {pillar.why && (
                        <p className="text-[11px] text-ocean/70 mt-1 pl-7 italic">{pillar.why}</p>
                      )}
                      {pillar.subTopics && (
                        Array.isArray(pillar.subTopics) ? (
                          <div className="mt-2 pl-7 space-y-1.5">
                            {pillar.subTopics.map((st: StructuredSubTopic, si: number) => (
                              <div key={si} className="flex items-start gap-1.5">
                                <span className="text-ocean/30 text-[10px] mt-0.5">•</span>
                                <div>
                                  <p className="text-xs text-ocean font-medium leading-snug">{st.title}</p>
                                  {st.angle && <p className="text-[10px] text-ocean/60 leading-snug">{st.angle}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-ocean mt-2 leading-relaxed pl-7">{pillar.subTopics}</p>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Editorial Calendar */}
            {activeDays.some(d => weekly[d]?.type) && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] text-ocean uppercase tracking-wider">{t("strategy.weeklyCalendar")}</p>
                  <span className="flex items-center gap-1 text-[11px] text-ivory/80">
                    <CalendarDays className="h-3 w-3" />
                    {postsPerWeek} {t("strategy.postsPerWeek")}
                  </span>
                </div>
                <div className="rounded-2xl border border-ocean/[0.06] overflow-hidden">
                  {activeDays.map((day, i) => {
                    const slot = weekly[day];
                    if (!slot?.type) return null;
                    const colorClass = TYPE_COLORS[slot.type] || "bg-ocean/[0.02] text-ocean border-ocean/[0.06]";
                    return (
                      <div
                        key={day}
                        className={`flex items-center gap-4 px-5 py-3.5 ${
                          i > 0 ? "border-t border-ocean/[0.06]" : ""
                        } hover:bg-ocean/[0.01] transition-colors`}
                      >
                        {/* Day */}
                        <span className="w-10 text-sm font-semibold text-ocean shrink-0">{day}</span>
                        {/* Type badge */}
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-medium shrink-0 ${colorClass}`}>
                          {slot.type}
                        </span>
                        {/* Format */}
                        <span className="text-xs text-ocean/50 shrink-0">
                          {slot.format || ""}
                        </span>
                        {/* Pillar */}
                        <span className="text-xs text-ocean/70 font-medium flex-1 text-right truncate">
                          {slot.pillar || ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Reasoning toggle — hidden by default, expandable */}
                {activeDays.some(d => weekly[d]?.reason) && (
                  <details className="mt-3">
                    <summary className="text-[11px] text-ocean/40 cursor-pointer hover:text-ocean/60 transition-colors">
                      Begründungen anzeigen
                    </summary>
                    <div className="mt-2 space-y-2">
                      {activeDays.map((day) => {
                        const slot = weekly[day];
                        if (!slot?.reason) return null;
                        return (
                          <div key={day} className="flex gap-2 text-[11px]">
                            <span className="font-medium text-ocean/60 w-10 shrink-0">{day}</span>
                            <span className="text-ocean/45 leading-relaxed">{slot.reason}</span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Used Content Types — from the framework */}
            {usedTypeObjects.length > 0 && (
              <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 p-4 space-y-3">
                <p className="text-[10px] font-medium text-ocean uppercase tracking-wider">
                  {t("strategy.contentTypesUsed")}
                </p>
                <div className="space-y-2">
                  {usedTypeObjects.map((t) => {
                    const color = TYPE_COLORS[t.name] || "bg-ocean/[0.02] text-ocean border-ocean/[0.06]";
                    return (
                      <div key={t.id} className="flex items-start gap-3">
                        <span className={`inline-flex shrink-0 items-center rounded-lg border px-2 py-0.5 text-[10px] font-medium mt-0.5 ${color}`}>
                          {t.name}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] text-ocean leading-snug">{t.goal}</p>
                          <p className="text-[10px] text-ocean/70 leading-snug">{t.bestFor}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <StrategyEditDialog
        open={strategyOpen}
        onClose={() => setStrategyOpen(false)}
        initial={strategyInitial}
        onSave={saveStrategy}
        contentTypes={meta.allContentTypes.map(t => t.name)}
        formats={meta.allFormats.map(f => f.name)}
        postsPerWeek={postsPerWeek}
      />
    </div>
  );
}
