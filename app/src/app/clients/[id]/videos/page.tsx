"use client";

import { useEffect, useRef, useState, Suspense } from "react";
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
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart, MessageCircle, Film, Sparkles, Search, Star, Play,
  ArrowUpDown, ExternalLink, Loader2, CheckCircle2, XCircle,
  Terminal, ChevronDown, AlertTriangle,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";
import { usePipeline } from "@/context/pipeline-context";
import type { Video, Config } from "@/lib/types";

function formatViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

type SortOption = "views" | "date-posted" | "date-added" | "starred";

export default function ClientVideosPage() {
  return (
    <Suspense>
      <ClientVideosContent />
    </Suspense>
  );
}

function ClientVideosContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<Video[]>([]);
  const [client, setClient] = useState<Config | null>(null);
  const [filterCreator, setFilterCreator] = useState<string>(searchParams.get("creator") || "all");
  const [sortBy, setSortBy] = useState<SortOption>("views");
  const [modalVideo, setModalVideo] = useState<Video | null>(null);
  const [modalSection, setModalSection] = useState<"analysis" | "concepts">("analysis");

  // Pipeline state
  const { running, progress, runPipeline } = usePipeline();
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [maxVideos, setMaxVideos] = useState(20);
  const [topK, setTopK] = useState(3);
  const [nDays, setNDays] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/configs/${id}`).then((r) => r.json()).then(setClient);
    fetch("/api/videos").then((r) => r.json()).then(setVideos);
  }, [id]);

  // Re-fetch videos when pipeline completes
  useEffect(() => {
    if (progress?.status === "completed") {
      fetch("/api/videos").then((r) => r.json()).then(setVideos);
    }
  }, [progress?.status]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progress?.log.length]);

  const handleRun = () => {
    if (!client) return;
    runPipeline({ configName: client.configName, maxVideos, topK, nDays });
  };

  const clientVideos = client
    ? videos.filter((v) => v.configName === client.configName)
    : [];

  const uniqueCreators = [...new Set(clientVideos.map((v) => v.creator))].sort();

  const filtered = clientVideos
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
    });

  const openModal = (video: Video, section: "analysis" | "concepts") => {
    setModalVideo(video);
    setModalSection(section);
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

  const totalProgress = progress
    ? progress.phase === "scraping"
      ? progress.creatorsTotal > 0 ? (progress.creatorsScraped / progress.creatorsTotal) * 40 : 0
      : progress.videosTotal > 0 ? 40 + (progress.videosAnalyzed / progress.videosTotal) * 60 : 40
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Videos</h1>
          <p className="mt-1 text-sm text-ocean/60">
            Analyzed competitor reels for {client?.configName || "this client"}
          </p>
        </div>
        <Button
          onClick={() => setPipelineOpen(!pipelineOpen)}
          disabled={running}
          className="rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5"
        >
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
          ) : (
            <><Play className="h-4 w-4" /> Run Pipeline</>
          )}
        </Button>
      </div>

      {/* Pipeline Panel */}
      {(pipelineOpen || running || progress) && (
        <div className="glass rounded-2xl p-5 space-y-4">
          {/* Config locked to client */}
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
                    {progress.status === "running" && progress.phase === "scraping" && "Scraping creators…"}
                    {progress.status === "running" && progress.phase === "analyzing" && "Analyzing videos…"}
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
                      {task.views && <span className="ml-auto text-[11px] text-ocean/40">{formatViews(task.views)} views</span>}
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
      </div>

      {/* Video Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((video) => {
          const vid = video.id || video.link;
          return (
            <div key={vid} className="group">
              <div className="glass rounded-2xl overflow-hidden transition-all duration-300 hover:border-ocean/[0.12]">
                <a href={video.link} target="_blank" rel="noopener noreferrer"
                  className="relative block aspect-[9/16] w-full bg-ocean/[0.02] overflow-hidden">
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
                      <span className="text-[15px] font-bold text-white">{formatViews(video.views)}</span>
                    </div>
                  </div>
                </a>

                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate">@{video.creator}</p>
                    <button onClick={() => toggleStar(vid, video.starred)} className="shrink-0 ml-1.5 transition-colors">
                      <Star className={`h-4 w-4 ${video.starred ? "fill-yellow-400 text-yellow-400" : "text-ocean/40 hover:text-yellow-400/60"}`} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-ocean/60">
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{formatViews(video.likes)}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatViews(video.comments)}</span>
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
          <Film className="mx-auto h-10 w-10 text-ocean/30" />
          <h3 className="mt-4 font-semibold">No videos yet</h3>
          <p className="mt-1 text-sm text-ocean/60">Run the pipeline to analyze competitor reels.</p>
          <Button onClick={() => setPipelineOpen(true)} className="mt-4 rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5">
            <Play className="h-4 w-4" /> Run Pipeline
          </Button>
        </div>
      )}

      {/* Analysis / Concepts Modal */}
      <Dialog open={!!modalVideo} onOpenChange={(open) => { if (!open) setModalVideo(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden glass-strong rounded-2xl border-ocean/[0.06] p-0 gap-0">
          <DialogTitle className="sr-only">
            {modalSection === "analysis" ? "Video Analysis" : "New Concepts"}
          </DialogTitle>
          {modalVideo && (
            <>
              <div className="flex items-center gap-4 p-5 border-b border-ocean/[0.06]">
                <div className="relative h-16 w-12 shrink-0 rounded-lg overflow-hidden bg-ocean/[0.02]">
                  {modalVideo.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/proxy-image?url=${encodeURIComponent(modalVideo.thumbnail)}`} alt={`@${modalVideo.creator}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Film className="h-4 w-4 text-ocean/30" />
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
                    <span className="inline-flex items-center gap-1"><Play className="h-3 w-3 fill-current" />{formatViews(modalVideo.views)}</span>
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{formatViews(modalVideo.likes)}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatViews(modalVideo.comments)}</span>
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
              <div className="overflow-y-auto max-h-[calc(90vh-100px)] p-6">
                <MarkdownContent
                  content={modalSection === "analysis" ? modalVideo.analysis : modalVideo.newConcepts}
                  variant={modalSection === "analysis" ? "analysis" : "concepts"}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
