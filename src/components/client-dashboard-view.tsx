"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  BarChart2,
  Lightbulb,
  MessageSquare,
  Mic,
  ArrowRight,
  ThumbsUp,
  RotateCcw,
  Clock,
  Search,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { motion } from "motion/react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Section } from "@/components/ui/section";
import { LastWeekActivity } from "@/components/last-week-activity";
import { safeJsonParse } from "@/lib/safe-json";
import { fmt } from "@/lib/format";
import { parseInsights } from "@/lib/performance-helpers";
import type { Script, Idea, Config, Analysis } from "@/lib/types";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface DaySlot { type: string; format: string; pillar?: string; }
type WeeklyStructure = Record<string, DaySlot>;

function startOfWeekMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.getTime();
}

interface ClientDashboardViewProps {
  /** The client whose dashboard we're viewing. Required. */
  clientId: string;
  /**
   * - "portal": used when logged in as client OR admin impersonating.
   *   Shows "Hi [Name] 👋" greeting and all portal routes (/portal/...).
   * - "admin": used on /clients/[id]/dashboard. Greeting is the client
   *   name, links point at admin routes (/clients/[id]/...).
   */
  mode?: "portal" | "admin";
}

export function ClientDashboardView({ clientId, mode = "portal" }: ClientDashboardViewProps) {
  const [client, setClient] = useState<Config | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([
      fetch(`/api/configs/${clientId}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/scripts?clientId=${clientId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/ideas?clientId=${clientId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/analyses?clientId=${clientId}`).then((r) => r.json()).catch(() => []),
    ]).then(([c, s, i, a]) => {
      setClient(c || null);
      setScripts(Array.isArray(s) ? s : []);
      setIdeas(Array.isArray(i) ? i : []);
      setAnalysis(Array.isArray(a) && a.length > 0 ? a[0] : null);
      setLoading(false);
    });
  }, [clientId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 rounded-2xl bg-ocean/[0.04] animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-ocean/[0.04] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 rounded-2xl bg-ocean/[0.04] animate-pulse" />
          <div className="h-64 rounded-2xl bg-ocean/[0.04] animate-pulse" />
        </div>
      </div>
    );
  }

  const clientName = client?.configName || client?.name || "";
  const firstName = (client?.name || client?.configName || "").split(" ")[0] || "";

  // URL helpers — switch based on mode
  const scriptsUrl = mode === "portal" ? "/portal/scripts" : `/clients/${clientId}/scripts`;
  const strategyUrl = mode === "portal" ? "/portal/strategy" : `/clients/${clientId}/strategy`;
  const chatUrl = mode === "portal" ? "/portal/chat" : `/clients/${clientId}/chat`;
  const voiceUrl = mode === "portal" ? "/portal/voice" : `/clients/${clientId}/voice`;
  const profileUrl = mode === "portal" ? "/portal/profil" : `/clients/${clientId}/information`;

  // Derived
  const weekStart = startOfWeekMs();
  const scriptsThisWeek = scripts.filter((s) => {
    if (!s.createdAt) return false;
    const ts = new Date(s.createdAt).getTime();
    return !isNaN(ts) && ts >= weekStart;
  }).length;
  const pendingFeedback = scripts.filter((s) => !s.clientFeedbackStatus);
  const approvedCount = scripts.filter((s) => s.clientFeedbackStatus === "approved").length;
  const revisionCount = scripts.filter((s) => s.clientFeedbackStatus === "revision_requested").length;
  const latestScripts = [...scripts]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 5);
  const openFeedback = pendingFeedback.slice(0, 4);

  const weekly = safeJsonParse<WeeklyStructure>(client?.strategyWeekly, {});
  const postsPerWeek = Math.min(7, Math.max(1, parseInt(client?.postsPerWeek || "5", 10)));
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);
  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayDay = ALL_DAYS[todayIdx];
  const plannedDays = activeDays.filter((d) => weekly[d]?.type);
  const todayIndexInPlanned = plannedDays.indexOf(todayDay);
  const upcoming = [
    ...plannedDays.slice(todayIndexInPlanned === -1 ? 0 : todayIndexInPlanned),
    ...plannedDays.slice(0, todayIndexInPlanned === -1 ? 0 : todayIndexInPlanned),
  ].slice(0, 3);

  const hasStrategy = Boolean(client?.strategyGoal || plannedDays.length > 0);

  const quickActions = [
    { href: scriptsUrl, label: "Skripte & Ideen", sub: "Feedback geben oder neue Idee", icon: Lightbulb, accent: "from-blush-light/40 to-blush/20 border-blush/30" },
    { href: chatUrl, label: "Chat-Agent", sub: "Brainstorming & Skripte", icon: MessageSquare, accent: "from-ocean/[0.04] to-ocean/[0.08] border-ocean/[0.1]" },
    { href: voiceUrl, label: "Voice-Session", sub: "Content-Ideen entlocken", icon: Mic, accent: "from-ocean/[0.04] to-ivory/[0.08] border-ivory/15" },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <PageHeader
        tone="hero"
        icon={Sparkles}
        eyebrow={new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        title={firstName ? `Hi ${firstName} 👋` : clientName || "Dashboard"}
        subtitle={
          pendingFeedback.length > 0
            ? `${pendingFeedback.length} Skript${pendingFeedback.length === 1 ? "" : "e"} warten auf Feedback.`
            : scripts.length === 0
              ? "Noch keine Skripte — leg im Chat oder per Voice-Session los."
              : `${scripts.length} Skripte · ${ideas.length} Ideen · bereit für nächste Woche?`
        }
      />

      {/* Last-week post activity */}
      <Section title="Post-Aktivität" icon={CheckCircle2}>
        <LastWeekActivity
          posts={parseInsights(client?.performanceInsights || "")?.top30Days || []}
          scrapedAt={parseInsights(client?.performanceInsights || "")?.scrapedAt || null}
        />
      </Section>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatTile
          label="Skripte diese Woche"
          value={scriptsThisWeek}
          sublabel={`von ${scripts.length} insgesamt`}
          icon={<FileText className="h-3.5 w-3.5" />}
          accent="ocean"
          href={scriptsUrl}
        />
        <StatTile
          label="Feedback offen"
          value={pendingFeedback.length}
          sublabel={pendingFeedback.length > 0 ? "warten auf Reaktion" : "alles gegeben ✓"}
          icon={<Clock className="h-3.5 w-3.5" />}
          accent={pendingFeedback.length > 0 ? "amber" : "green"}
          href={scriptsUrl}
        />
        <StatTile
          label="Freigegeben"
          value={approvedCount}
          sublabel={revisionCount > 0 ? `${revisionCount} Überarbeitungen offen` : "bereit zur Aufnahme"}
          icon={<ThumbsUp className="h-3.5 w-3.5" />}
          accent="green"
        />
        <StatTile
          label="Content-Ideen"
          value={ideas.length}
          sublabel="Pool für kommende Wochen"
          icon={<Lightbulb className="h-3.5 w-3.5" />}
          accent="blush"
          href={scriptsUrl}
        />
      </div>

      {/* Main 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        <div className="lg:col-span-2 space-y-6">
          {openFeedback.length > 0 && (
            <Section
              title="Auf Feedback wartend"
              icon={Clock}
              action={
                <Link href={scriptsUrl} className="text-[11px] text-ocean/50 hover:text-ocean transition-colors flex items-center gap-1">
                  Alle ansehen <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <div className="space-y-2">
                {openFeedback.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.3 }}
                  >
                    <Link
                      href={scriptsUrl}
                      className="group flex items-start gap-3 rounded-xl bg-white border border-ocean/[0.06] hover:border-amber-300/60 hover:bg-amber-50/30 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(245,158,11,0.06)] transition-all p-3 sm:p-4"
                    >
                      <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ocean break-words line-clamp-2">
                          {s.title || "Unbenannt"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {s.pillar && <span className="text-[10px] bg-ocean/[0.04] text-ocean/60 px-2 py-0.5 rounded-md">{s.pillar}</span>}
                          {s.format && <span className="text-[10px] bg-blush-light/40 text-ocean/60 px-2 py-0.5 rounded-md">{s.format}</span>}
                          <span className="text-[10px] text-amber-600/80 font-medium">Feedback ausstehend</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-ocean/20 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </Section>
          )}

          {latestScripts.length > 0 && (
            <Section
              title="Neueste Skripte"
              icon={FileText}
              action={
                <Link href={scriptsUrl} className="text-[11px] text-ocean/50 hover:text-ocean transition-colors flex items-center gap-1">
                  Alle ansehen <ArrowRight className="h-3 w-3" />
                </Link>
              }
              delay={0.1}
            >
              <div className="rounded-2xl bg-white border border-ocean/[0.06] divide-y divide-ocean/[0.04] overflow-hidden">
                {latestScripts.map((s, i) => {
                  const preview = (s.hook || s.body || "").slice(0, 120);
                  const fb = s.clientFeedbackStatus;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.03 * i }}
                    >
                      <Link
                        href={scriptsUrl}
                        className="group flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-ocean/[0.02] transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-ocean break-words line-clamp-1 flex-1 min-w-0">
                              {s.title || "Unbenannt"}
                            </p>
                            {fb === "approved" && <Dot tone="green" label="Freigegeben" />}
                            {fb === "rejected" && <Dot tone="red" label="Abgelehnt" />}
                            {fb === "revision_requested" && <Dot tone="amber" label="Überarbeitung" />}
                          </div>
                          {preview && (
                            <p className="text-xs text-ocean/55 mt-1 line-clamp-1 break-words">{preview}…</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {s.pillar && <span className="text-[10px] text-ocean/45">{s.pillar}</span>}
                            {s.createdAt && <span className="text-[10px] text-ocean/35">{s.createdAt.slice(0, 10)}</span>}
                          </div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-ocean/15 group-hover:text-ocean/50 group-hover:translate-x-0.5 transition-all shrink-0 mt-1.5" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </Section>
          )}

          {scripts.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-ocean/[0.1] bg-warm-white/50 p-8 sm:p-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-blush-light/40 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-blush-dark" />
              </div>
              <h3 className="text-sm font-semibold text-ocean mb-1">Noch keine Skripte</h3>
              <p className="text-xs text-ocean/55 mb-5 max-w-md mx-auto">
                Dein Content-Team arbeitet an den ersten Skripten. Oder leg selbst im Chat los.
              </p>
              <Link
                href={chatUrl}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ocean hover:bg-ocean-light text-white text-xs font-medium px-4 py-2.5 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" /> Chat öffnen
              </Link>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <Section title="Diese Woche" icon={BarChart2} delay={0.05}>
              <div className="rounded-2xl bg-white border border-ocean/[0.06] p-4 space-y-3">
                {upcoming.map((day) => {
                  const slot = weekly[day];
                  if (!slot) return null;
                  const isToday = day === todayDay;
                  return (
                    <div key={day} className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${isToday ? "bg-ocean text-white" : "bg-ocean/[0.04] text-ocean/70"}`}>
                        <span className="text-[9px] uppercase tracking-wider font-semibold">{day}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ocean leading-snug break-words">{slot.type}</p>
                        {slot.format && <p className="text-[11px] text-ocean/50 mt-0.5 break-words">{slot.format}</p>}
                        {slot.pillar && <p className="text-[10px] text-blush-dark/70 mt-0.5 break-words">{slot.pillar}</p>}
                        {isToday && <p className="text-[10px] text-ivory font-medium mt-0.5">· Heute</p>}
                      </div>
                    </div>
                  );
                })}
                <Link
                  href={strategyUrl}
                  className="flex items-center justify-center gap-1 text-[11px] text-ocean/50 hover:text-ocean transition-colors pt-2 border-t border-ocean/[0.04]"
                >
                  Kompletter Wochenplan <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Section>
          )}

          {analysis && (
            <Section title="Letztes Audit" icon={Search} delay={0.1}>
              <Link
                href={strategyUrl}
                className="block rounded-2xl bg-gradient-to-br from-ocean via-ocean to-ocean-light p-4 text-white relative overflow-hidden group hover:shadow-[0_8px_32px_rgba(32,35,69,0.15)] transition-shadow"
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/[0.04]" />
                <div className="relative">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-2">
                    {analysis.instagramHandle ? `@${analysis.instagramHandle}` : "Profil-Audit"}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Follower" value={fmt(analysis.profileFollowers || 0)} />
                    <MiniStat label="Reels/30d" value={analysis.profileReels30d || 0} />
                    <MiniStat label="Ø Views" value={fmt(analysis.profileAvgViews30d || 0)} />
                  </div>
                  <p className="text-[10px] text-white/50 mt-3 flex items-center gap-1 group-hover:text-white/80 transition-colors">
                    Zum vollständigen Report <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
              </Link>
            </Section>
          )}

          <Section title="Schnell starten" icon={Sparkles} delay={0.15}>
            <div className="space-y-2">
              {quickActions.map((a, i) => (
                <motion.div
                  key={a.href}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                >
                  <Link
                    href={a.href}
                    className={`group flex items-center gap-3 rounded-xl bg-gradient-to-r ${a.accent} border p-3 hover:-translate-y-0.5 hover:shadow-md transition-all`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                      <a.icon className="h-4 w-4 text-ocean" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ocean">{a.label}</p>
                      <p className="text-[11px] text-ocean/55 truncate">{a.sub}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ocean/30 group-hover:text-ocean group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </Section>

          {!hasStrategy && (
            <div className="rounded-2xl border-2 border-dashed border-blush/30 bg-blush-light/20 p-4 text-center">
              <RotateCcw className="h-5 w-5 text-blush-dark mx-auto mb-2" />
              <p className="text-xs text-ocean/65 leading-relaxed">
                {mode === "admin"
                  ? "Noch keine Strategie erstellt. Leg auf der Strategie-Seite los."
                  : "Deine Strategie wird noch vorbereitet. Sobald sie fertig ist, erscheint sie hier."}
              </p>
              {mode === "admin" && (
                <Link href={strategyUrl} className="inline-block mt-3 text-xs font-medium text-blush-dark hover:text-ocean">
                  Zur Strategie →
                </Link>
              )}
            </div>
          )}

          <Link
            href={profileUrl}
            className="block rounded-2xl bg-white border border-ocean/[0.06] p-4 hover:border-ocean/[0.15] hover:shadow-sm transition-all text-center"
          >
            <p className="text-[11px] text-ocean/55">
              {mode === "admin" ? "Profil & Kontext bearbeiten" : "Mein Profil ansehen"}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Dot({ tone, label }: { tone: "green" | "amber" | "red"; label: string }) {
  const map = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red:   "bg-red-50 text-red-600 border-red-200",
  } as const;
  return <span className={`text-[10px] border rounded-md px-1.5 py-0.5 font-medium shrink-0 ${map[tone]}`}>{label}</span>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-2 py-1.5">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="text-[9px] text-white/45 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
