"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Globe,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  MapPin,
  Briefcase,
  User,
  Sparkles,
  TrendingUp,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Heart,
  ExternalLink,
} from "lucide-react";
import type { Config } from "@/lib/types";
import type { PerformanceInsights, VideoInsight } from "@/app/api/configs/[id]/performance/route";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = ["Authority", "Story / Personality", "Social Proof", "Education", "Polarisation"];
const FORMATS = ["Face-to-camera", "Voiceover + B-Roll", "Storytelling", "Short-form video", "Carousel", "Screenshot post", "Blind reaction"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const GOAL_LABELS: Record<string, { label: string; description: string; color: string }> = {
  reach:   { label: "Reach",   description: "Education + Polarisation", color: "from-blue-500/20 to-cyan-500/20 border-blue-500/20 text-blue-400" },
  trust:   { label: "Trust",   description: "Story + Social Proof",     color: "from-green-500/20 to-emerald-500/20 border-green-500/20 text-green-600" },
  revenue: { label: "Revenue", description: "Authority + Social Proof", color: "from-amber-500/20 to-orange-500/20 border-amber-500/20 text-ivory" },
};

const TYPE_COLORS: Record<string, string> = {
  "Authority":         "bg-blush/20 text-blush-dark border-blush/40",
  "Story / Personality": "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Social Proof":      "bg-green-50 text-green-600 border-green-200",
  "Education":         "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Polarisation":      "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pillar { name: string; subTopics: string; }
interface DaySlot { type: string; format: string; }
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

// ─── Small UI pieces ──────────────────────────────────────────────────────────

function SocialLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-ocean/5 text-sm text-ocean/60 hover:text-ocean hover:border-ocean/[0.06] transition-all">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z" />
    </svg>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-ocean/60 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ─── Video Insight Card ───────────────────────────────────────────────────────

function VideoInsightCard({ video }: { video: VideoInsight }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass rounded-2xl overflow-hidden border border-ocean/[0.06]">
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="shrink-0 relative">
          {video.thumbnail ? (
            <img src={video.thumbnail} alt="" className="h-20 w-14 rounded-xl object-cover" />
          ) : (
            <div className="h-20 w-14 rounded-xl bg-ocean/[0.02] flex items-center justify-center">
              <Eye className="h-4 w-4 text-ocean/60" />
            </div>
          )}
        </div>
        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug line-clamp-2">{video.topic || "—"}</p>
            <a href={video.url} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-ocean/65 hover:text-ocean/60 transition-colors mt-0.5">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-ocean/60">
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(video.views)}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(video.likes)}</span>
            <span>{video.datePosted}</span>
          </div>
          {/* Hooks inline */}
          <div className="mt-2.5 space-y-1.5">
            {video.audioHook && video.audioHook !== "none" && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-medium text-blush-dark uppercase tracking-wider shrink-0 mt-0.5">Audio</span>
                <p className="text-xs text-ocean/60 italic leading-relaxed">"{video.audioHook}"</p>
              </div>
            )}
            {video.textHook && video.textHook !== "none" && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider shrink-0 mt-0.5">Text</span>
                <p className="text-xs text-ocean/60 italic leading-relaxed">"{video.textHook}"</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Expandable analysis */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 pb-1 text-left text-[11px] text-ocean/60 hover:text-ocean/60 transition-colors">
        {expanded ? "Hide analysis ↑" : "Show analysis ↓"}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/[0.06]">
          {video.scriptSummary && (
            <div>
              <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider mb-1">Script</p>
              <p className="text-xs text-ocean/60 leading-relaxed">{video.scriptSummary}</p>
            </div>
          )}
          {video.whyItWorked && (
            <div>
              <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider mb-1">Why it worked</p>
              <p className="text-xs text-ocean/60 leading-relaxed">{video.whyItWorked}</p>
            </div>
          )}
          {video.howToReplicate && (
            <div>
              <p className="text-[10px] font-medium text-blue-400 uppercase tracking-wider mb-1">How to replicate</p>
              <p className="text-xs text-ocean/60 leading-relaxed">{video.howToReplicate}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Strategy Edit Dialog ─────────────────────────────────────────────────────

interface StrategyForm {
  strategyGoal: string;
  pillars: Pillar[];
  weekly: WeeklyStructure;
}

function StrategyEditDialog({ open, onClose, initial, onSave }: {
  open: boolean; onClose: () => void;
  initial: StrategyForm; onSave: (f: StrategyForm) => Promise<void>;
}) {
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
        <DialogHeader><DialogTitle>Edit Strategy</DialogTitle></DialogHeader>
        <div className="space-y-6 pt-2">

          {/* Primary Goal */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-ocean/60 uppercase tracking-wider">Primary Goal</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(GOAL_LABELS).map(([key, { label, description }]) => (
                <button key={key} type="button"
                  onClick={() => setForm({ ...form, strategyGoal: form.strategyGoal === key ? "" : key })}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    form.strategyGoal === key
                      ? "bg-blush/30 border-blush/40 text-ocean"
                      : "glass border-ocean/5 text-ocean/60 hover:border-ocean/[0.06]"
                  }`}>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-[11px] mt-0.5 opacity-70">{description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Content Pillars */}
          <div className="space-y-3 border-t border-ocean/[0.06] pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ocean/60 uppercase tracking-wider">Content Pillars</p>
              {form.pillars.length < 5 && (
                <Button variant="ghost" size="sm" onClick={addPillar}
                  className="h-7 gap-1 text-xs rounded-lg px-2 text-ocean/60 hover:text-ocean">
                  <Plus className="h-3 w-3" /> Add pillar
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {form.pillars.map((pillar, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input value={pillar.name} onChange={(e) => setPillar(i, "name", e.target.value)}
                      placeholder="Pillar name" className="rounded-xl glass border-ocean/5 h-10 text-sm" />
                    <Input value={pillar.subTopics} onChange={(e) => setPillar(i, "subTopics", e.target.value)}
                      placeholder="Sub-topics" className="rounded-xl glass border-ocean/5 h-10 text-sm" />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removePillar(i)}
                    className="h-10 w-10 p-0 rounded-xl text-ocean/60 hover:text-red-500 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {form.pillars.length === 0 && (
                <p className="text-xs text-ocean/60 italic">No pillars yet — add up to 5.</p>
              )}
            </div>
          </div>

          {/* Weekly Structure */}
          <div className="space-y-3 border-t border-ocean/[0.06] pt-5">
            <p className="text-xs font-medium text-ocean/60 uppercase tracking-wider">Weekly Posting Structure</p>
            <div className="space-y-2">
              {DAYS.map((day) => (
                <div key={day} className="grid grid-cols-[48px_1fr_1fr] gap-2 items-center">
                  <span className="text-xs font-medium text-ocean/60">{day}</span>
                  <select value={form.weekly[day]?.type || ""} onChange={(e) => setDay(day, "type", e.target.value)}
                    className="h-10 rounded-xl glass border border-ocean/5 bg-transparent px-3 text-sm text-ocean focus:outline-none focus:border-ocean/[0.06]">
                    <option value="">— Content type —</option>
                    {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={form.weekly[day]?.format || ""} onChange={(e) => setDay(day, "format", e.target.value)}
                    className="h-10 rounded-xl glass border border-ocean/5 bg-transparent px-3 text-sm text-ocean focus:outline-none focus:border-ocean/[0.06]">
                    <option value="">— Format —</option>
                    {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving}
            className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0">
            {saving ? "Saving…" : "Save Strategy"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<Config | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const loadClient = () =>
    fetch(`/api/configs/${id}`).then((r) => r.json() as Promise<Config>);

  useEffect(() => {
    loadClient().then(setClient);
  }, [id]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await fetch(`/api/configs/${id}/performance`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }
      await loadClient().then(setClient);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAnalyzing(false);
    }
  };

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
    return <div className="flex items-center justify-center h-64 text-ocean/60 text-sm">Loading…</div>;
  }

  const hasSocials = client.instagram || client.tiktok || client.youtube || client.linkedin || client.twitter || client.website;
  const pillars = parsePillars(client.strategyPillars);
  const weekly = parseWeekly(client.strategyWeekly);
  const goal = GOAL_LABELS[client.strategyGoal];
  const insights = parseInsights(client.performanceInsights);
  const hasStrategy = client.strategyGoal || pillars.length > 0;

  const strategyInitial: StrategyForm = {
    strategyGoal: client.strategyGoal || "",
    pillars: pillars.length > 0 ? pillars : [{ name: "", subTopics: "" }],
    weekly: Object.fromEntries(DAYS.map((d) => [d, weekly[d] || { type: "", format: "" }])),
  };

  return (
    <div className="space-y-8">
      {/* Back */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/configs")}
          className="h-9 gap-1.5 rounded-xl text-ocean/60 hover:text-ocean px-3">
          <ArrowLeft className="h-4 w-4" /> Clients
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blush/20 to-blush/30 border border-blush/40">
          <User className="h-6 w-6 text-blush-dark" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name || client.configName}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {client.role && <span className="text-sm text-ocean/60">{client.role}</span>}
            {client.role && client.company && <span className="text-ocean/65">·</span>}
            {client.company && <span className="text-sm text-ocean/60">{client.company}</span>}
            {client.location && (
              <>
                <span className="text-ocean/65">·</span>
                <span className="inline-flex items-center gap-1 text-sm text-ocean/60">
                  <MapPin className="h-3 w-3" />{client.location}
                </span>
              </>
            )}
          </div>
          <div className="mt-2">
            <Badge variant="secondary" className="rounded-md text-[10px] bg-ocean/[0.02] border border-ocean/[0.06]">
              {client.creatorsCategory}
            </Badge>
          </div>
        </div>
      </div>

      {/* Social Links */}
      {hasSocials && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-ocean/60 uppercase tracking-wider">Links</h2>
          <div className="flex flex-wrap gap-2">
            <SocialLink href={client.website} icon={Globe} label={client.website} />
            <SocialLink href={client.instagram} icon={Instagram} label={`@${client.instagram.replace(/^@/, "")}`} />
            <SocialLink href={client.tiktok} icon={TikTokIcon} label={`@${client.tiktok.replace(/^@/, "")}`} />
            <SocialLink href={client.youtube} icon={Youtube} label={client.youtube} />
            <SocialLink href={client.linkedin} icon={Linkedin} label={client.linkedin} />
            <SocialLink href={client.twitter} icon={Twitter} label={`@${client.twitter.replace(/^@/, "")}`} />
          </div>
        </div>
      )}

      {/* Basic Info */}
      {(client.company || client.role || client.location || client.businessContext || client.professionalBackground || client.keyAchievements) && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blush-dark" /> Basic Information
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <InfoRow label="Name" value={client.name} />
            <InfoRow label="Company" value={client.company} />
            <InfoRow label="Role" value={client.role} />
            <InfoRow label="Location" value={client.location} />
          </div>
          {(client.businessContext || client.professionalBackground || client.keyAchievements) && (
            <div className="border-t border-ocean/[0.06] pt-5 space-y-5">
              <InfoRow label="Business Context" value={client.businessContext} />
              <InfoRow label="Professional Background" value={client.professionalBackground} />
              <InfoRow label="Key Achievements" value={client.keyAchievements} />
            </div>
          )}
        </div>
      )}

      {/* Performance Analysis */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" /> Performance Analysis
            </h2>
            {insights && (
              <p className="text-[11px] text-ocean/60 mt-0.5">
                Last analysed: {insights.scrapedAt} · scraped last {insights.scrapeWindowDays ?? 365} days
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={runAnalysis} disabled={analyzing}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-ocean/60 hover:text-ocean">
            <RefreshCw className={`h-3 w-3 ${analyzing ? "animate-spin" : ""}`} />
            {analyzing ? "Analysing…" : insights ? "Re-analyse" : "Analyse"}
          </Button>
        </div>

        {analyzeError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-500">
            {analyzeError}
          </div>
        )}

        {analyzing && (
          <div className="space-y-2 text-sm text-ocean/60">
            <p>Scraping Instagram profile…</p>
            <p>Downloading & uploading top videos to Gemini…</p>
            <p>Analysing hooks, scripts, and performance…</p>
            <p className="text-[11px] opacity-60">This takes 1–3 minutes.</p>
          </div>
        )}

        {!analyzing && !insights && !analyzeError && (
          <div className="text-center py-8">
            <TrendingUp className="mx-auto h-8 w-8 text-ocean/20 mb-3" />
            <p className="text-sm text-ocean/60">No analysis yet.</p>
            <p className="text-xs text-ocean/60 mt-1">
              Click Analyse to scrape the client&apos;s Instagram and identify what&apos;s working.
            </p>
          </div>
        )}

        {!analyzing && insights && (
          <div className="space-y-6">
            {insights.top30Days.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-green-600 uppercase tracking-wider mb-3">Top — Last 30 Days</p>
                <div className="space-y-3">
                  {insights.top30Days.map((v, i) => <VideoInsightCard key={i} video={v} />)}
                </div>
              </div>
            )}
            {insights.topAllTime.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-blush-dark uppercase tracking-wider mb-3">
                  Top — Last {insights.scrapeWindowDays ? `${insights.scrapeWindowDays} Days` : "12 Months"} (excluding last 30)
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
            <Sparkles className="h-4 w-4 text-ivory" /> Content Strategy
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setStrategyOpen(true)}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-ocean/60 hover:text-ocean">
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        </div>

        {!hasStrategy ? (
          <div className="text-center py-8">
            <Sparkles className="mx-auto h-8 w-8 text-ocean/20 mb-3" />
            <p className="text-sm text-ocean/60">No strategy defined yet.</p>
            <Button variant="ghost" size="sm" onClick={() => setStrategyOpen(true)}
              className="mt-3 rounded-xl text-xs text-ocean/60 hover:text-ocean gap-1">
              <Plus className="h-3 w-3" /> Add strategy
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {goal && (
              <div>
                <p className="text-[11px] text-ocean/60 uppercase tracking-wider mb-2">Primary Goal</p>
                <div className={`inline-flex items-center gap-2 rounded-xl border bg-gradient-to-br px-4 py-2 ${goal.color}`}>
                  <span className="text-sm font-semibold">{goal.label}</span>
                  <span className="text-xs opacity-70">→ {goal.description}</span>
                </div>
              </div>
            )}

            {pillars.filter(p => p.name).length > 0 && (
              <div>
                <p className="text-[11px] text-ocean/60 uppercase tracking-wider mb-3">Content Pillars</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pillars.filter(p => p.name).map((pillar, i) => (
                    <div key={i} className="rounded-xl glass border border-ocean/[0.06] p-3">
                      <p className="text-sm font-medium">{pillar.name}</p>
                      {pillar.subTopics && (
                        <p className="text-xs text-ocean/60 mt-1 leading-relaxed">{pillar.subTopics}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {DAYS.some(d => weekly[d]?.type) && (
              <div>
                <p className="text-[11px] text-ocean/60 uppercase tracking-wider mb-3">Weekly Posting Structure</p>
                <div className="grid grid-cols-5 gap-2">
                  {DAYS.map((day) => {
                    const slot = weekly[day];
                    const colorClass = slot?.type ? TYPE_COLORS[slot.type] || "bg-ocean/[0.02] text-ocean/60 border-ocean/[0.06]" : "";
                    return (
                      <div key={day} className="space-y-1.5">
                        <p className="text-[11px] font-medium text-ocean/60 text-center">{day}</p>
                        {slot?.type ? (
                          <div className={`rounded-xl border px-2 py-2 text-center ${colorClass}`}>
                            <p className="text-[11px] font-medium leading-tight">{slot.type}</p>
                            {slot.format && <p className="text-[10px] opacity-60 mt-1 leading-tight">{slot.format}</p>}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-ocean/5 px-2 py-2 text-center">
                            <p className="text-[10px] text-ocean/65">—</p>
                          </div>
                        )}
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
      />
    </div>
  );
}
