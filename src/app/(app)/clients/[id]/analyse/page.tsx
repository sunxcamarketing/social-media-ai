"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuditReport, type ProfileData } from "@/components/audit-report";
import {
  Search,
  Loader2,
  Users,
  Eye,
  Film,
  ChevronDown,
  Trash2,
  CalendarDays,
} from "lucide-react";
import type { Config, Analysis } from "@/lib/types";
import { useAudit } from "@/context/audit-context";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ClientAuditPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Config | null>(null);
  const [lang, setLang] = useState<"de" | "en">("de");

  const { audit, startAudit, clearAudit } = useAudit(`client-${id}`);

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const running = audit?.running ?? false;
  const phase = audit?.phase ?? "";
  const profile = audit?.profile ?? null;
  const report = audit?.report ?? "";
  const error = audit?.error ?? "";
  const unsavedReport = !!report && !running && !saved;

  useEffect(() => {
    fetch(`/api/configs/${id}`).then((r) => r.json()).then(setClient).catch(() => {});
    loadAnalyses();
  }, [id]);

  // Reset saved state when a new audit completes
  useEffect(() => {
    if (report && !running) setSaved(false);
  }, [report, running]);

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

  function handleStart() {
    const handle = getHandle();
    if (!handle) return;
    setSaved(false);
    setExpandedId(null);
    startAudit(handle, lang);
  }

  async function saveAudit() {
    if (!report || !profile) return;
    const handle = getHandle();
    const res = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: id,
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
      clearAudit();
      loadAnalyses();
    }
  }

  async function deleteAnalysis(analysisId: string) {
    if (!confirm("Audit wirklich löschen?")) return;
    await fetch(`/api/analyses?id=${analysisId}`, { method: "DELETE" });
    if (expandedId === analysisId) setExpandedId(null);
    loadAnalyses();
  }

  function toggleAnalysis(analysisId: string) {
    setExpandedId((prev) => (prev === analysisId ? null : analysisId));
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
          <h1 className="text-3xl font-bold tracking-tight">Instagram Audit</h1>
          <p className="mt-1 text-sm text-ocean/70">
            Audit für{" "}
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
            onClick={handleStart}
            disabled={running || !handle}
            className="rounded-full bg-ocean hover:bg-ocean-light border-0 gap-2 h-9 text-xs"
          >
            {running ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Audit läuft…</>
            ) : (
              <><Search className="h-3.5 w-3.5" /> {analyses.length > 0 ? "Neuer Audit" : "Audit starten"}</>
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
              <p className="text-xs text-white/50">Du kannst in der Zwischenzeit andere Tabs nutzen</p>
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-4 rounded-xl bg-white/10 px-4 py-3">
              {profile.profilePicUrl && (
                <img src={`/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl)}`} alt="" className="h-10 w-10 rounded-full object-cover border border-white/20" />
              )}
              <div className="flex items-center gap-4 text-xs text-white/70">
                <span className="font-medium text-white">@{profile.username}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{fmt(profile.followers)}</span>
                <span className="flex items-center gap-1"><Film className="h-3 w-3" />{profile.reelsCount30d} Reels</span>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(profile.avgViews30d)} Ø</span>
              </div>
            </div>
          )}
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

      {/* Unsaved new report */}
      {unsavedReport && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blush animate-pulse" />
            <h2 className="text-sm font-semibold text-ocean">Neuer Audit — noch nicht gespeichert</h2>
          </div>
          <AuditReport report={report} profile={profile} onSave={saveAudit} saved={saved} />
        </div>
      )}

      {/* Saved Audits (accordion) */}
      {!running && (
        <div className="space-y-4">
          {analyses.length > 0 ? (
            <>
              <h2 className="text-sm font-semibold text-ocean">Gespeicherte Audits</h2>
              <div className="space-y-3">
                {analyses.map((a) => {
                  const isOpen = expandedId === a.id;
                  return (
                    <div key={a.id} className="rounded-2xl border border-ocean/[0.06] overflow-hidden transition-all">
                      <div
                        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-ocean/[0.02] transition-colors"
                        onClick={() => toggleAnalysis(a.id)}
                      >
                        <div className="flex items-center gap-3">
                          {a.profilePicUrl && (
                            <img
                              src={`/api/proxy-image?url=${encodeURIComponent(a.profilePicUrl)}`}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-3.5 w-3.5 text-ocean/40" />
                              <span className="text-sm font-semibold text-ocean">
                                {new Date(a.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-ocean/50 mt-0.5">
                              <span>@{a.instagramHandle}</span>
                              <span>{fmt(a.profileFollowers)} Follower</span>
                              <span>{a.profileReels30d} Reels</span>
                              <span>{fmt(a.profileAvgViews30d)} Ø Views</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-ocean/30 hover:text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          <ChevronDown className={`h-4 w-4 text-ocean/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-ocean/[0.06] px-5 py-5">
                          <AuditReport
                            report={a.report}
                            profile={{
                              username: a.instagramHandle,
                              followers: a.profileFollowers,
                              reelsCount30d: a.profileReels30d,
                              avgViews30d: a.profileAvgViews30d,
                              profilePicUrl: a.profilePicUrl,
                            }}
                            saved
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : !unsavedReport && handle ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-8 w-8 text-ocean/20 mb-3" />
              <p className="text-sm text-ocean/70">Noch kein Audit vorhanden.</p>
              <p className="text-xs text-ocean/50 mt-1">Starte einen Audit um einen detaillierten Report zu erhalten.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
