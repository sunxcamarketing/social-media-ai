"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Users, Video, Link2, Loader2, Sparkles, Search, ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";
import { MarkdownContent } from "@/components/markdown-content";

const CreatorsContent = dynamic(
  () => import("../creators/page").then((mod) => ({ default: mod.default })),
  { ssr: false, loading: () => <TabLoading /> },
);

const VideosContent = dynamic(
  () => import("../videos/page").then((mod) => ({ default: mod.default })),
  { ssr: false, loading: () => <TabLoading /> },
);

function TabLoading() {
  return <div className="py-12 text-center text-sm text-ocean/40">Laden...</div>;
}

type Tab = "creators" | "videos";

const TABS: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "creators", label: "Creator-Liste", icon: Users },
  { key: "videos", label: "Analysierte Videos", icon: Video },
];

interface AnalysisResult {
  analysis: string;
  concepts: string;
  meta: { creator: string; views: number; likes: number; comments: number; url: string };
}

export default function CompetitorsPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("creators");

  // Single video analysis
  const [videoUrl, setVideoUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const url = videoUrl.trim();
    if (!url || analyzing) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/analyze-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analyse fehlgeschlagen");
      setAnalysisResult(data);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setAnalyzing(false);
    }
  };

  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-ocean">Konkurrenz-Analyse</h1>
        <p className="text-sm text-ocean/50 mt-1">
          Einzelne Videos analysieren, Creators verwalten & Ergebnisse durchsuchen
        </p>
      </div>

      {/* Single Video Analysis */}
      <div className="rounded-2xl border border-ocean/[0.06] bg-white p-5 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-ocean/50" />
          <span className="text-sm font-medium text-ocean">Einzelnes Video analysieren</span>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ocean/30" />
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
              placeholder="Instagram Reel URL einfügen..."
              disabled={analyzing}
              className="w-full h-11 rounded-xl border border-ocean/[0.08] bg-ocean/[0.01] pl-10 pr-4 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none focus:border-blush/60 focus:shadow-[0_0_0_3px_rgba(242,200,210,0.15)] transition-all disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!videoUrl.trim() || analyzing}
            className={`flex items-center gap-2 px-5 h-11 rounded-xl text-sm font-medium transition-all shrink-0 ${
              videoUrl.trim() && !analyzing
                ? "bg-ocean text-white hover:bg-ocean-light shadow-sm"
                : "bg-ocean/20 text-white/60 cursor-not-allowed"
            }`}
          >
            {analyzing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Analysiert...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Analysieren</>
            )}
          </button>
        </div>
        <p className="text-[11px] text-ocean/40 mt-2">
          Paste eine Instagram-Reel-URL — das Video wird analysiert und Content-Ideen für deinen Client generiert.
        </p>

        {analysisError && (
          <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-500">
            {analysisError}
          </div>
        )}

        {analysisResult && (
          <div className="mt-4 space-y-4">
            {/* Meta */}
            <div className="flex items-center gap-4 text-xs text-ocean/60">
              {analysisResult.meta.creator && (
                <span className="font-medium text-ocean">@{analysisResult.meta.creator}</span>
              )}
              {analysisResult.meta.views > 0 && <span>{fmt(analysisResult.meta.views)} Views</span>}
              {analysisResult.meta.likes > 0 && <span>{fmt(analysisResult.meta.likes)} Likes</span>}
              <a
                href={analysisResult.meta.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blush-dark hover:text-blush-dark/80 transition-colors"
              >
                Original <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Analysis */}
            <details open className="rounded-xl border border-ocean/[0.06] overflow-hidden">
              <summary className="px-4 py-3 text-sm font-medium text-ocean cursor-pointer hover:bg-ocean/[0.02] transition-colors">
                Video-Analyse
              </summary>
              <div className="px-4 pb-4 text-sm text-ocean/70 leading-relaxed">
                <MarkdownContent content={analysisResult.analysis} />
              </div>
            </details>

            {/* Concepts */}
            {analysisResult.concepts && (
              <div className="rounded-xl border border-blush/20 bg-blush-light/20 p-4">
                <p className="text-xs font-medium text-blush-dark uppercase tracking-wider mb-3">
                  Adaptierte Content-Ideen
                </p>
                <div className="text-sm text-ocean/80 leading-relaxed">
                  <MarkdownContent content={analysisResult.concepts} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-ocean/[0.04] w-fit">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-white text-ocean font-medium shadow-sm"
                  : "text-ocean/55 hover:text-ocean"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === "creators" && <CreatorsContent />}
        {activeTab === "videos" && <VideosContent />}
      </div>
    </div>
  );
}
