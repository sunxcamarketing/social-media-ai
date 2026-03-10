"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2, Layers, FileText, Target, Brain, Link, Loader2, CheckCircle2, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { BUILT_IN_CONTENT_TYPES, BUILT_IN_FORMATS } from "@/lib/strategy";
import type { ContentType, ContentFormat } from "@/lib/strategy";
import type { TrainingExample } from "@/app/api/strategy/route";
import { FormatPicker } from "@/components/format-picker";

const TYPE_COLORS: Record<string, string> = {
  "Authority":              "bg-blush/20 text-blush-dark border-blush/40",
  "Story / Personality":    "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "Social Proof":           "bg-green-50 text-green-600 border-green-200",
  "Education / Value":      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Opinion / Polarisation": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "Behind the Scenes":      "bg-slate-500/10 text-slate-400 border-slate-500/20",
  "Inspiration / Motivation": "bg-blush/20 text-blush-dark border-blush/40",
  "Entertainment":          "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "Community / Interaction": "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "Promotion / Offer":      "bg-blush/20 text-blush-dark border-blush/40",
};

const EXAMPLE_CALENDAR = [
  { day: "Mon", type: "Authority", format: "Face to Camera" },
  { day: "Tue", type: "Education / Value", format: "Carousel / Slideshow" },
  { day: "Wed", type: "Story / Personality", format: "Storytelling" },
  { day: "Thu", type: "Social Proof", format: "Screenshot Post" },
  { day: "Fri", type: "Opinion / Polarisation", format: "Face to Camera" },
];

interface StrategyData {
  customContentTypes: ContentType[];
  customFormats: ContentFormat[];
  trainingExamples: TrainingExample[];
}

