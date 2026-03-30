"use client";

import { useEffect, useState, useRef } from "react";
import {
  Zap, Loader2, CheckCircle2, AlertTriangle,
  Copy, ChevronDown, ChevronRight, Video,
  FileText, Music, Camera,
  ExternalLink, Sparkles, Save, Check, Pencil,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Config, Video as VideoType } from "@/lib/types";
import { useViralScript, type PipelineStep, type FinalResult } from "@/context/viral-script-context";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Sub-Components ──────────────────────────────────────────────────────────

function StepIndicator({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.id} className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-ocean/10 bg-white">
            {s.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {s.status === "loading" && <Loader2 className="h-4 w-4 text-ocean/70 animate-spin" />}
            {s.status === "error" && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {s.status === "waiting" && <div className="h-2 w-2 rounded-full bg-ocean/15" />}
          </div>
          <div className="flex flex-col">
            <span className={`text-sm font-light ${
              s.status === "waiting" ? "text-ocean/30" :
              s.status === "loading" ? "text-ocean/70" :
              s.status === "error" ? "text-red-500" :
              "text-ocean/50"
            }`}>
              {s.label}
            </span>
            {s.message && s.status === "loading" && (
              <span className="text-[11px] text-ocean/40 font-light">{s.message}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScriptCard({ version, label, color, onUpdate, variant }: {
  version: { hook: string; body: string; cta: string; textHook: string };
  label: string;
  color: string;
  onUpdate: (field: "hook" | "body" | "cta" | "textHook", value: string) => void;
  variant: "short" | "long";
}) {
  const [editing, setEditing] = useState<"hook" | "body" | "cta" | "textHook" | null>(null);
  const [draft, setDraft] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const fullText = [version.hook, version.body, version.cta].filter(Boolean).join("\n\n");
  const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length;

  const startEdit = (field: "hook" | "body" | "cta" | "textHook") => {
    setEditing(field);
    setDraft(version[field]);
  };

  const saveEdit = () => {
    if (editing) {
      onUpdate(editing, draft);
      setEditing(null);
    }
  };

  const cancelEdit = () => { setEditing(null); setDraft(""); };

  const refineWithAI = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/viral-script/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: aiInput.trim(),
          hook: version.hook,
          body: version.body,
          cta: version.cta,
        }),
      });
      const data = await res.json();
      if (data.error) return;
      onUpdate("hook", data.hook);
      onUpdate("body", data.body);
      onUpdate("cta", data.cta);
      setAiInput("");
    } catch { /* silent */ } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className={`rounded-xl border ${color} p-5 space-y-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-ocean/60">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ocean/40">{wordCount} Wörter</span>
          <button onClick={() => copyToClipboard(fullText)} className="p-1 rounded hover:bg-ocean/[0.04]" title="Kopieren">
            <Copy className="h-3.5 w-3.5 text-ocean/40" />
          </button>
        </div>
      </div>

      {/* Text Hook (on-screen) */}
      {version.textHook && (
        <div className="group/field">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-purple-500/70 font-semibold flex items-center gap-1">
              <FileText className="h-2.5 w-2.5" /> Text Hook
            </span>
            {editing !== "textHook" && (
              <button
                onClick={() => startEdit("textHook")}
                className="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded hover:bg-ocean/[0.06]"
                title="Bearbeiten"
              >
                <Pencil className="h-2.5 w-2.5 text-ocean/30" />
              </button>
            )}
          </div>
          {editing === "textHook" ? (
            <div className="space-y-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-lg border border-ocean/15 bg-white px-3 py-2 text-[14px] font-bold text-purple-700 focus:border-blush focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-ocean text-white text-[11px] font-medium hover:bg-ocean-light transition-colors">
                  <Check className="h-3 w-3" /> Übernehmen
                </button>
                <button onClick={cancelEdit} className="px-3 py-1 rounded-lg text-ocean/50 text-[11px] hover:text-ocean hover:bg-ocean/[0.04] transition-colors">
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-purple-50/50 border border-purple-200/40 rounded-lg px-3 py-2">
              <p className="text-[14px] font-bold text-purple-700 tracking-tight">{version.textHook}</p>
            </div>
          )}
        </div>
      )}

      {(["hook", "body", "cta"] as const).map((field) => (
        <div key={field} className="group/field">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase tracking-wider text-ocean/40">
              {field === "hook" ? "Hook (gesprochen)" : field === "body" ? "Body" : "CTA"}
            </span>
            {editing !== field && (
              <button
                onClick={() => startEdit(field)}
                className="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded hover:bg-ocean/[0.06]"
                title="Bearbeiten"
              >
                <Pencil className="h-2.5 w-2.5 text-ocean/30" />
              </button>
            )}
          </div>
          {editing === field ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-lg border border-ocean/15 bg-white p-3 text-[13px] text-ocean leading-relaxed focus:border-blush focus:outline-none resize-y min-h-[60px]"
                rows={field === "body" ? 5 : 2}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-ocean text-white text-[11px] font-medium hover:bg-ocean-light transition-colors">
                  <Check className="h-3 w-3" /> Übernehmen
                </button>
                <button onClick={cancelEdit} className="px-3 py-1 rounded-lg text-ocean/50 text-[11px] hover:text-ocean hover:bg-ocean/[0.04] transition-colors">
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <p className={`${field === "hook" ? "text-[14px] text-ocean font-medium" : field === "cta" ? "text-[13px] text-ocean/75 italic" : "text-[13px] text-ocean/75 leading-relaxed whitespace-pre-line"}`}>
              {version[field]}
            </p>
          )}
        </div>
      ))}

      {/* AI Refine Input */}
      <div className="pt-2 border-t border-ocean/[0.06]">
        <div className="flex gap-2">
          <input
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); refineWithAI(); } }}
            placeholder="KI-Anweisung: z.B. &quot;Mach den Hook provokanter&quot;"
            disabled={aiLoading}
            className="flex-1 h-9 rounded-lg border border-ocean/10 bg-ocean/[0.02] px-3 text-[12px] text-ocean placeholder:text-ocean/30 focus:border-blush focus:outline-none"
          />
          <button
            onClick={refineWithAI}
            disabled={!aiInput.trim() || aiLoading}
            className="h-9 px-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-600 hover:bg-purple-100 disabled:opacity-40 transition-colors flex items-center gap-1.5 text-[11px] font-medium"
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Verbessern
          </button>
        </div>
      </div>
    </div>
  );
}

function ShotListSection({ shots }: { shots: { nr: number; text: string; action: string; onScreen?: string; duration: string }[] }) {
  return (
    <div className="rounded-xl border border-ocean/[0.06] bg-white p-5">
      <h3 className="text-sm font-medium text-ocean mb-4 flex items-center gap-2">
        <Camera className="h-4 w-4" />
        Shot-Liste — Was muss aufgenommen werden
      </h3>
      <div className="space-y-2">
        {shots.map((shot) => (
          <div key={shot.nr} className="flex gap-3 text-[12px] rounded-lg bg-ocean/[0.02] border border-ocean/[0.04] p-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ocean/10 text-ocean/70 text-[11px] font-bold shrink-0">
              {shot.nr}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-ocean/80 font-medium leading-snug">&ldquo;{shot.text}&rdquo;</p>
              <p className="text-ocean/55">{shot.action}</p>
              {shot.onScreen && (
                <p className="text-purple-600/70 flex items-center gap-1">
                  <FileText className="h-2.5 w-2.5 shrink-0" />
                  On-Screen: {shot.onScreen}
                </p>
              )}
            </div>
            <span className="text-[10px] text-ocean/35 shrink-0 mt-0.5">{shot.duration}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ViralScriptPage() {
  const vs = useViralScript();
  const [clients, setClients] = useState<Config[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [showProduction, setShowProduction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Load clients
  useEffect(() => {
    fetch("/api/configs").then(r => r.json()).then(setClients).catch(() => {});
  }, []);

  // Load videos when client changes
  useEffect(() => {
    if (!vs.clientId) { setVideos([]); return; }
    setLoadingVideos(true);
    const cfg = clients.find(c => c.id === vs.clientId);
    if (!cfg) { setLoadingVideos(false); return; }
    fetch(`/api/videos?configName=${encodeURIComponent(cfg.configName || cfg.name || "")}`)
      .then(r => r.json())
      .then((data: VideoType[]) => {
        const sorted = data.filter(v => v.analysis).sort((a, b) => b.views - a.views);
        setVideos(sorted);
      })
      .catch(() => setVideos([]))
      .finally(() => setLoadingVideos(false));
  }, [vs.clientId, clients]);

  // Scroll to result when it arrives
  useEffect(() => {
    if (vs.result) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [vs.result]);

  // Reset saved state when new result arrives
  useEffect(() => { setSaved(false); }, [vs.result]);

  async function saveScripts() {
    if (!vs.result || !vs.clientId) return;
    setSaving(true);
    try {
      const baseTitle = vs.result.title || "Viral Script";
      const shotListJson = vs.result.production?.shots ? JSON.stringify(vs.result.production.shots) : "";
      // Save short version
      await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: vs.clientId,
          title: `${baseTitle} — Kurz`,
          hook: vs.result.short.hook,
          textHook: vs.result.short.textHook || "",
          body: vs.result.short.body,
          cta: vs.result.short.cta,
          hookPattern: vs.result.structure.hookType,
          source: "viral-script",
          shotList: shotListJson,
          status: "entwurf",
        }),
      });
      // Save long version
      await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: vs.clientId,
          title: `${baseTitle} — Lang`,
          hook: vs.result.long.hook,
          textHook: vs.result.long.textHook || "",
          body: vs.result.long.body,
          cta: vs.result.long.cta,
          hookPattern: vs.result.structure.hookType,
          source: "viral-script",
          shotList: shotListJson,
          status: "entwurf",
        }),
      });
      setSaved(true);
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  const canGenerate = vs.clientId && (
    (vs.inputMode === "library" && vs.selectedVideoId) ||
    (vs.inputMode === "url" && vs.urlInput.trim().includes("instagram.com"))
  );

  const selectedClient = clients.find(c => c.id === vs.clientId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ocean">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ocean">Viral Script</h1>
          <p className="text-[12px] text-ocean/60 mt-0.5">
            Kopiere die Struktur viraler Videos und adaptiere sie für deine Kunden
          </p>
        </div>
      </div>

      {/* Setup */}
      <div className="rounded-xl border border-ocean/[0.06] bg-white p-6 space-y-5">
        {/* Client Selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-ocean/60">Client auswählen</label>
          <div className="relative">
            <select
              value={vs.clientId}
              onChange={e => vs.setClientId(e.target.value)}
              disabled={vs.running}
              className="w-full h-10 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 text-[13px] text-ocean appearance-none cursor-pointer focus:border-blush focus:outline-none"
            >
              <option value="">— Client wählen —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.configName || c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/40 pointer-events-none" />
          </div>
        </div>

        {/* Reference Video Input */}
        {vs.clientId && (
          <div className="space-y-3">
            <label className="text-xs text-ocean/60">Referenz-Video</label>

            {/* Tab toggle */}
            <div className="flex gap-1 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] p-1 w-fit">
              <button
                onClick={() => vs.setInputMode("library")}
                className={`rounded-lg px-4 py-1.5 text-[12px] font-medium transition-all ${
                  vs.inputMode === "library" ? "bg-warm-white text-ocean" : "text-ocean/50 hover:text-ocean"
                }`}
              >
                Aus Bibliothek
              </button>
              <button
                onClick={() => vs.setInputMode("url")}
                className={`rounded-lg px-4 py-1.5 text-[12px] font-medium transition-all ${
                  vs.inputMode === "url" ? "bg-warm-white text-ocean" : "text-ocean/50 hover:text-ocean"
                }`}
              >
                Instagram URL
              </button>
            </div>

            {vs.inputMode === "library" && (
              <div>
                {loadingVideos && (
                  <div className="flex items-center gap-2 text-xs text-ocean/50 py-4">
                    <Loader2 className="h-3 w-3 animate-spin" /> Videos laden...
                  </div>
                )}
                {!loadingVideos && videos.length === 0 && (
                  <p className="text-xs text-ocean/40 py-4">
                    Keine analysierten Videos für {selectedClient?.configName || "diesen Client"}.
                    Nutze den URL-Modus oder analysiere zuerst Competitor-Videos.
                  </p>
                )}
                {!loadingVideos && videos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                    {videos.slice(0, 12).map(v => (
                      <button
                        key={v.id}
                        onClick={() => vs.setSelectedVideoId(v.id)}
                        disabled={vs.running}
                        className={`text-left rounded-xl border p-3 transition-all ${
                          vs.selectedVideoId === v.id
                            ? "border-ocean bg-ocean/[0.03]"
                            : "border-ocean/[0.06] hover:border-ocean/15"
                        }`}
                      >
                        {v.thumbnail && (
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(v.thumbnail)}`}
                            alt=""
                            className="w-full h-24 object-cover rounded-lg mb-2"
                          />
                        )}
                        <div className="text-[11px] text-ocean/60">@{v.creator}</div>
                        <div className="text-[12px] text-ocean font-medium">{fmt(v.views)} Views</div>
                        {v.likes > 0 && <div className="text-[11px] text-ocean/40">{fmt(v.likes)} Likes</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {vs.inputMode === "url" && (
              <div className="flex gap-2">
                <Input
                  placeholder="https://www.instagram.com/reel/..."
                  value={vs.urlInput}
                  onChange={e => vs.setUrlInput(e.target.value)}
                  disabled={vs.running}
                  className="h-10 rounded-xl bg-ocean/[0.02] border-ocean/[0.06] text-ocean placeholder:text-ocean/25"
                />
                {vs.urlInput && vs.urlInput.includes("instagram.com") && (
                  <a href={vs.urlInput} target="_blank" rel="noopener noreferrer" className="flex items-center px-3 rounded-xl border border-ocean/[0.06] hover:bg-ocean/[0.02]">
                    <ExternalLink className="h-3.5 w-3.5 text-ocean/40" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={vs.generate}
          disabled={!canGenerate || vs.running}
          className="w-full rounded-full h-10 bg-ocean hover:bg-ocean-light text-white font-medium tracking-wide border-0 transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20"
        >
          {vs.running ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Wird generiert...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Viral Script erstellen
            </span>
          )}
        </Button>
      </div>

      {/* Pipeline Progress */}
      {vs.steps.length > 0 && !vs.result && (
        <div className="rounded-xl border border-ocean/[0.06] bg-white p-6">
          <StepIndicator steps={vs.steps} />
          {vs.error && (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-4 text-[13px] text-red-700">
              {vs.error}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {vs.result && (
        <div ref={resultRef} className="space-y-5">
          {/* Title + Meta */}
          <div className="rounded-xl border border-ocean/[0.06] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-ocean">{vs.result.title}</h2>
              {vs.result.reference.creator && (
                <span className="text-[11px] text-ocean/40">
                  Referenz: @{vs.result.reference.creator} ({fmt(vs.result.reference.views)} Views)
                </span>
              )}
            </div>
            <p className="text-[13px] text-ocean/60">{vs.result.reasoning}</p>
            <div className="flex gap-3 mt-3">
              <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{vs.result.structure.pattern}</span>
              <span className="text-[11px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">Hook: {vs.result.structure.hookType}</span>
            </div>

            {/* Critic Agent Results */}
            {vs.result.reviewIssues.length > 0 && (
              <div className="mt-4 rounded-lg bg-ocean/[0.03] border border-ocean/10 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[11px] font-medium text-ocean/70">Critic Agent</span>
                  {vs.result.criticScores && (
                    <div className="flex gap-2 ml-auto">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${vs.result.criticScores.short >= 8 ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                        Kurz: {vs.result.criticScores.short}/10
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${vs.result.criticScores.long >= 8 ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"}`}>
                        Lang: {vs.result.criticScores.long}/10
                      </span>
                      {vs.result.criticScores.rounds > 1 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                          {vs.result.criticScores.rounds} Runden
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <ul className="text-[11px] text-ocean/50 space-y-0.5">
                  {vs.result.reviewIssues.map((issue, i) => <li key={i}>• {issue}</li>)}
                </ul>
              </div>
            )}
          </div>

          {/* Hook Options — clickable */}
          <div className="rounded-xl border border-ocean/[0.06] bg-white p-5">
            <h3 className="text-sm font-medium text-ocean mb-3">Hook-Varianten</h3>
            <div className="space-y-2">
              {vs.result.hooks.options.map((opt, i) => {
                const isSelected = i === vs.result!.hooks.selected;
                return (
                  <button
                    key={i}
                    onClick={() => vs.selectHook(i)}
                    className={`w-full text-left rounded-lg p-4 text-[13px] transition-all ${
                      isSelected
                        ? "bg-green-50 border-2 border-green-300"
                        : "bg-ocean/[0.02] border border-ocean/[0.06] hover:border-ocean/15 hover:bg-ocean/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] uppercase tracking-wider ${isSelected ? "text-green-600" : "text-ocean/40"}`}>{opt.pattern}</span>
                      {isSelected && (
                        <span className="text-[10px] text-green-600 font-medium">Ausgewählt</span>
                      )}
                    </div>
                    <p className={`${isSelected ? "text-ocean" : "text-ocean/70"}`}>&quot;{opt.hook}&quot;</p>
                  </button>
                );
              })}
              <p className="text-[11px] text-ocean/40 mt-2">{vs.result.hooks.selectionReason}</p>
            </div>
          </div>

          {/* Scripts — Short + Long */}
          <div className="grid md:grid-cols-2 gap-5">
            <ScriptCard
              version={vs.result.short}
              label="Kurz (30-40s)"
              color="border-blue-200 bg-blue-50/30"
              variant="short"
              onUpdate={(field, value) => vs.updateScript("short", field, value)}
            />
            <ScriptCard
              version={vs.result.long}
              label="Lang (50-70s)"
              color="border-purple-200 bg-purple-50/30"
              variant="long"
              onUpdate={(field, value) => vs.updateScript("long", field, value)}
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={saveScripts}
              disabled={saving || saved}
              className={`rounded-full h-10 px-6 font-medium tracking-wide border-0 transition-all duration-300 ${
                saved
                  ? "bg-green-500 hover:bg-green-500 text-white"
                  : "bg-ocean hover:bg-ocean-light text-white hover:shadow-lg hover:shadow-ocean/20"
              }`}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert...
                </span>
              ) : saved ? (
                <span className="flex items-center gap-2">
                  <Check className="h-4 w-4" /> Gespeichert
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" /> Zum Client speichern
                </span>
              )}
            </Button>
          </div>

          {/* Production Notes */}
          {vs.result.production && (
            <div>
              <button
                onClick={() => setShowProduction(!showProduction)}
                className="flex items-center gap-2 text-[13px] font-medium text-ocean/70 hover:text-ocean transition-colors mb-3"
              >
                {showProduction ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Camera className="h-3.5 w-3.5" />
                Filming & Editing Notes
              </button>

              {showProduction && (
                <div className="space-y-4">
                  <ShotListSection shots={vs.result.production.shots || []} />

                  {vs.result.production.musicMood && (
                    <div className="rounded-xl border border-ocean/[0.06] bg-white p-4 flex items-center gap-3">
                      <Music className="h-4 w-4 text-ocean/40" />
                      <div>
                        <span className="text-[11px] text-ocean/40 uppercase tracking-wider">Musik-Stimmung</span>
                        <p className="text-[13px] text-ocean/70">{vs.result.production.musicMood}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
