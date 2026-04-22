"use client";

import { useEffect, useRef, useState, useMemo, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Heart, MessageCircle, Film, Sparkles, Search, Star, Play,
  ArrowUpDown, ExternalLink, Loader2, CheckCircle2, XCircle,
  Terminal, ChevronDown, ChevronUp, AlertTriangle, Video, Users,
  Plus, Pencil, Trash2, Eye, UserCheck, RefreshCw, UserPlus,
} from "lucide-react";

import { MarkdownContent } from "@/components/markdown-content";
import { usePipeline } from "@/context/pipeline-context";
import { useGeneration } from "@/context/generation-context";
import { useI18n } from "@/lib/i18n";
import type { Video as VideoType, Config, Creator } from "@/lib/types";
import type { CreatorSuggestion } from "@/app/api/configs/[id]/research-creators/route";

import { fmt } from "@/lib/format";

const TIER_STYLES: Record<string, { label: string; color: string }> = {
  mega:  { label: "Mega",  color: "bg-amber-500/10 text-ivory border-amber-500/20" },
  macro: { label: "Macro", color: "bg-blush/20 text-blush-dark border-blush/40" },
  mid:   { label: "Mid",   color: "bg-wind/20 text-ocean/60 border-ocean/[0.06]" },
  micro: { label: "Micro", color: "bg-green-50 text-green-600 border-green-200" },
};

/* ─── SuggestionCard (from creators page) ─── */