export default function StrategyPage() {
  const [data, setData] = useState<StrategyData>({ customContentTypes: [], customFormats: [], trainingExamples: [] });

  // Training library state
  const [trainUrl, setTrainUrl] = useState("");
  const [trainAnalyzing, setTrainAnalyzing] = useState(false);
  const [trainSuggestion, setTrainSuggestion] = useState<{ suggestedType: string; suggestedFormat: string; reasoning: string } | null>(null);
  const [trainType, setTrainType] = useState("");
  const [trainFormat, setTrainFormat] = useState("");
  const [trainNote, setTrainNote] = useState("");
  const [trainSaving, setTrainSaving] = useState(false);
  const [trainError, setTrainError] = useState<string | null>(null);
  const [editExample, setEditExample] = useState<TrainingExample | null>(null);

  // Content type dialog
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeForm, setTypeForm] = useState({ name: "", goal: "", bestFor: "" });
  const [typeSaving, setTypeSaving] = useState(false);

  // Format dialog
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [formatForm, setFormatForm] = useState({ name: "", description: "", bestContentType: "", platform: "" });
  const [formatSaving, setFormatSaving] = useState(false);

  const load = () =>
    fetch("/api/strategy").then(r => r.json()).then(setData);

  useEffect(() => { load(); }, []);

  const saveType = async () => {
    if (!typeForm.name.trim()) return;
    setTypeSaving(true);
    await fetch("/api/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "contentType", ...typeForm }),
    });
    await load();
    setTypeForm({ name: "", goal: "", bestFor: "" });
    setTypeDialogOpen(false);
    setTypeSaving(false);
  };

  const saveFormat = async () => {
    if (!formatForm.name.trim()) return;
    setFormatSaving(true);
    await fetch("/api/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "format", ...formatForm }),
    });
    await load();
    setFormatForm({ name: "", description: "", bestContentType: "", platform: "" });
    setFormatDialogOpen(false);
    setFormatSaving(false);
  };

  const deleteType = async (id: string) => {
    await fetch(`/api/strategy?id=${id}&kind=contentType`, { method: "DELETE" });
    await load();
  };

  const deleteFormat = async (id: string) => {
    await fetch(`/api/strategy?id=${id}&kind=format`, { method: "DELETE" });
    await load();
  };

  const analyzeLink = async () => {
    if (!trainUrl.trim()) return;
    setTrainAnalyzing(true);
    setTrainError(null);
    setTrainSuggestion(null);
    setTrainType("");
    setTrainFormat("");
    try {
      const res = await fetch("/api/strategy/analyze-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trainUrl }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Analysis failed");
      setTrainSuggestion(result);
      setTrainType(result.suggestedType || "");
      setTrainFormat(result.suggestedFormat || "");
    } catch (e) {
      setTrainError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setTrainAnalyzing(false);
    }
  };

  const saveTrainingExample = async () => {
    if (!trainUrl.trim() || !trainType || !trainFormat) return;
    setTrainSaving(true);
    await fetch("/api/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "trainingExample", url: trainUrl, contentType: trainType, format: trainFormat, note: trainNote }),
    });
    await load();
    setTrainUrl("");
    setTrainSuggestion(null);
    setTrainType("");
    setTrainFormat("");
    setTrainNote("");
    setTrainSaving(false);
  };

  const deleteExample = async (id: string) => {
    await fetch(`/api/strategy?id=${id}&kind=trainingExample`, { method: "DELETE" });
    await load();
  };

  const saveEditExample = async () => {
    if (!editExample) return;
    // Delete old, add new
    await fetch(`/api/strategy?id=${editExample.id}&kind=trainingExample`, { method: "DELETE" });
    await fetch("/api/strategy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "trainingExample", url: editExample.url, contentType: editExample.contentType, format: editExample.format, note: editExample.note }),
    });
    await load();
    setEditExample(null);
  };

  const allContentTypes = [...BUILT_IN_CONTENT_TYPES, ...data.customContentTypes];
  const allFormats = [...BUILT_IN_FORMATS, ...data.customFormats];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blush/30 border border-blush/40">
            <BookOpen className="h-4 w-4 text-blush-dark" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Content Strategy Framework</h1>
        </div>
        <p className="mt-1 text-sm text-ocean/60 ml-12">Be The Brand — Content Strategie Workbook</p>
      </div>

      {/* Formula Banner */}
      <div className="glass-strong rounded-2xl border border-ocean/[0.06] p-6">
        <p className="text-[11px] font-medium text-ocean/60 uppercase tracking-wider mb-4">The Formula</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-xl bg-blush/20 border border-blush/40 px-4 py-2.5">
            <Layers className="h-4 w-4 text-blush-dark" />
            <span className="text-sm font-semibold text-blush-dark">PILLAR</span>
          </div>
          <span className="text-xl text-ocean/60 font-light">+</span>
          <div className="flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5">
            <Target className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">TYPE</span>
          </div>
          <span className="text-xl text-ocean/60 font-light">+</span>
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5">
            <FileText className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-600">FORMAT</span>
          </div>
          <span className="text-xl text-ocean/60 font-light">=</span>
          <div className="flex items-center gap-2 rounded-xl bg-blush/30 border border-blush/40 px-4 py-2.5">
            <span className="text-sm font-bold text-ocean">CONTENT</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-ocean/70 leading-relaxed max-w-2xl">
          Every piece of content should serve a pillar (your topic area), have a clear type (what goal it serves),
          and use an appropriate format (how it&apos;s produced and delivered). This combination ensures strategic variety
          while maintaining consistent brand positioning.
        </p>
      </div>

      {/* Training Library */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Brain className="h-5 w-5 text-blush-dark" /> Training Library</h2>
          <p className="text-xs text-ocean/60 mt-0.5">
            Add content links. AI classifies type &amp; format. Every saved example is used when generating strategies for clients.
          </p>
        </div>

        {/* Add link input */}
        <div className="glass rounded-2xl border border-ocean/[0.06] p-5 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ocean/40" />
              <Input
                value={trainUrl}
                onChange={(e) => setTrainUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") analyzeLink(); }}
                placeholder="https://instagram.com/p/... or any content URL"
                className="pl-9 rounded-xl glass border-ocean/[0.06] h-11 text-sm"
              />
            </div>
            <Button onClick={analyzeLink} disabled={trainAnalyzing || !trainUrl.trim()}
              className="h-11 rounded-xl px-4 bg-ocean hover:bg-ocean-light border-0 gap-1.5 text-sm shrink-0">
              {trainAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</> : <><Brain className="h-4 w-4" /> Analyse</>}
            </Button>
          </div>

          {trainError && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{trainError}</p>
          )}

          {(trainSuggestion || trainType) && (
            <div className="space-y-3 border-t border-ocean/[0.06] pt-4">
              {trainSuggestion && (
                <div className="flex items-start gap-2 rounded-xl bg-blush/20 border border-blush/40 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-blush-dark shrink-0 mt-0.5" />
                  <p className="text-xs text-ocean/60 leading-relaxed">{trainSuggestion.reasoning}</p>
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-ocean/60">Content Type</Label>
                  <select value={trainType} onChange={(e) => setTrainType(e.target.value)}
                    className="mt-1.5 w-full h-10 rounded-xl glass border border-ocean/[0.06] bg-transparent px-3 text-sm text-ocean focus:outline-none focus:border-ocean/20">
                    <option value="">— Select —</option>
                    {[...BUILT_IN_CONTENT_TYPES, ...data.customContentTypes].map(t => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-ocean/60">Format <span className="opacity-50">(select one or more)</span></Label>
                  <FormatPicker
                    value={trainFormat}
                    options={[...BUILT_IN_FORMATS, ...data.customFormats].map(f => f.name)}
                    onChange={setTrainFormat}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Note (optional)</Label>
                <Textarea value={trainNote} onChange={(e) => setTrainNote(e.target.value)}
                  rows={2} placeholder="e.g. Great hook structure, used trending audio, strong CTA at end…"
                  className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm" />
              </div>
              <Button onClick={saveTrainingExample} disabled={trainSaving || !trainType || !trainFormat}
                className="w-full h-10 rounded-xl bg-ocean hover:bg-ocean-light border-0 text-sm">
                {trainSaving ? "Saving…" : "Save to Training Library"}
              </Button>
            </div>
          )}
        </div>

        {/* Saved examples */}
        {data.trainingExamples.length > 0 && (
          <div className="glass rounded-2xl border border-ocean/[0.06] overflow-hidden">
            <div className="grid grid-cols-[1fr_160px_160px_32px_32px] gap-3 px-5 py-3 border-b border-ocean/[0.06] bg-ocean/[0.02]">
              <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">URL</p>
              <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Content Type</p>
              <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Format</p>
              <span /><span />
            </div>
            <div className="divide-y divide-ocean/[0.04]">
              {data.trainingExamples.map((ex) => {
                const colorClass = TYPE_COLORS[ex.contentType] || "bg-ocean/[0.02] text-ocean/60 border-ocean/[0.06]";
                return (
                  <div key={ex.id} className="grid grid-cols-[1fr_160px_160px_32px_32px] gap-3 px-5 py-3 items-center hover:bg-warm-white transition-colors">
                    <div className="min-w-0">
                      <a href={ex.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-ocean/60 hover:text-ocean truncate block underline underline-offset-2 decoration-ocean/20">
                        {ex.url}
                      </a>
                      {ex.note && <p className="text-[11px] text-ocean/50 mt-0.5 truncate">{ex.note}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-medium ${colorClass}`}>{ex.contentType}</span>
                    <span className="text-xs text-ocean/60">{ex.format}</span>
                    <button onClick={() => setEditExample({ ...ex })}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-ocean/60 hover:bg-warm-white transition-colors">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => deleteExample(ex.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Content Types */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Content Types</h2>
            <p className="text-xs text-ocean/60 mt-0.5">What purpose does each piece of content serve?</p>
          </div>
          <Button
            onClick={() => setTypeDialogOpen(true)}
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-3 text-xs border border-ocean/[0.06] text-ocean/60 hover:text-ocean hover:bg-warm-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add custom type
          </Button>
        </div>

        <div className="glass rounded-2xl border border-ocean/[0.06] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[200px_1fr_1fr_32px] gap-4 px-5 py-3 border-b border-ocean/[0.06] bg-ocean/[0.02]">
            <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Name</p>
            <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Goal</p>
            <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Best For</p>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-ocean/[0.04]">
            {allContentTypes.map((type) => {
              const colorClass = TYPE_COLORS[type.name] || "bg-ocean/[0.02] text-ocean/60 border-ocean/[0.06]";
              return (
                <div
                  key={type.id}
                  className="grid grid-cols-[200px_1fr_1fr_32px] gap-4 px-5 py-3.5 items-center hover:bg-warm-white transition-colors"
                >
                  <div>
                    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${colorClass}`}>
                      {type.name}
                    </span>
                    {type.custom && (
                      <span className="ml-2 text-[10px] text-ocean/40 font-medium uppercase tracking-wider">custom</span>
                    )}
                  </div>
                  <p className="text-sm text-ocean/60 leading-relaxed">{type.goal}</p>
                  <p className="text-sm text-ocean/60 leading-relaxed">{type.bestFor}</p>
                  <div className="flex justify-end">
                    {type.custom && (
                      <button
                        onClick={() => deleteType(type.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 2: Content Formats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Content Formats</h2>
            <p className="text-xs text-ocean/60 mt-0.5">How is the content produced and delivered?</p>
          </div>
          <Button
            onClick={() => setFormatDialogOpen(true)}
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-xl px-3 text-xs border border-ocean/[0.06] text-ocean/60 hover:text-ocean hover:bg-warm-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add custom format
          </Button>
        </div>

        <div className="glass rounded-2xl border border-ocean/[0.06] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[180px_1fr_1fr_160px_32px] gap-4 px-5 py-3 border-b border-ocean/[0.06] bg-ocean/[0.02]">
            <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Format</p>
            <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Description</p>
            <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Best Content Type</p>
            <p className="text-[10px] font-medium text-ocean/60 uppercase tracking-wider">Platform</p>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-ocean/[0.04]">
            {allFormats.map((format) => (
              <div
                key={format.id}
                className="grid grid-cols-[180px_1fr_1fr_160px_32px] gap-4 px-5 py-3.5 items-center hover:bg-warm-white transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{format.name}</p>
                  {format.custom && (
                    <span className="text-[10px] text-ocean/40 font-medium uppercase tracking-wider">custom</span>
                  )}
                </div>
                <p className="text-sm text-ocean/60 leading-relaxed">{format.description}</p>
                <p className="text-xs text-ocean/60 leading-relaxed">{format.bestContentType}</p>
                <p className="text-xs text-ocean/60">{format.platform}</p>
                <div className="flex justify-end">
                  {format.custom && (
                    <button
                      onClick={() => deleteFormat(format.id)}
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: The Framework */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">The Framework</h2>
          <p className="text-xs text-ocean/60 mt-0.5">How to apply the formula to your content calendar</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Step 1 */}
          <div className="glass rounded-2xl border border-ocean/[0.06] p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blush/30 border border-blush/40">
                <span className="text-xs font-bold text-blush-dark">1</span>
              </div>
              <p className="text-sm font-semibold">Define Your Pillars</p>
            </div>
            <p className="text-xs text-ocean/60 leading-relaxed">
              Choose 3–5 content pillars — the core topics or themes your brand covers.
              Each pillar should directly serve your audience and business goals.
              Example: <em className="text-ocean/60">Finance Tips, Behind My Business, Client Results.</em>
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass rounded-2xl border border-ocean/[0.06] p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-500/20">
                <span className="text-xs font-bold text-blue-400">2</span>
              </div>
              <p className="text-sm font-semibold">Assign Types to Days</p>
            </div>
            <p className="text-xs text-ocean/60 leading-relaxed">
              Map content types to days of the week so you maintain strategic balance.
              Mix reach-drivers (Education, Opinion) with trust-builders (Story, Social Proof)
              and conversion content (Authority, Promotion) across the week.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass rounded-2xl border border-ocean/[0.06] p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 border border-green-200">
                <span className="text-xs font-bold text-green-600">3</span>
              </div>
              <p className="text-sm font-semibold">Choose Your Format</p>
            </div>
            <p className="text-xs text-ocean/60 leading-relaxed">
              Select the format that fits the content type and your production capacity.
              Not every day needs a face-to-camera video — carousels, screen recordings,
              and screenshots can be just as effective for certain content types.
            </p>
          </div>
        </div>

        {/* Example Calendar */}
        <div className="glass rounded-2xl border border-ocean/[0.06] p-5 space-y-4">
          <p className="text-[11px] font-medium text-ocean/60 uppercase tracking-wider">Example Editorial Calendar</p>
          <div className="grid grid-cols-5 gap-3">
            {EXAMPLE_CALENDAR.map(({ day, type, format }) => {
              const colorClass = TYPE_COLORS[type] || "bg-ocean/[0.02] text-ocean/60 border-ocean/[0.06]";
              return (
                <div key={day} className="space-y-2">
                  <p className="text-[11px] font-semibold text-ocean/60 text-center">{day}</p>
                  <div className={`rounded-xl border px-2.5 py-2.5 text-center space-y-1 ${colorClass}`}>
                    <p className="text-[11px] font-semibold leading-tight">{type}</p>
                    <p className="text-[10px] opacity-60 leading-tight">{format}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-ocean/60">
            This is just an example — configure each client&apos;s actual calendar in their Strategy tab.
          </p>
        </div>
      </div>

      {/* Add Custom Content Type Dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={(v) => { if (!v) setTypeDialogOpen(false); }}>
        <DialogContent className="max-w-md glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>Add Custom Content Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-ocean/60">Name</Label>
              <Input
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                placeholder="e.g. Case Study"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Goal</Label>
              <Input
                value={typeForm.goal}
                onChange={(e) => setTypeForm({ ...typeForm, goal: e.target.value })}
                placeholder="e.g. Demonstrate results with data"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Best For</Label>
              <Input
                value={typeForm.bestFor}
                onChange={(e) => setTypeForm({ ...typeForm, bestFor: e.target.value })}
                placeholder="e.g. Converting warm leads"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <Button
              onClick={saveType}
              disabled={typeSaving || !typeForm.name.trim()}
              className="w-full rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0"
            >
              {typeSaving ? "Saving…" : "Add Content Type"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Training Example Dialog */}
      <Dialog open={!!editExample} onOpenChange={(v) => { if (!v) setEditExample(null); }}>
        <DialogContent className="max-w-md glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader><DialogTitle>Edit Training Example</DialogTitle></DialogHeader>
          {editExample && (
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs text-ocean/60">URL</Label>
                <p className="mt-1 text-xs text-ocean/60 truncate">{editExample.url}</p>
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Content Type</Label>
                <select value={editExample.contentType} onChange={(e) => setEditExample({ ...editExample, contentType: e.target.value })}
                  className="mt-1.5 w-full h-10 rounded-xl glass border border-ocean/[0.06] bg-transparent px-3 text-sm text-ocean focus:outline-none focus:border-ocean/20">
                  {[...BUILT_IN_CONTENT_TYPES, ...data.customContentTypes].map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Format <span className="opacity-50">(select one or more)</span></Label>
                <FormatPicker
                  value={editExample.format}
                  options={[...BUILT_IN_FORMATS, ...data.customFormats].map(f => f.name)}
                  onChange={(val) => setEditExample({ ...editExample, format: val })}
                />
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Note</Label>
                <Textarea value={editExample.note} onChange={(e) => setEditExample({ ...editExample, note: e.target.value })}
                  rows={2} className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm" />
              </div>
              <Button onClick={saveEditExample}
                className="w-full h-10 rounded-xl bg-ocean hover:bg-ocean-light border-0">
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Custom Format Dialog */}
      <Dialog open={formatDialogOpen} onOpenChange={(v) => { if (!v) setFormatDialogOpen(false); }}>
        <DialogContent className="max-w-md glass-strong rounded-2xl border-ocean/[0.06]">
          <DialogHeader>
            <DialogTitle>Add Custom Format</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-ocean/60">Name</Label>
              <Input
                value={formatForm.name}
                onChange={(e) => setFormatForm({ ...formatForm, name: e.target.value })}
                placeholder="e.g. Animated Explainer"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Description</Label>
              <Input
                value={formatForm.description}
                onChange={(e) => setFormatForm({ ...formatForm, description: e.target.value })}
                placeholder="e.g. Motion graphics to explain concepts"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Best Content Type</Label>
              <Input
                value={formatForm.bestContentType}
                onChange={(e) => setFormatForm({ ...formatForm, bestContentType: e.target.value })}
                placeholder="e.g. Education, Authority"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-ocean/60">Platform</Label>
              <Input
                value={formatForm.platform}
                onChange={(e) => setFormatForm({ ...formatForm, platform: e.target.value })}
                placeholder="e.g. YouTube, LinkedIn"
                className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10 text-sm"
              />
            </div>
            <Button
              onClick={saveFormat}
              disabled={formatSaving || !formatForm.name.trim()}
              className="w-full rounded-xl h-10 bg-ocean hover:bg-ocean-light border-0"
            >
              {formatSaving ? "Saving…" : "Add Format"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
