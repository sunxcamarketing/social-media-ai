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
} from "lucide-react";
import { Loader2 } from "lucide-react";
import type { Config } from "@/lib/types";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { ContentType, ContentFormat } from "@/lib/strategy";
import { FormatPicker } from "@/components/format-picker";
import { useGeneration } from "@/context/generation-context";
import { useI18n } from "@/lib/i18n";

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

interface Pillar { name: string; subTopics: string; }
interface DaySlot { type: string; format: string; reason?: string; }
type WeeklyStructure = Record<string, DaySlot>;

function parsePillars(raw: string): Pillar[] {
  try { return JSON.parse(raw) || []; } catch { return []; }
}
function parseWeekly(raw: string): WeeklyStructure {
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}
function parseInsights(raw: string): PerformanceInsights | null {
  try { return JSON.parse(raw) || null; } catch { return null; }
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function VideoInsightCard({ video }: { video: VideoInsight }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass rounded-2xl overflow-hidden border border-ocean/[0.06]">
      <div className="flex gap-4 p-4">
        <div className="shrink-0 relative">
          {video.thumbnail ? (
            <img src={video.thumbnail} alt="" className="h-20 w-14 rounded-xl object-cover" />
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
        {expanded ? "Hide analysis ↑" : "Show analysis ↓"}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/[0.06]">
          {video.scriptSummary && (
            <div>
              <p className="text-[10px] font-medium text-ocean uppercase tracking-wider mb-1">Script</p>
              <p className="text-xs text-ocean leading-relaxed">{video.scriptSummary}</p>
            </div>
          )}
          {video.whyItWorked && (
            <div>
              <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider mb-1">Why it worked</p>
              <p className="text-xs text-ocean leading-relaxed">{video.whyItWorked}</p>
            </div>
          )}
          {video.howToReplicate && (
            <div>
              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-1">How to replicate</p>
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
  pillars: Pillar[];
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

  const setPillar = (i: number, field: keyof Pillar, val: string) => {
    const next = [...form.pillars];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, pillars: next });
  };
  const addPillar = () => {
    if (form.pillars.length >= 5) return;
    setForm({ ...form, pillars: [...form.pillars, { name: "", subTopics: "" }] });
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
            <div className="grid grid-cols-3 gap-2">
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
                  <div className="flex-1 grid grid-cols-2 gap-2">
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

  const { strategyGen, startStrategyGeneration, clearStrategyGen, analysisGen, startAnalysis, clearAnalysisGen } = useGeneration();
  const strategyState = strategyGen.get(id);
  const analysisState = analysisGen.get(id);
  const generating = strategyState?.status === "running";
  const analyzing = analysisState?.status === "running";
  const generateError = strategyState?.status === "error" ? (strategyState.error ?? "Generation failed") : null;
  const analyzeError = analysisState?.status === "error" ? (analysisState.error ?? "Analysis failed") : null;

  const loadClient = () =>
    fetch(`/api/configs/${id}`).then((r) => r.json() as Promise<Config>);

  useEffect(() => { loadClient().then(setClient); }, [id]);

  // Reload client data when background tasks complete
  useEffect(() => {
    if (strategyState?.status === "done") {
      loadClient().then(setClient);
      clearStrategyGen(id);
    }
  }, [strategyState?.status]);

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

  const runAnalysis = () => { startAnalysis(id); };
  const generateStrategy = () => { startStrategyGeneration(id); };

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
    pillars: pillars.length > 0 ? pillars : [{ name: "", subTopics: "" }],
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
        {generating && (
          <div className="rounded-xl bg-blush/10 border border-blush/40 px-4 py-3 space-y-1">
            <p className="text-sm text-ocean">{t("strategy.aiGenerating")}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {insights && (
                <span className="text-[10px] bg-green-50 text-green-600 border border-green-200 rounded-full px-2 py-0.5">Performance-Daten</span>
              )}
              {meta.trainingCount > 0 && (
                <span className="text-[10px] bg-blush/20 text-blush-dark border border-blush/40 rounded-full px-2 py-0.5">{meta.trainingCount} Training Examples</span>
              )}
              <span className="text-[10px] bg-ocean/5 text-ocean/70 border border-ocean/10 rounded-full px-2 py-0.5">Client-Profil</span>
              <span className="text-[10px] bg-blue-50 text-blue-500 border border-blue-200 rounded-full px-2 py-0.5">Audit + Competitor</span>
            </div>
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
                      {pillar.subTopics && (
                        <p className="text-xs text-ocean mt-2 leading-relaxed pl-7">{pillar.subTopics}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Editorial Calendar */}
            {activeDays.some(d => weekly[d]?.type) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] text-ocean uppercase tracking-wider">{t("strategy.weeklyCalendar")}</p>
                  <span className="flex items-center gap-1 text-[11px] text-ivory/80">
                    <CalendarDays className="h-3 w-3" />
                    {postsPerWeek} {t("strategy.postsPerWeek")}
                  </span>
                </div>
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${postsPerWeek}, minmax(0, 1fr))` }}>
                  {activeDays.map((day) => {
                    const slot = weekly[day];
                    const colorClass = slot?.type
                      ? TYPE_COLORS[slot.type] || "bg-ocean/[0.02] text-ocean border-ocean/[0.06]"
                      : "";
                    const typeObj = slot?.type
                      ? meta.allContentTypes.find(t => t.name === slot.type)
                      : null;
                    const formats = slot?.format
                      ? slot.format.split(" + ").map(s => s.trim()).filter(Boolean)
                      : [];

                    return (
                      <div key={day} className="space-y-1.5">
                        <p className="text-[11px] font-medium text-ocean text-center">{day}</p>
                        {slot?.type ? (
                          <div className={`rounded-xl border px-2.5 py-3 space-y-2 ${colorClass}`}>
                            {/* Type */}
                            <div>
                              <p className="text-[11px] font-bold leading-tight">{slot.type}</p>
                              {typeObj?.goal && (
                                <p className="text-[10px] opacity-55 mt-0.5 leading-snug">{typeObj.goal}</p>
                              )}
                            </div>
                            {/* Formats */}
                            {formats.length > 0 && (
                              <div className="border-t border-current/10 pt-2 space-y-1">
                                {formats.map((f, fi) => (
                                  <div key={fi} className="flex items-center gap-1">
                                    {fi > 0 && <span className="text-[9px] opacity-40 font-bold">+</span>}
                                    <span className="text-[10px] opacity-65 leading-tight">{f}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Reason */}
                            {slot.reason && (
                              <div className="border-t border-current/10 pt-2">
                                <p className="text-[9px] opacity-50 leading-snug italic">{slot.reason}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-ocean/[0.06] px-2 py-3 text-center">
                            <p className="text-[10px] text-ocean/60">—</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