function SuggestionCard({
  s, onAdd, adding, added, t,
}: {
  s: CreatorSuggestion;
  onAdd: () => void;
  adding: boolean;
  added: boolean;
  t: (key: string) => string;
}) {
  const tier = TIER_STYLES[s.tier] || TIER_STYLES.mid;
  return (
    <div className={`glass rounded-2xl p-4 border transition-all duration-200 ${added ? "border-green-200 bg-green-50" : "border-ocean/[0.06] hover:border-ocean/5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={`https://www.instagram.com/${s.username}/`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blush-dark hover:text-blush-dark/80 underline underline-offset-2 transition-colors">
              @{s.username}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
            <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tier.color}`}>
              {tier.label}
            </span>
            {s.estimatedFollowers && (
              <span className="text-[11px] text-ocean/60">{s.estimatedFollowers}</span>
            )}
            {s.verified ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                {t("creators.verified")}
              </span>
            ) : s.confidence !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${
                s.confidence >= 9 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                s.confidence >= 7 ? "bg-amber-500/10 border-amber-500/20 text-ivory" :
                "bg-red-50 border-red-200 text-red-500"
              }`}>
                {s.confidence >= 9 ? t("creators.confident") : s.confidence >= 7 ? t("creators.likely") : t("creators.uncertain")}
              </span>
            )}
          </div>
          <p className="text-xs text-ocean/60 mt-1.5 leading-relaxed">{s.why}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {s.strength && (
              <span className="text-[10px] rounded-lg bg-ocean/[0.02] border border-ocean/[0.06] px-2 py-0.5 text-ocean/60">
                ⚡ {s.strength}
              </span>
            )}
            {s.contentStyle && (
              <span className="text-[10px] rounded-lg bg-ocean/[0.02] border border-ocean/[0.06] px-2 py-0.5 text-ocean/60">
                🎬 {s.contentStyle}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {added ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-green-600">
              <UserCheck className="h-3.5 w-3.5" /> {t("creators.added")}
            </span>
          ) : (
            <Button size="sm" onClick={onAdd} disabled={adding}
              className="h-8 rounded-xl gap-1.5 text-xs bg-ocean hover:bg-ocean-light border-0">
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              {adding ? t("creators.verifying") : t("common.add")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ─── */

type Tab = "videos" | "creators";
type SortOption = "views" | "date-posted" | "date-added" | "starred";

export default function ResearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-ocean/50 text-sm">Laden…</div>}>
      <ResearchContent />
    </Suspense>
  );
}

function ResearchContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("videos");
  const [client, setClient] = useState<Config | null>(null);

  // ── Shared: fetch client once ──
  useEffect(() => {
    fetch(`/api/configs/${id}`).then((r) => r.json()).then(setClient);
  }, [id]);

  // ══════════════════════════════════════════
  // VIDEOS TAB STATE
  // ══════════════════════════════════════════
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [filterCreator, setFilterCreator] = useState<string>(searchParams.get("creator") || "all");
  const [sortBy, setSortBy] = useState<SortOption>("views");
  const [modalVideo, setModalVideo] = useState<VideoType | null>(null);
  const [modalSection, setModalSection] = useState<"analysis" | "concepts">("analysis");
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Pipeline state
  const { running, progress, runPipeline, clearProgress } = usePipeline();
  const [pipelineOpen, setPipelineOpen] = useState(false);

  // Clear stale pipeline state (e.g. from interrupted previous run)
  useEffect(() => {
    if (!running && progress && progress.status === "running") {
      clearProgress();
    }
  }, [running, progress, clearProgress]);
  const [maxVideos, setMaxVideos] = useState(20);
  const [topK, setTopK] = useState(3);
  const [nDays, setNDays] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const loadVideos = useCallback(() => {
    if (!client?.configName) return;
    fetch(`/api/videos?configName=${encodeURIComponent(client.configName)}`).then((r) => r.json()).then(setVideos);
  }, [client?.configName]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  // Reload videos whenever a new video is analyzed (videosAnalyzed changes)
  useEffect(() => {
    if (progress?.status === "completed" || (progress?.videosAnalyzed && progress.videosAnalyzed > 0)) {
      loadVideos();
    }
  }, [progress?.status, progress?.videosAnalyzed, loadVideos]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progress?.log.length]);

  const handleRun = () => {
    if (!client) return;
    runPipeline({ configName: client.configName, maxVideos, topK, nDays });
  };

  const uniqueCreators = useMemo(() => [...new Set(videos.map((v) => v.creator))].sort(), [videos]);

  const filtered = useMemo(() =>
    videos
      .filter((v) => filterCreator === "all" || v.creator === filterCreator)
      .sort((a, b) => {
        if (sortBy === "starred") {
          if (a.starred !== b.starred) return a.starred ? -1 : 1;
          return b.views - a.views;
        }
        if (sortBy === "views") return b.views - a.views;
        if (sortBy === "date-posted") return (b.datePosted || "").localeCompare(a.datePosted || "");
        if (sortBy === "date-added") return (b.dateAdded || "").localeCompare(a.dateAdded || "");
        return 0;
      }),
    [videos, filterCreator, sortBy]);

  const openModal = async (video: VideoType, section: "analysis" | "concepts") => {
    setModalSection(section);
    if (!video.analysis && !video.newConcepts) {
      setModalVideo(video);
      try {
        const detail = await fetch(`/api/videos/${video.id}`).then(r => r.json());
        setModalVideo(detail);
        setVideos(prev => prev.map(v => v.id === video.id ? { ...v, analysis: detail.analysis, newConcepts: detail.newConcepts } : v));
      } catch {
        setModalVideo(video);
      }
    } else {
      setModalVideo(video);
    }
  };

  const toggleStar = async (videoId: string, currentStarred: boolean) => {
    const newStarred = !currentStarred;
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, starred: newStarred } : v))
    );
    await fetch("/api/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: videoId, starred: newStarred }),
    });
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm("Video wirklich löschen?")) return;
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    setSelectedVideos((prev) => { const n = new Set(prev); n.delete(videoId); return n; });
    await fetch(`/api/videos?id=${videoId}`, { method: "DELETE" });
  };

  const toggleSelect = (videoId: string) => {
    setSelectedVideos((prev) => {
      const n = new Set(prev);
      if (n.has(videoId)) n.delete(videoId); else n.add(videoId);
      return n;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedVideos.size === 0) return;
    if (!confirm(`${selectedVideos.size} Videos wirklich löschen?`)) return;
    const ids = [...selectedVideos];
    setVideos((prev) => prev.filter((v) => !selectedVideos.has(v.id)));
    setSelectedVideos(new Set());
    setSelectMode(false);
    await fetch(`/api/videos?ids=${ids.join(",")}`, { method: "DELETE" });
  };

  const selectAll = () => {
    if (selectedVideos.size === filtered.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(filtered.map((v) => v.id)));
    }
  };

  const totalProgress = progress
    ? progress.phase === "scraping"
      ? progress.creatorsTotal > 0 ? (progress.creatorsScraped / progress.creatorsTotal) * 40 : 0
      : progress.videosTotal > 0 ? 40 + (progress.videosAnalyzed / progress.videosTotal) * 60 : 40
    : 0;

  // ══════════════════════════════════════════
  // CREATORS TAB STATE
  // ══════════════════════════════════════════
  const [creators, setCreators] = useState<Creator[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Creator | null>(null);
  const [form, setForm] = useState({ username: "", category: "" });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Research state
  const [researchOpen, setResearchOpen] = useState(false);
  const [focusHint, setFocusHint] = useState("");
  const [addingUsername, setAddingUsername] = useState<string | null>(null);
  const [addedUsernames, setAddedUsernames] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);

  const { creatorResearchGen, startCreatorResearch, clearCreatorResearch } = useGeneration();
  const researchState = creatorResearchGen.get(id);
  const researching = researchState?.status === "running";
  const suggestions = (researchState?.suggestions as CreatorSuggestion[] | undefined) ?? [];
  const researchError = researchState?.status === "error" ? (researchState.error ?? t("creators.researchFailed")) : null;

  useEffect(() => {
    if (researchState?.status === "done" && suggestions.length > 0) {
      setResearchOpen(true);
    }
  }, [researchState?.status]);

  const loadCreators = () => {
    fetch("/api/creators").then((r) => r.json()).then(setCreators);
  };

  useEffect(() => {
    loadCreators();
  }, [id]);

  const clientCreators = client
    ? creators.filter((c) => c.category === client.creatorsCategory)
    : [];

  const existingUsernames = new Set(clientCreators.map(c => c.username.toLowerCase()));

  const openNew = () => {
    setEditing(null);
    setForm({ username: "", category: client?.creatorsCategory || "" });
    setDialogOpen(true);
  };

  const openEdit = (creator: Creator) => {
    setEditing(creator);
    setForm({ username: creator.username, category: creator.category });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await fetch("/api/creators", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
      } else {
        await fetch("/api/creators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setDialogOpen(false);
      loadCreators();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (creatorId: string) => {
    if (!confirm(t("creators.confirmDelete"))) return;
    await fetch(`/api/creators?id=${creatorId}`, { method: "DELETE" });
    loadCreators();
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/creators/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "progress" && data.status === "scraping") {
                const c = creators.find((cr) => cr.username === data.username);
                if (c) setRefreshingId(c.id);
              } else if (data.type === "progress" && data.status === "done") {
                loadCreators();
              } else if (data.type === "complete") {
                setRefreshingId(null);
              }
            } catch { /* skip */ }
          }
        }
      }
    } finally {
      setRefreshing(false);
      setRefreshingId(null);
      loadCreators();
    }
  };

  const handleRefreshOne = async (creatorId: string) => {
    setRefreshingId(creatorId);
    try {
      const response = await fetch("/api/creators/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [creatorId] }),
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      loadCreators();
    } finally {
      setRefreshingId(null);
    }
  };

  const runResearch = () => {
    clearCreatorResearch(id);
    startCreatorResearch(id, focusHint);
  };

  const addSuggestion = async (s: CreatorSuggestion) => {
    if (addingUsername) return;
    setAddError(null);
    setAddingUsername(s.username);
    try {
      const verifyRes = await fetch("/api/verify-creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: s.username }),
      });
      const verifyData = await verifyRes.json().catch(() => ({})) as { error?: string; username?: string };
      if (!verifyRes.ok) {
        setAddError(verifyData.error || `@${s.username} ${t("creators.notFound")}`);
        return;
      }

      const canonicalUsername = verifyData.username || s.username;
      await fetch("/api/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: canonicalUsername,
          category: client?.creatorsCategory || "",
          profilePicUrl: (verifyData as Record<string, unknown>).profilePicUrl || "",
          followers: (verifyData as Record<string, unknown>).followers || 0,
        }),
      });
      setAddedUsernames(prev => new Set([...prev, canonicalUsername.toLowerCase()]));
      loadCreators();
      fetch("/api/creators/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [] }),
      }).then(() => loadCreators()).catch(() => {});
    } finally {
      setAddingUsername(null);
    }
  };

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Research</h1>
          <p className="mt-1 text-sm text-ocean/60">
            Competitor analysis for {client?.configName || "this client"}
            {client?.creatorsCategory && (
              <Badge variant="secondary" className="ml-2 rounded-md text-[10px] bg-ocean/[0.02] border border-ocean/[0.06]">
                {client.creatorsCategory}
              </Badge>
            )}
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex gap-1.5">
          <button onClick={() => setTab("videos")} className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === "videos" ? "bg-blush-light/60 text-ocean" : "text-ocean/60 hover:text-ocean hover:bg-warm-white"}`}>
            <Video className="h-3.5 w-3.5 inline mr-1.5" />Videos
          </button>
          <button onClick={() => setTab("creators")} className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === "creators" ? "bg-blush-light/60 text-ocean" : "text-ocean/60 hover:text-ocean hover:bg-warm-white"}`}>
            <Users className="h-3.5 w-3.5 inline mr-1.5" />Creators
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════ */}
      {/* VIDEOS TAB */}
      {/* ══════════════════════════════════════ */}
      {tab === "videos" && (
        <>
          {/* Run Pipeline button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setPipelineOpen(!pipelineOpen)}
              disabled={running}
              className="rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5"
            >
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
              ) : (
                <><Play className="h-4 w-4" /> Run Pipeline</>
              )}
            </Button>
          </div>

          {/* Pipeline Panel */}
          {(pipelineOpen || running || progress) && (
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ocean/60">Client:</span>
                  <span className="font-medium">{client?.configName}</span>
                  {client?.creatorsCategory && (
                    <Badge variant="secondary" className="rounded-md text-[10px] bg-ocean/[0.02] border border-ocean/[0.06]">
                      {client.creatorsCategory}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {running && (
                    <button
                      onClick={clearProgress}
                      className="flex items-center gap-1 text-xs text-red-500/70 hover:text-red-500 transition-colors"
                    >
                      <XCircle className="h-3 w-3" /> Cancel
                    </button>
                  )}
                  {!running && (
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-1 text-xs text-ocean/60 hover:text-ocean transition-colors"
                    >
                      <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                      Advanced
                    </button>
                  )}
                </div>
              </div>

              {showAdvanced && !running && (
                <div className="grid gap-3 md:grid-cols-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div>
                    <Label className="text-xs text-ocean/60">Max Videos per Creator</Label>
                    <Input type="number" value={maxVideos} onChange={(e) => setMaxVideos(Number(e.target.value))} min={1} max={100} className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10" />
                  </div>
                  <div>
                    <Label className="text-xs text-ocean/60">Top K to Analyze</Label>
                    <Input type="number" value={topK} onChange={(e) => setTopK(Number(e.target.value))} min={1} max={10} className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10" />
                  </div>
                  <div>
                    <Label className="text-xs text-ocean/60">Days Lookback</Label>
                    <Input type="number" value={nDays} onChange={(e) => setNDays(Number(e.target.value))} min={1} max={365} className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-10" />
                  </div>
                </div>
              )}

              {!running && !progress && (
                <Button onClick={handleRun} disabled={!client} className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0 font-semibold gap-2">
                  <Play className="h-4 w-4" /> Run Pipeline
                </Button>
              )}

              {/* Progress */}
              {progress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {progress.status === "running" && <Loader2 className="h-4 w-4 text-blush-dark animate-spin" />}
                      {progress.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                      {progress.status === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="text-sm font-medium">
                        {progress.status === "running" && progress.phase === "scraping" && "Scraping creators..."}
                        {progress.status === "running" && progress.phase === "analyzing" && "Analyzing videos..."}
                        {progress.status === "completed" && "Pipeline complete"}
                        {progress.status === "error" && "Pipeline failed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ocean/60">
                      {progress.phase === "scraping" && (
                        <span>Creators: <span className="text-ocean">{progress.creatorsScraped}/{progress.creatorsTotal}</span></span>
                      )}
                      {(progress.phase === "analyzing" || progress.phase === "done") && (
                        <span>Videos: <span className="text-ocean">{progress.videosAnalyzed}/{progress.videosTotal}</span></span>
                      )}
                      {progress.errors.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-500">
                          <AlertTriangle className="h-3 w-3" />{progress.errors.length}
                        </span>
                      )}
                      {(progress.status === "completed" || progress.status === "error") && (
                        <button onClick={clearProgress} className="text-ocean/40 hover:text-ocean transition-colors">Dismiss</button>
                      )}
                    </div>
                  </div>

                  <div className="h-1.5 rounded-full bg-ocean/[0.02] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progress.status === "completed" ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                        : progress.status === "error" ? "bg-gradient-to-r from-red-500 to-orange-500"
                        : "bg-ocean"
                      }`}
                      style={{ width: `${progress.status === "completed" ? 100 : totalProgress}%` }}
                    />
                  </div>

                  {progress.activeTasks.length > 0 && (
                    <div className="space-y-1.5">
                      {progress.activeTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 rounded-xl bg-ocean/[0.02] border border-ocean/[0.06] px-3 py-2">
                          <Loader2 className="h-3 w-3 text-blush-dark animate-spin shrink-0" />
                          <span className="text-xs font-medium">@{task.creator}</span>
                          <span className="text-[11px] text-ocean/60">{task.step}</span>
                          {task.views && <span className="ml-auto text-[11px] text-ocean/65">{fmt(task.views)} views</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {progress.errors.length > 0 && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-1">
                      <p className="text-[11px] font-medium text-red-500">Errors ({progress.errors.length})</p>
                      {progress.errors.map((err, i) => (
                        <p key={i} className="text-[11px] text-red-500/70">{err}</p>
                      ))}
                    </div>
                  )}

                  <details className="rounded-xl glass overflow-hidden">
                    <summary className="px-3 py-2 flex items-center gap-2 cursor-pointer text-xs text-ocean/60 hover:text-ocean transition-colors">
                      <Terminal className="h-3.5 w-3.5" />
                      Log
                      <Badge variant="secondary" className="ml-auto rounded-md text-[10px] bg-ocean/[0.02] border border-ocean/[0.06]">
                        {progress.log.length}
                      </Badge>
                    </summary>
                    <div className="border-t border-ocean/[0.06]">
                      <ScrollArea className="h-[200px] p-3">
                        <div className="space-y-0.5 font-mono text-[11px]">
                          {progress.log.map((line, i) => (
                            <div key={i} className={`leading-5 ${
                              line.includes("Error") || line.includes("error") ? "text-red-500"
                              : line.includes("done") || line.includes("complete") || line.includes("Complete") ? "text-emerald-400/80"
                              : "text-ocean/60"
                            }`}>{line}</div>
                          ))}
                          <div ref={logEndRef} />
                        </div>
                      </ScrollArea>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}

          {/* Filters & Sort */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterCreator} onValueChange={setFilterCreator}>
              <SelectTrigger className="w-[200px] rounded-xl glass border-ocean/[0.06] h-10">
                <SelectValue placeholder="Filter by creator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Creators</SelectItem>
                {uniqueCreators.map((c) => (
                  <SelectItem key={c} value={c}>@{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px] rounded-xl glass border-ocean/[0.06] h-10">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-ocean/60" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="views">Most Views</SelectItem>
                <SelectItem value="date-posted">Date Posted</SelectItem>
                <SelectItem value="date-added">Date Added</SelectItem>
                <SelectItem value="starred">Starred First</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="rounded-lg px-3 py-1.5 text-xs bg-ocean/[0.02] border border-ocean/[0.06]">
              {filtered.length} videos
            </Badge>

            <div className="ml-auto flex items-center gap-2">
              {selectMode && selectedVideos.size > 0 && (
                <Button variant="ghost" size="sm" onClick={handleBulkDelete}
                  className="rounded-xl text-xs h-8 gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" /> {selectedVideos.size} löschen
                </Button>
              )}
              {selectMode && (
                <Button variant="ghost" size="sm" onClick={selectAll}
                  className="rounded-xl text-xs h-8 gap-1.5 text-ocean/60 hover:text-ocean">
                  {selectedVideos.size === filtered.length ? "Keine" : "Alle"}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setSelectMode(!selectMode); setSelectedVideos(new Set()); }}
                className="rounded-xl text-xs h-8 gap-1.5 text-ocean/60 hover:text-ocean">
                {selectMode ? "Fertig" : "Auswählen"}
              </Button>
            </div>
          </div>

          {/* Video Grid */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((video) => {
              const vid = video.id || video.link;
              return (
                <div key={vid} className="group relative">
                  {selectMode && (
                    <button onClick={() => toggleSelect(vid)}
                      className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        selectedVideos.has(vid) ? "bg-ocean border-ocean text-white" : "bg-white/80 border-ocean/30 hover:border-ocean"
                      }`}>
                      {selectedVideos.has(vid) && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                  )}
                  <div className={`glass rounded-2xl overflow-hidden transition-all duration-300 hover:border-ocean/[0.12] ${
                    selectMode && selectedVideos.has(vid) ? "ring-2 ring-ocean" : ""
                  }`}>
                    <a href={selectMode ? undefined : video.link} target="_blank" rel="noopener noreferrer"
                      onClick={selectMode ? (e) => { e.preventDefault(); toggleSelect(vid); } : undefined}
                      className="relative block aspect-[9/16] w-full bg-ocean/[0.02] overflow-hidden cursor-pointer">
                      {video.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`}
                          alt={`@${video.creator}`}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Film className="h-10 w-10 text-ocean/20" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-8 pb-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <Play className="h-4 w-4 text-white fill-white" />
                          <span className="text-[15px] font-bold text-white">{fmt(video.views)}</span>
                        </div>
                      </div>
                    </a>

                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold truncate">@{video.creator}</p>
                        <div className="flex items-center gap-1 shrink-0 ml-1.5">
                          <button onClick={() => toggleStar(vid, video.starred)} className="transition-colors">
                            <Star className={`h-4 w-4 ${video.starred ? "fill-yellow-400 text-yellow-400" : "text-ocean/65 hover:text-yellow-400/60"}`} />
                          </button>
                          <button onClick={() => handleDeleteVideo(vid)} className="transition-colors text-ocean/30 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-ocean/60">
                        <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(video.likes)}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{fmt(video.comments)}</span>
                        <span className="ml-auto text-[10px]">{video.datePosted}</span>
                      </div>

                      <div className="flex gap-1.5 pt-1">
                        <Button variant="ghost" size="sm" onClick={() => openModal(video, "analysis")}
                          className="flex-1 rounded-xl text-[11px] h-7 gap-1 glass border-ocean/[0.06] text-ocean/60 hover:text-ocean">
                          <Search className="h-3 w-3" /> Analysis
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openModal(video, "concepts")}
                          className="flex-1 rounded-xl text-[11px] h-7 gap-1 glass border-ocean/[0.06] text-ocean/60 hover:text-ocean">
                          <Sparkles className="h-3 w-3" /> Concepts
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && !running && (
            <div className="glass rounded-2xl p-12 text-center">
              <Film className="mx-auto h-10 w-10 text-ocean/60" />
              <h3 className="mt-4 font-semibold">No videos yet</h3>
              <p className="mt-1 text-sm text-ocean/60">Run the pipeline to analyze competitor reels.</p>
              <Button onClick={() => setPipelineOpen(true)} className="mt-4 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5">
                <Play className="h-4 w-4" /> Run Pipeline
              </Button>
            </div>
          )}

          {/* Analysis / Concepts Modal */}
          <Dialog open={!!modalVideo} onOpenChange={(open) => { if (!open) setModalVideo(null); }}>
            <DialogContent className="max-w-3xl max-h-[90vh] h-[90vh] flex flex-col overflow-hidden glass-strong rounded-2xl border-ocean/[0.06] p-0 gap-0">
              <DialogTitle className="sr-only">
                {modalSection === "analysis" ? "Video Analysis" : "New Concepts"}
              </DialogTitle>
              {modalVideo && (
                <>
                  <div className="flex items-center gap-4 p-5 border-b border-ocean/[0.06] shrink-0">
                    <div className="relative h-16 w-12 shrink-0 rounded-lg overflow-hidden bg-ocean/[0.02]">
                      {modalVideo.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/proxy-image?url=${encodeURIComponent(modalVideo.thumbnail)}`} alt={`@${modalVideo.creator}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Film className="h-4 w-4 text-ocean/60" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">@{modalVideo.creator}</p>
                        <a href={modalVideo.link} target="_blank" rel="noopener noreferrer" className="text-ocean/60 hover:text-blush-dark transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-ocean/60">
                        <span className="inline-flex items-center gap-1"><Play className="h-3 w-3 fill-current" />{fmt(modalVideo.views)}</span>
                        <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(modalVideo.likes)}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{fmt(modalVideo.comments)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setModalSection("analysis")}
                        className={`rounded-xl text-xs h-8 gap-1.5 ${modalSection === "analysis" ? "bg-blush/20 text-blush-dark border border-blush/40" : "text-ocean/60 hover:text-ocean"}`}>
                        <Search className="h-3 w-3" /> Analysis
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setModalSection("concepts")}
                        className={`rounded-xl text-xs h-8 gap-1.5 ${modalSection === "concepts" ? "bg-red-50 text-red-500 border border-red-200" : "text-ocean/60 hover:text-ocean"}`}>
                        <Sparkles className="h-3 w-3" /> Concepts
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-6">
                    <MarkdownContent
                      content={modalSection === "analysis" ? modalVideo.analysis : modalVideo.newConcepts}
                      variant={modalSection === "analysis" ? "analysis" : "concepts"}
                    />
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ══════════════════════════════════════ */}
      {/* CREATORS TAB */}
      {/* ══════════════════════════════════════ */}
      {tab === "creators" && (
        <>
          {/* Creator actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleRefreshAll} disabled={refreshing}
              className="rounded-xl glass border-ocean/[0.06] gap-1.5 text-xs">
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t("common.refreshAll")}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} variant="ghost"
                  className="rounded-xl glass border border-ocean/[0.06] gap-1.5 text-xs">
                  <Plus className="h-4 w-4" /> {t("creators.addManual")}
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-strong rounded-2xl border-ocean/[0.06]">
                <DialogHeader>
                  <DialogTitle>{editing ? t("creators.editCreator") : t("creators.addCreator")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div>
                    <Label className="text-xs text-ocean/60">{t("creators.igUsername")}</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder={t("creators.placeholder")} className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-ocean/60">{t("creators.category")}</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11" readOnly={!editing} />
                    {!editing && (
                      <p className="mt-1 text-[11px] text-ocean/60">
                        {t("creators.autoSet")} {client?.creatorsCategory}
                      </p>
                    )}
                  </div>
                  {!editing && (
                    <p className="text-[11px] text-ocean/60">
                      {t("creators.autoScrape")}
                    </p>
                  )}
                  <Button onClick={handleSave} disabled={saving || !form.username || !form.category}
                    className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0">
                    {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? t("creators.savingCreator") : t("creators.addingTo")}</> : editing ? t("common.save") : t("common.add")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button onClick={() => setResearchOpen(!researchOpen)}
              className="rounded-xl h-10 gap-1.5 bg-ocean hover:bg-ocean-light border-0 text-xs">
              <Search className="h-3.5 w-3.5" /> {t("creators.research")}
              {researchOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          {/* Research Panel */}
          {researchOpen && (
            <div className="rounded-2xl border border-blush/40 bg-gradient-to-br from-blush/10 to-wind/10 p-5 space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blush/20 border border-blush/40">
                  <Sparkles className="h-4 w-4 text-blush-dark" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t("creators.aiResearch")}</p>
                  <p className="text-xs text-ocean/60">
                    {t("creators.aiResearchDesc")} <strong className="text-ocean/70">{client?.creatorsCategory}</strong>
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={focusHint}
                  onChange={(e) => setFocusHint(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !researching) runResearch(); }}
                  placeholder={t("creators.focusPlaceholder")}
                  className="flex-1 rounded-xl glass border-ocean/[0.06] h-11 text-sm"
                />
                <Button onClick={runResearch} disabled={researching}
                  className="h-11 px-5 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-2 shrink-0">
                  {researching
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("creators.researching")}</>
                    : <><Search className="h-4 w-4" /> {t("creators.researchBtn")}</>}
                </Button>
              </div>

              {(researchError || addError) && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{researchError || addError}</p>
              )}

              {researching && (
                <div className="space-y-2 px-1">
                  <div className="flex items-center gap-2 text-sm text-ocean/60">
                    <Loader2 className="h-4 w-4 animate-spin text-blush-dark" />
                    {t("creators.aiSearching")}
                  </div>
                  <p className="text-xs text-ocean/65 pl-6">{t("creators.focusMega")}</p>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-ivory shrink-0" />
                    <p className="text-xs text-ivory" dangerouslySetInnerHTML={{ __html: t("creators.aiBanner") }} />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs text-ocean/60">{suggestions.length} {t("creators.suggestionsFound")}</p>
                    {(["mega", "macro", "mid", "micro"] as const).map(tier => {
                      const count = suggestions.filter(s => s.tier === tier).length;
                      if (!count) return null;
                      const style = TIER_STYLES[tier];
                      return (
                        <span key={tier} className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-medium ${style.color}`}>
                          {style.label} · {count}
                        </span>
                      );
                    })}
                  </div>

                  {(["mega", "macro", "mid", "micro"] as const).map(tier => {
                    const group = suggestions.filter(s => s.tier === tier);
                    if (!group.length) return null;
                    const style = TIER_STYLES[tier];
                    return (
                      <div key={tier} className="space-y-2">
                        <p className={`text-[10px] font-medium uppercase tracking-wider ${style.color.split(" ")[1]}`}>
                          {style.label}
                        </p>
                        {group.map(s => {
                          const alreadyExists = existingUsernames.has(s.username.toLowerCase());
                          const wasAdded = addedUsernames.has(s.username.toLowerCase());
                          return (
                            <SuggestionCard
                              key={s.username}
                              s={s}
                              onAdd={() => addSuggestion(s)}
                              adding={addingUsername === s.username}
                              added={alreadyExists || wasAdded}
                              t={t}
                            />
                          );
                        })}
                      </div>
                    );
                  })}

                  <div className="rounded-xl bg-ocean/[0.02] border border-ocean/5 px-4 py-3">
                    <p className="text-[11px] text-ocean/70 flex items-center gap-1.5">
                      <Star className="h-3 w-3 text-ivory/60 shrink-0" />
                      {t("creators.profileHint")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Creator Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clientCreators.map((creator) => {
              const isRefreshing = refreshingId === creator.id;
              return (
                <div key={creator.id}
                  className={`group glass rounded-2xl p-5 transition-all duration-300 hover:bg-warm-white hover:border-ocean/5 ${isRefreshing ? "animate-pulse" : ""}`}>
                  <div className="flex items-start justify-between">
                    <a href={`https://www.instagram.com/${creator.username}/`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-blush/20 to-wind/20 border border-ocean/5">
                        {creator.profilePicUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/proxy-image?url=${encodeURIComponent(creator.profilePicUrl)}`}
                            alt={`@${creator.username}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-ocean/70">
                            {creator.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold hover:text-blush-dark transition-colors">@{creator.username}</p>
                        <Badge variant="secondary" className="mt-0.5 rounded-md text-[10px] bg-ocean/[0.02] border border-ocean/[0.06]">
                          {creator.category}
                        </Badge>
                      </div>
                    </a>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => handleRefreshOne(creator.id)} disabled={isRefreshing}
                        className="h-7 w-7 p-0 rounded-lg text-ocean/60 hover:text-ocean">
                        {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(creator)}
                        className="h-7 w-7 p-0 rounded-lg text-ocean/60 hover:text-ocean">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(creator.id)}
                        className="h-7 w-7 p-0 rounded-lg text-ocean/60 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {(creator.followers > 0 || creator.lastScrapedAt) ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-black/20 border border-ocean/[0.06] p-2.5 text-center">
                        <UserCheck className="mx-auto h-3.5 w-3.5 text-ocean/60 mb-1" />
                        <p className="text-sm font-bold">{fmt(creator.followers)}</p>
                        <p className="text-[9px] text-ocean/60 uppercase tracking-wider">Follower</p>
                      </div>
                      <div className="rounded-xl bg-black/20 border border-ocean/[0.06] p-2.5 text-center">
                        <Film className="mx-auto h-3.5 w-3.5 text-blush-dark mb-1" />
                        <p className="text-sm font-bold">{creator.reelsCount30d}</p>
                        <p className="text-[9px] text-ocean/60 uppercase tracking-wider">Reels/30d</p>
                      </div>
                      <div className="rounded-xl bg-black/20 border border-ocean/[0.06] p-2.5 text-center">
                        <Eye className="mx-auto h-3.5 w-3.5 text-emerald-400 mb-1" />
                        <p className="text-sm font-bold">{fmt(creator.avgViews30d)}</p>
                        <p className="text-[9px] text-ocean/60 uppercase tracking-wider">O Views</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl bg-black/20 border border-ocean/[0.06] p-3 text-center">
                      <p className="text-[11px] text-ocean/60">
                        {t("creators.noData")} <RefreshCw className="inline h-3 w-3" /> {t("creators.clickScrape")}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between">
                    {creator.lastScrapedAt ? (
                      <p className="text-[10px] text-ocean/65">
                        {t("creators.scraped")} {new Date(creator.lastScrapedAt).toLocaleDateString()}
                      </p>
                    ) : <span />}
                    <button onClick={() => { setFilterCreator(creator.username); setTab("videos"); }}
                      className="inline-flex items-center gap-1 text-[11px] text-blush-dark hover:text-blush-dark/80 transition-colors">
                      {t("creators.viewVideos")} <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {clientCreators.length === 0 && !researchOpen && (
              <div className="col-span-full glass rounded-2xl p-12 text-center">
                <Users className="mx-auto h-10 w-10 text-ocean/60" />
                <h3 className="mt-4 font-semibold">{t("creators.noCreators")}</h3>
                <p className="mt-1 text-sm text-ocean/60 mb-5">{t("creators.noCreatorsHint")}</p>
                <Button onClick={() => setResearchOpen(true)}
                  className="rounded-xl h-9 gap-1.5 bg-ocean hover:bg-ocean-light border-0 text-xs">
                  <Search className="h-3.5 w-3.5" /> {t("creators.startResearch")}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
