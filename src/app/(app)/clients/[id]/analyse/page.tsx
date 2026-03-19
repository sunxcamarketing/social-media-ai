"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuditReport, type ProfileData } from "@/components/audit-report";
import {
  Search,
  Loader2,
  Users,
  Eye,
  Film,
  RefreshCw,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import type { Config, Analysis } from "@/lib/types";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ClientAnalysePage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Config | null>(null);
  const [lang, setLang] = useState<"de" | "en">("de");

  const [phase, setPhase] = useState<string>("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`/api/configs/${id}`).then((r) => r.json()).then(setClient).catch(() => {});
    loadAnalyses();
  }, [id]);

  function loadAnalyses() {
    fetch("/api/analyses")
      .then((r) => r.json())
      .then((data: Analysis[]) => {
        setAnalyses(
          data.filter((a) => a.clientId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        );
      })
      .catch(() => {});
  }

  function getHandle(): string {
    const raw = client?.instagram || "";
    return raw.replace(/^@/, "").replace(/.*instagram\.com\/([^/?]+).*/, "$1").replace(/\/$/, "").trim();
  }

  async function startAnalysis() {
    const handle = getHandle();
    if (!handle) return;

    setRunning(true);
    setPhase("scraping");
    setProfile(null);
    setReport("");
    setError("");
    setJustSaved(false);
    setActiveAnalysisId(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramHandle: handle, lang }),
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
            await autoSave(data.report, data.profile, handle);
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

  async function autoSave(reportText: string, profileData: ProfileData, handle: string) {
    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        instagramHandle: handle,
        lang,
        report: reportText,
        profileFollowers: profileData.followers,
        profileReels30d: profileData.reelsCount30d,
        profileAvgViews30d: profileData.avgViews30d,
        profilePicUrl: profileData.profilePicUrl || "",
      }),
    });
    if (res.ok) {
      setJustSaved(true);
      loadAnalyses();
    }
  }

  async function deleteAnalysis(analysisId: string) {
    if (!confirm("Analyse wirklich löschen?")) return;
    await fetch(`/api/analyses?id=${analysisId}`, { method: "DELETE" });
    if (activeAnalysisId === analysisId) {
      setReport("");
      setProfile(null);
      setActiveAnalysisId(null);
      setPhase("");
    }
    loadAnalyses();
  }

  function viewAnalysis(analysis: Analysis) {
    setActiveAnalysisId(analysis.id);
    setReport(analysis.report);
    setProfile({
      username: analysis.instagramHandle,
      followers: analysis.profileFollowers,
      reelsCount30d: analysis.profileReels30d,
      avgViews30d: analysis.profileAvgViews30d,
      profilePicUrl: analysis.profilePicUrl,
    });
    setPhase("done");
    setError("");
    setJustSaved(true);
  }

  const handle = getHandle();

  const phaseLabels: Record<string, string> = {
    scraping: "Profil wird geladen…",
    reels: "Videos werden analysiert…",
    analyzing: "Audit wird erstellt…",
    done: "Fertig!",
  };

  if (!client) {
    return <div className="flex items-center justify-center h-64 text-ocean/50 text-sm">Laden…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analyse</h1>
          <p className="mt-1 text-sm text-ocean/70">
            Instagram Audit für{" "}
            <span className="font-medium text-ocean">{handle ? `@${handle}` : client.configName || client.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "de" | "en")}
            className="h-9 rounded-xl border border-ocean/10 bg-warm-white px-3 text-xs text-ocean focus:outline-none focus:border-blush"
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
          <Button
            onClick={startAnalysis}
            disabled={running || !handle}
            className="rounded-full bg-ocean hover:bg-ocean-light border-0 gap-2 h-9 text-xs"
          >
            {running ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysiert…</>
            ) : (
              <><Search className="h-3.5 w-3.5" /> {analyses.length > 0 ? "Neue Analyse" : "Analyse starten"}</>
            )}
          </Button>
        </div>
      </div>

      {!handle && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-6 py-4 text-sm text-amber-700">
          Kein Instagram-Handle hinterlegt. Bitte zuerst unter &quot;Informationen&quot; den Instagram-Handle eintragen.
        </div>
      )}

      {/* Progress */}
      {running && (
        <div className="rounded-2xl bg-gradient-to-r from-ocean to-ocean-light p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{phaseLabels[phase] || phase}</p>
              <p className="text-xs text-white/50">Dies kann bis zu 60 Sekunden dauern</p>
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-4 rounded-xl bg-white/10 px-4 py-3">
              {profile.profilePicUrl && (
                <img src={profile.profilePicUrl} alt="" className="h-10 w-10 rounded-full object-cover border border-white/20" />
              )}
              <div className="flex items-center gap-4 text-xs text-white/70">
                <span className="font-medium text-white">@{profile.username}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{fmt(profile.followers)}</span>
                <span className="flex items-center gap-1"><Film className="h-3 w-3" />{profile.reelsCount30d} Reels</span>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(profile.avgViews30d)} Ø</span>
              </div>
            </div>
          )}
          {/* Progress steps */}
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span className={phase === "scraping" || phase === "reels" || phase === "analyzing" ? "text-white" : ""}>Scraping</span>
            <span>→</span>
            <span className={phase === "reels" || phase === "analyzing" ? "text-white" : ""}>Videos</span>
            <span>→</span>
            <span className={phase === "analyzing" ? "text-white" : ""}>Audit erstellen</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !running && (
        <div className="rounded-2xl bg-red-50 border border-red-200 px-6 py-4 text-sm text-red-600">{error}</div>
      )}

      {/* Report */}
      {report && !running && (
        <div className="space-y-4">
          {justSaved && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Automatisch gespeichert
            </div>
          )}

          <AuditReport report={report} profile={profile} />

          <div className="pt-2">
            <Button
              variant="ghost"
              onClick={() => { setReport(""); setPhase(""); setProfile(null); setActiveAnalysisId(null); setJustSaved(false); }}
              className="rounded-full gap-2 text-ocean/70 hover:text-ocean text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Zurück zur Übersicht
            </Button>
          </div>
        </div>
      )}

      {/* Past Analyses */}
      {!report && !running && (
        <div className="space-y-4">
          {analyses.length > 0 ? (
            <>
              <h2 className="text-sm font-semibold text-ocean">Bisherige Analysen</h2>
              <div className="space-y-2">
                {analyses.map((a) => (
                  <div key={a.id} className="glass rounded-xl border border-ocean/[0.06] hover:border-ocean/[0.15] transition-all">
                    <button onClick={() => viewAnalysis(a)} className="w-full text-left px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {a.profilePicUrl && <img src={a.profilePicUrl} alt="" className="h-9 w-9 rounded-full object-cover" />}
                          <div>
                            <p className="text-sm font-medium text-ocean">@{a.instagramHandle}</p>
                            <div className="flex items-center gap-3 text-[11px] text-ocean/50 mt-0.5">
                              <span>{fmt(a.profileFollowers)} Follower</span>
                              <span>{a.profileReels30d} Reels</span>
                              <span>{fmt(a.profileAvgViews30d)} Ø Views</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-ocean/40">
                            {new Date(a.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/30 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : handle ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-8 w-8 text-ocean/20 mb-3" />
              <p className="text-sm text-ocean/70">Noch keine Analyse vorhanden.</p>
              <p className="text-xs text-ocean/50 mt-1">Starte eine Analyse um einen detaillierten Audit-Report zu erhalten.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
