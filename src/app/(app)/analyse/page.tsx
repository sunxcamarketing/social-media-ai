"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  Loader2,
  Users,
  Eye,
  Film,
  RefreshCw,
  Save,
  CheckCircle2,
} from "lucide-react";
import type { Config, Analysis } from "@/lib/types";

interface ProfileData {
  username: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  profilePicUrl?: string;
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AnalysePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-ocean/50 text-sm">Laden…</div>}>
      <AnalysePageInner />
    </Suspense>
  );
}

function AnalysePageInner() {
  const searchParams = useSearchParams();
  const [handle, setHandle] = useState(searchParams.get("handle") || "");
  const [clientId, setClientId] = useState(searchParams.get("clientId") || "");
  const [clients, setClients] = useState<Config[]>([]);
  const [lang, setLang] = useState<"de" | "en">("de");

  // Analysis state
  const [phase, setPhase] = useState<string>("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  // Past analyses
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [saved, setSaved] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Load clients for the dropdown
  useEffect(() => {
    fetch("/api/configs").then((r) => r.json()).then(setClients).catch(() => {});
    fetch("/api/analyses").then((r) => r.json()).then((data: Analysis[]) => {
      setAnalyses(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }).catch(() => {});
  }, []);

  // Auto-fill handle when client is selected
  useEffect(() => {
    if (clientId) {
      const client = clients.find((c) => c.id === clientId);
      if (client?.instagram) {
        const ig = client.instagram.replace(/^@/, "").replace(/.*instagram\.com\/([^/?]+).*/, "$1").replace(/\/$/, "");
        setHandle(ig);
      }
    }
  }, [clientId, clients]);

  async function startAnalysis() {
    if (!handle.trim()) return;
    setRunning(true);
    setPhase("scraping");
    setProfile(null);
    setReport("");
    setError("");
    setSaved(false);
    setSelectedAnalysis(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramHandle: handle.trim(), lang }),
        signal: abortRef.current.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

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
          const data = JSON.parse(line.slice(6));

          if (data.phase === "profile_loaded") {
            setProfile(data.profile);
            setPhase("reels");
          } else if (data.phase === "reels_loaded") {
            setPhase("analyzing");
          } else if (data.phase === "done") {
            setReport(data.report);
            setProfile(data.profile);
            setPhase("done");
          } else if (data.phase === "error") {
            setError(data.message);
            setPhase("error");
          } else if (data.phase) {
            setPhase(data.phase);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Unknown error");
        setPhase("error");
      }
    } finally {
      setRunning(false);
    }
  }

  async function saveAnalysis() {
    if (!report || !profile) return;
    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: clientId || undefined,
        instagramHandle: handle,
        lang,
        report,
        profileFollowers: profile.followers,
        profileReels30d: profile.reelsCount30d,
        profileAvgViews30d: profile.avgViews30d,
        profilePicUrl: profile.profilePicUrl || "",
      }),
    });
    if (res.ok) {
      setSaved(true);
      // Refresh analyses list
      const data = await fetch("/api/analyses").then((r) => r.json());
      setAnalyses(data.sort((a: Analysis, b: Analysis) => b.createdAt.localeCompare(a.createdAt)));
    }
  }

  function loadAnalysis(analysis: Analysis) {
    setSelectedAnalysis(analysis);
    setReport(analysis.report);
    setHandle(analysis.instagramHandle);
    setProfile({
      username: analysis.instagramHandle,
      followers: analysis.profileFollowers,
      reelsCount30d: analysis.profileReels30d,
      avgViews30d: analysis.profileAvgViews30d,
      profilePicUrl: analysis.profilePicUrl,
    });
    setPhase("done");
    setError("");
    setSaved(true);
  }

  const phaseLabels: Record<string, string> = {
    scraping: "Profil wird geladen…",
    reels: "Videos werden analysiert…",
    analyzing: "Audit wird erstellt…",
    done: "Fertig!",
    error: "Fehler",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instagram Analyse</h1>
        <p className="mt-1 text-sm text-ocean/70">
          Analyse ein Instagram-Profil und erhalte einen detaillierten Audit-Report.
        </p>
      </div>

      {/* Input Section */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_200px_100px]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ocean/70">Instagram Handle</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ocean/40 text-sm">@</span>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="username"
                className="pl-8 rounded-xl bg-warm-white border-ocean/10 focus:border-blush"
                onKeyDown={(e) => e.key === "Enter" && !running && startAnalysis()}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ocean/70">Client (optional)</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="h-10 w-full rounded-xl border border-ocean/10 bg-warm-white px-3 text-sm text-ocean focus:outline-none focus:border-blush"
            >
              <option value="">— Kein Client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.configName || c.name || c.id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ocean/70">Sprache</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as "de" | "en")}
              className="h-10 w-full rounded-xl border border-ocean/10 bg-warm-white px-3 text-sm text-ocean focus:outline-none focus:border-blush"
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <Button
          onClick={startAnalysis}
          disabled={running || !handle.trim()}
          className="rounded-full bg-ocean hover:bg-ocean-light border-0 gap-2"
        >
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Analysiert…</>
          ) : (
            <><Search className="h-4 w-4" /> Analyse starten</>
          )}
        </Button>
      </div>

      {/* Progress */}
      {running && (
        <div className="glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-ivory" />
            <p className="text-sm font-medium text-ocean">{phaseLabels[phase] || phase}</p>
          </div>
          {profile && (
            <div className="flex items-center gap-4 text-xs text-ocean/70">
              {profile.profilePicUrl && (
                <img src={profile.profilePicUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              )}
              <span className="font-medium text-ocean">@{profile.username}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{fmt(profile.followers)}</span>
              <span className="flex items-center gap-1"><Film className="h-3 w-3" />{profile.reelsCount30d} Reels</span>
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(profile.avgViews30d)} Ø</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && !running && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-6 py-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Report */}
      {report && !running && (
        <div className="glass rounded-2xl p-6 space-y-5">
          {/* Profile header */}
          {profile && (
            <div className="flex items-center gap-4 pb-4 border-b border-ocean/[0.06]">
              {profile.profilePicUrl && (
                <img src={profile.profilePicUrl} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-blush/40" />
              )}
              <div>
                <p className="text-lg font-medium text-ocean">@{profile.username}</p>
                <div className="flex items-center gap-4 text-xs text-ocean/70 mt-1">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{fmt(profile.followers)} Follower</span>
                  <span className="flex items-center gap-1"><Film className="h-3 w-3" />{profile.reelsCount30d} Reels (30d)</span>
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(profile.avgViews30d)} Ø Views</span>
                </div>
              </div>
            </div>
          )}

          {/* Markdown report */}
          <div className="prose prose-sm max-w-none text-ocean prose-headings:text-ocean prose-headings:font-medium prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2 prose-p:text-ocean/80 prose-li:text-ocean/80 prose-strong:text-ocean">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-ocean/[0.06]">
            {!saved ? (
              <Button onClick={saveAnalysis} className="rounded-full bg-ocean hover:bg-ocean-light border-0 gap-2">
                <Save className="h-4 w-4" /> Analyse speichern
              </Button>
            ) : (
              <span className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Gespeichert
              </span>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setReport("");
                setPhase("");
                setProfile(null);
                setSelectedAnalysis(null);
                setSaved(false);
              }}
              className="rounded-full gap-2 text-ocean/70 hover:text-ocean"
            >
              <RefreshCw className="h-4 w-4" /> Neue Analyse
            </Button>
          </div>
        </div>
      )}

      {/* Past Analyses */}
      {analyses.length > 0 && !report && !running && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-ocean">Gespeicherte Analysen</h2>
          <div className="space-y-2">
            {analyses.map((a) => (
              <button
                key={a.id}
                onClick={() => loadAnalysis(a)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                  selectedAnalysis?.id === a.id
                    ? "bg-blush-light/60 border-blush/40"
                    : "glass border-ocean/[0.06] hover:border-ocean/[0.15]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {a.profilePicUrl && (
                      <img src={a.profilePicUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-ocean">@{a.instagramHandle}</p>
                      <div className="flex items-center gap-3 text-[11px] text-ocean/60 mt-0.5">
                        <span>{fmt(a.profileFollowers)} Follower</span>
                        <span>{a.lang.toUpperCase()}</span>
                        {a.clientId && (
                          <span className="text-blush-dark">
                            {clients.find((c) => c.id === a.clientId)?.configName || "Client"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-ocean/40">{a.createdAt.slice(0, 10)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
