"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  Loader2,
  CheckCircle2,
  User,
  Eye,
  Film,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ProfileData {
  username: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  profilePicUrl?: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

type Phase = "idle" | "scraping" | "profile_loaded" | "reels_loaded" | "analyzing" | "done" | "error";

export default function AnalysePage() {
  const [handle, setHandle] = useState("");
  const [lang, setLang] = useState<"de" | "en">("de");
  const [phase, setPhase] = useState<Phase>("idle");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const isLoading = phase !== "idle" && phase !== "done" && phase !== "error";

  const handleAnalyse = async () => {
    if (!handle.trim()) return;

    setPhase("scraping");
    setProfile(null);
    setReport("");
    setError("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramHandle: handle.trim(), lang }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setPhase("error");
        setError("Verbindungsfehler. Bitte versuche es erneut.");
        return;
      }

      const reader = res.body.getReader();
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
          try {
            const data = JSON.parse(line.slice(6));

            if (data.phase === "scraping") setPhase("scraping");
            if (data.phase === "profile_loaded") {
              setPhase("profile_loaded");
              setProfile(data.profile);
            }
            if (data.phase === "reels_loaded") setPhase("reels_loaded");
            if (data.phase === "analyzing") setPhase("analyzing");
            if (data.phase === "done") {
              setPhase("done");
              setReport(data.report || "");
              if (data.profile) setProfile(data.profile);
            }
            if (data.phase === "error") {
              setPhase("error");
              setError(data.message || "Unbekannter Fehler");
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setPhase("error");
        setError((err as Error).message || "Unbekannter Fehler");
      }
    }
  };

  const phaseLabel: Record<Phase, string> = {
    idle: "",
    scraping: "Instagram-Daten werden geladen...",
    profile_loaded: "Profil geladen, Reels werden analysiert...",
    reels_loaded: "Reels geladen, KI-Analyse wird erstellt...",
    analyzing: "Detaillierte Analyse wird erstellt...",
    done: "Analyse abgeschlossen",
    error: "Fehler",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Instagram Analyse</h1>
        <p className="mt-1 text-sm text-ocean/60">
          Detaillierte KI-Analyse eines Instagram-Profils mit vollständigem Report
        </p>
      </div>

      {/* Input Form */}
      <div className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-blush-dark" />
          <h2 className="text-sm font-semibold">Profil analysieren</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label className="text-xs text-ocean/60">Instagram Handle</Label>
            <Input
              className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11"
              placeholder="@username"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAnalyse()}
              disabled={isLoading}
            />
          </div>

          <div className="w-32">
            <Label className="text-xs text-ocean/60">Sprache</Label>
            <select
              className="mt-1.5 w-full h-11 rounded-xl glass border border-ocean/[0.06] px-3 text-sm bg-transparent"
              value={lang}
              onChange={(e) => setLang(e.target.value as "de" | "en")}
              disabled={isLoading}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleAnalyse}
              disabled={isLoading || !handle.trim()}
              className="h-11 rounded-xl bg-ocean text-white hover:bg-ocean/90 px-6"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analysiert...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Analysieren
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Progress */}
      {isLoading && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-ocean" />
            <span className="text-sm font-medium">{phaseLabel[phase]}</span>
          </div>

          <div className="mt-4 flex gap-2">
            {(["scraping", "profile_loaded", "reels_loaded", "analyzing"] as Phase[]).map((p, i) => {
              const steps: Phase[] = ["scraping", "profile_loaded", "reels_loaded", "analyzing"];
              const currentIdx = steps.indexOf(phase);
              const isDone = i < currentIdx;
              const isActive = i === currentIdx;

              return (
                <div key={p} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      isDone
                        ? "bg-green-500"
                        : isActive
                        ? "bg-ocean animate-pulse"
                        : "bg-ocean/10"
                    }`}
                  />
                  <p className="text-[10px] text-ocean/50 mt-1">
                    {["Scraping", "Profil", "Reels", "KI-Analyse"][i]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="glass rounded-2xl p-6 border border-red-200 bg-red-50/50">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Profile Stats */}
      {profile && phase === "done" && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            {profile.profilePicUrl ? (
              <img
                src={profile.profilePicUrl}
                alt={profile.username}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-ocean/10"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-ocean/10 flex items-center justify-center">
                <User className="h-6 w-6 text-ocean/40" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold">@{profile.username}</h3>
              <p className="text-xs text-ocean/50">Analyse abgeschlossen</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-ocean/[0.03]">
              <Users className="h-4 w-4 text-ocean/40 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatNumber(profile.followers)}</p>
              <p className="text-[10px] text-ocean/50">Followers</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-ocean/[0.03]">
              <Film className="h-4 w-4 text-ocean/40 mx-auto mb-1" />
              <p className="text-lg font-bold">{profile.reelsCount30d}</p>
              <p className="text-[10px] text-ocean/50">Reels (30d)</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-ocean/[0.03]">
              <Eye className="h-4 w-4 text-ocean/40 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatNumber(profile.avgViews30d)}</p>
              <p className="text-[10px] text-ocean/50">Avg. Views</p>
            </div>
          </div>
        </div>
      )}

      {/* Full Report */}
      {report && phase === "done" && (
        <div className="glass rounded-2xl p-8">
          <div className="prose prose-sm max-w-none prose-headings:text-ocean prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-ocean/10 prose-h2:pb-2 prose-p:text-ocean/80 prose-li:text-ocean/80 prose-strong:text-ocean">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
