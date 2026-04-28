"use client";

import { useEffect, useMemo, useState } from "react";
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
  Activity,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Section } from "@/components/ui/section";
import { LastWeekActivity } from "@/components/last-week-activity";
import { StoryIdeasCard } from "@/components/story-ideas-card";
import { safeJsonParse } from "@/lib/safe-json";
import { fmt } from "@/lib/format";
import { parseInsights } from "@/lib/performance-helpers";
import { useI18n } from "@/lib/i18n";
import type { Script, Idea, Config, Analysis } from "@/lib/types";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_SHORT_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DAY_SHORT_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DaySlot { type: string; format: string; pillar?: string; }
type WeeklyStructure = Record<string, DaySlot>;

function startOfWeekMs(offsetWeeks = 0): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + offsetWeeks * 7);
  return d.getTime();
}

function startOfDayMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
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
  const { lang, t } = useI18n();
  const [client, setClient] = useState<Config | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  const reloadClient = () => {
    fetch(`/api/configs/${clientId}`).then(r => r.json()).then(c => setClient(c || null)).catch(() => {});
  };

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

  // 7-day script creation trend (for sparkline) — hooks must run before any early return
  const scriptTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, () => 0);
    const today = startOfDayMs(Date.now());
    for (const s of scripts) {
      if (!s.createdAt) continue;
      const ts = new Date(s.createdAt).getTime();
      if (isNaN(ts)) continue;
      const dayStart = startOfDayMs(ts);
      const diff = Math.floor((today - dayStart) / 86_400_000);
      if (diff >= 0 && diff < 7) days[6 - diff]++;
    }
    return days;
  }, [scripts]);

  const ideaTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, () => 0);
    const today = startOfDayMs(Date.now());
    for (const i of ideas) {
      const ts = (i as { createdAt?: string }).createdAt
        ? new Date((i as { createdAt?: string }).createdAt!).getTime()
        : NaN;
      if (isNaN(ts)) continue;
      const diff = Math.floor((today - startOfDayMs(ts)) / 86_400_000);
      if (diff >= 0 && diff < 7) days[6 - diff]++;
    }
    return days;
  }, [ideas]);

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
  const lastWeekStart = startOfWeekMs(-1);
  const scriptsThisWeek = scripts.filter((s) => {
    if (!s.createdAt) return false;
    const ts = new Date(s.createdAt).getTime();
    return !isNaN(ts) && ts >= weekStart;
  }).length;
  const scriptsLastWeek = scripts.filter((s) => {
    if (!s.createdAt) return false;
    const ts = new Date(s.createdAt).getTime();
    return !isNaN(ts) && ts >= lastWeekStart && ts < weekStart;
  }).length;
  const scriptsDelta = scriptsThisWeek - scriptsLastWeek;

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
  const todaySlot: DaySlot | undefined = weekly[todayDay];
  const dayShort = lang === "en" ? DAY_SHORT_EN : DAY_SHORT_DE;

  const hasStrategy = Boolean(client?.strategyGoal || plannedDays.length > 0);
  const isLive = pendingFeedback.length > 0;

  const quickActions: Array<{ href: string; label: string; sub: string; icon: LucideIcon }> = [
    { href: scriptsUrl, label: t("dash.scriptsAndIdeas"), sub: t("dash.scriptsAndIdeasSub"), icon: Lightbulb },
    ...(mode === "admin" ? [{ href: chatUrl, label: t("dash.chatAgent"), sub: t("dash.chatAgentSub"), icon: MessageSquare as LucideIcon }] : []),
    { href: voiceUrl, label: t("dash.voiceSession"), sub: t("dash.voiceSessionSub"), icon: Mic },
  ];

  const locale = lang === "en" ? "en-US" : "de-DE";
  const now = new Date();
  const dateMono = now.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const isoWeek = getIsoWeek(now);

  const heroSubtitle = isLive
    ? t(pendingFeedback.length === 1 ? "dash.pendingFeedbackOne" : "dash.pendingFeedbackMany", { count: pendingFeedback.length })
    : scripts.length === 0
      ? t("dash.noScriptsSubtitle")
      : t("dash.summary", { scripts: scripts.length, ideas: ideas.length });

  const heroTitle = firstName ? t("dash.hi", { name: firstName }) : clientName || t("dash.titleFallback");

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* === HERO: Live status strip === */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ocean via-ocean to-ocean-light text-white p-5 sm:p-7"
      >
        {/* decorative gradient orbs */}
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blush/[0.10] blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-20 h-48 w-48 rounded-full bg-wind/[0.08] blur-3xl pointer-events-none" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
            <LivePulse active={isLive} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">
                  {dateMono}
                </span>
                <span className="text-white/20">·</span>
                <span className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">
                  W{isoWeek}
                </span>
                <span className="text-white/20">·</span>
                <span className={`font-mono text-[10px] tracking-[0.2em] uppercase ${isLive ? "text-blush" : "text-white/45"}`}>
                  {isLive ? (lang === "de" ? "OFFENE TASKS" : "OPEN TASKS") : (lang === "de" ? "ALLES KLAR" : "ALL CLEAR")}
                </span>
              </div>
              <h1 className="text-2xl sm:text-[28px] font-light leading-tight mt-1.5 break-words">
                {heroTitle}
              </h1>
              <p className="text-sm text-white/65 mt-1.5 break-words">
                {heroSubtitle}
              </p>
            </div>
          </div>

          {todaySlot?.type && (
            <Link
              href={strategyUrl}
              className="group flex items-center gap-3 rounded-xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.10] hover:border-white/25 hover:bg-white/[0.10] transition-all px-4 py-3 shrink-0"
            >
              <div className="h-9 w-9 rounded-lg bg-blush/15 border border-blush/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-blush" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/45">
                  {lang === "de" ? "HEUTE" : "TODAY"}
                </p>
                <p className="text-sm font-medium text-white truncate max-w-[180px]">{todaySlot.type}</p>
                {todaySlot.format && <p className="text-[11px] text-white/55 truncate max-w-[180px]">{todaySlot.format}</p>}
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </Link>
          )}
        </div>
      </motion.div>

      {/* === Last 7 days post activity + Story ideas === */}
      <Section title={t("dash.postActivity")} icon={CheckCircle2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LastWeekActivity
            posts={
              parseInsights(client?.performanceInsights || "")?.recentPosts
              || parseInsights(client?.performanceInsights || "")?.top30Days
              || []
            }
            scrapedAt={parseInsights(client?.performanceInsights || "")?.scrapedAt || null}
            clientId={mode === "admin" ? clientId : undefined}
            onRefreshed={reloadClient}
          />
          <StoryIdeasCard clientId={clientId} mode={mode} />
        </div>
      </Section>

      {/* === Metric cards row === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label={t("dash.stats.scriptsThisWeek")}
          value={scriptsThisWeek}
          sublabel={t("dash.stats.ofTotal", { total: scripts.length })}
          icon={FileText}
          delta={scriptsDelta}
          trend={scriptTrend}
          accentColor="#202345"
          href={scriptsUrl}
        />
        <MetricCard
          label={t("dash.stats.feedbackOpen")}
          value={pendingFeedback.length}
          sublabel={pendingFeedback.length > 0 ? t("dash.stats.waitingReaction") : t("dash.stats.allGiven")}
          icon={Clock}
          tone={pendingFeedback.length > 0 ? "amber" : "green"}
          href={scriptsUrl}
        />
        <MetricCard
          label={t("dash.stats.approved")}
          value={approvedCount}
          sublabel={revisionCount > 0 ? t("dash.stats.revisionsOpen", { count: revisionCount }) : t("dash.stats.readyToRecord")}
          icon={ThumbsUp}
          tone="green"
        />
        <MetricCard
          label={t("dash.stats.contentIdeas")}
          value={ideas.length}
          sublabel={t("dash.stats.poolForFutureWeeks")}
          icon={Lightbulb}
          tone="blush"
          trend={ideaTrend}
          accentColor="#D42E35"
          href={scriptsUrl}
        />
      </div>

      {/* === Main 2-col === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        <div className="lg:col-span-2 space-y-5">
          {openFeedback.length > 0 && (
            <Section
              title={t("dash.waitingForFeedback")}
              icon={Clock}
              action={
                <Link href={scriptsUrl} className="font-mono text-[10px] uppercase tracking-[0.15em] text-ocean/45 hover:text-ocean transition-colors flex items-center gap-1">
                  {t("dash.viewAll")} <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <div className="rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-white overflow-hidden divide-y divide-amber-200/40">
                {openFeedback.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.25 }}
                  >
                    <Link
                      href={scriptsUrl}
                      className="group flex items-start gap-3 p-3 sm:p-4 hover:bg-amber-50/60 transition-colors"
                    >
                      <div className="relative shrink-0 mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <div className="absolute inset-0 h-2 w-2 rounded-full bg-amber-500 animate-ping opacity-40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ocean break-words line-clamp-2 leading-snug">
                          {s.title || t("dash.untitled")}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {s.pillar && <span className="font-mono text-[10px] uppercase tracking-wider text-amber-700/80">{s.pillar}</span>}
                          {s.format && <span className="font-mono text-[10px] uppercase tracking-wider text-ocean/40">· {s.format}</span>}
                          {s.createdAt && <span className="font-mono text-[10px] text-ocean/35">· {formatRelative(s.createdAt, lang)}</span>}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-amber-600/40 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </Section>
          )}

          {latestScripts.length > 0 && (
            <Section
              title={t("dash.latestScripts")}
              icon={Activity}
              action={
                <Link href={scriptsUrl} className="font-mono text-[10px] uppercase tracking-[0.15em] text-ocean/45 hover:text-ocean transition-colors flex items-center gap-1">
                  {t("dash.viewAll")} <ArrowRight className="h-3 w-3" />
                </Link>
              }
              delay={0.08}
            >
              <div className="rounded-xl bg-white border border-ocean/10 overflow-hidden">
                {latestScripts.map((s, i) => {
                  const preview = (s.hook || s.body || "").slice(0, 120);
                  const fb = s.clientFeedbackStatus;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.03 * i }}
                      className={i > 0 ? "border-t border-ocean/[0.06]" : ""}
                    >
                      <Link
                        href={scriptsUrl}
                        className="group flex items-start gap-3 px-4 sm:px-5 py-3.5 hover:bg-ocean/[0.02] transition-colors relative"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-blush transition-colors" />
                        <div className="font-mono text-[10px] text-ocean/35 mt-1 shrink-0 w-12">
                          {s.createdAt ? formatRelative(s.createdAt, lang) : ""}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-ocean break-words line-clamp-1 flex-1 min-w-0">
                              {s.title || t("dash.untitled")}
                            </p>
                            {fb === "approved" && <Pill tone="green" label={t("dash.statusApproved")} />}
                            {fb === "rejected" && <Pill tone="red" label={t("dash.statusRejected")} />}
                            {fb === "revision_requested" && <Pill tone="amber" label={t("dash.statusRevision")} />}
                          </div>
                          {preview && (
                            <p className="text-xs text-ocean/55 mt-1 line-clamp-1 break-words">{preview}…</p>
                          )}
                          {s.pillar && (
                            <p className="font-mono text-[10px] uppercase tracking-wider text-ocean/40 mt-1">{s.pillar}</p>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-ocean/15 group-hover:text-ocean/60 group-hover:translate-x-0.5 transition-all shrink-0 mt-1.5" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </Section>
          )}

          {scripts.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-ocean/15 bg-warm-white/40 p-8 sm:p-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-blush-light/40 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-6 w-6 text-blush-dark" />
              </div>
              <h3 className="text-sm font-semibold text-ocean mb-1">{t("dash.noScriptsTitle")}</h3>
              <p className="text-xs text-ocean/55 mb-5 max-w-md mx-auto">
                {t("dash.noScriptsBody")}
              </p>
              <Link
                href={chatUrl}
                className="inline-flex items-center gap-1.5 rounded-xl bg-ocean hover:bg-ocean-light text-white text-xs font-medium px-4 py-2.5 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" /> {t("dash.openChat")}
              </Link>
            </div>
          )}
        </div>

        {/* === Right column === */}
        <div className="space-y-5">
          {plannedDays.length > 0 && (
            <Section title={t("dash.thisWeek")} icon={BarChart2} delay={0.05}>
              <div className="rounded-xl bg-white border border-ocean/10 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-ocean/[0.06]">
                  {ALL_DAYS.map((day, i) => {
                    const slot = weekly[day];
                    const isToday = day === todayDay;
                    const isActive = activeDays.includes(day);
                    const hasContent = isActive && Boolean(slot?.type);
                    return (
                      <div
                        key={day}
                        className={`flex flex-col items-center justify-center py-2.5 transition-colors ${
                          isToday ? "bg-ocean text-white" : hasContent ? "bg-blush-light/30" : "bg-warm-white/40"
                        } ${i < 6 ? "border-r border-ocean/[0.06]" : ""}`}
                      >
                        <span className={`font-mono text-[9px] uppercase tracking-wider ${isToday ? "text-white/65" : "text-ocean/45"}`}>
                          {dayShort[i]}
                        </span>
                        <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                          isToday ? "bg-blush"
                          : hasContent ? "bg-ocean/40"
                          : "bg-ocean/10"
                        }`} />
                      </div>
                    );
                  })}
                </div>

                <div className="p-3 space-y-2.5">
                  {plannedDays.slice(0, 4).map((day) => {
                    const slot = weekly[day];
                    if (!slot) return null;
                    const isToday = day === todayDay;
                    const dayIdx = ALL_DAYS.indexOf(day);
                    return (
                      <div
                        key={day}
                        className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 ${
                          isToday ? "bg-ocean/[0.04]" : ""
                        }`}
                      >
                        <span className={`font-mono text-[10px] uppercase tracking-wider mt-0.5 shrink-0 w-7 ${
                          isToday ? "text-ocean font-semibold" : "text-ocean/40"
                        }`}>
                          {dayShort[dayIdx]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-ocean leading-snug break-words">{slot.type}</p>
                          {slot.format && <p className="text-[11px] text-ocean/50 mt-0.5 break-words">{slot.format}</p>}
                          {slot.pillar && <p className="font-mono text-[10px] uppercase tracking-wider text-blush-dark/70 mt-0.5 break-words">{slot.pillar}</p>}
                        </div>
                        {isToday && (
                          <span className="font-mono text-[9px] uppercase tracking-wider text-ivory font-semibold mt-1 shrink-0">
                            {t("dash.today")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Link
                  href={strategyUrl}
                  className="flex items-center justify-center gap-1 text-[11px] text-ocean/55 hover:text-ocean transition-colors py-2.5 border-t border-ocean/[0.06] font-medium"
                >
                  {t("dash.fullWeekPlan")} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Section>
          )}

          {analysis && (
            <Section title={t("dash.lastAudit")} icon={Search} delay={0.1}>
              <Link
                href={strategyUrl}
                className="block rounded-xl bg-gradient-to-br from-ocean via-ocean to-ocean-light p-4 text-white relative overflow-hidden group hover:shadow-[0_8px_32px_rgba(32,35,69,0.15)] transition-shadow border border-ocean-light/40"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blush/[0.08] blur-2xl" />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                      {analysis.instagramHandle ? `@${analysis.instagramHandle}` : t("dash.profileAudit")}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">live</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label={t("dash.followers")} value={fmt(analysis.profileFollowers || 0)} />
                    <MiniStat label={t("dash.reels30d")} value={String(analysis.profileReels30d || 0)} />
                    <MiniStat label={t("dash.avgViews")} value={fmt(analysis.profileAvgViews30d || 0)} />
                  </div>
                  <p className="text-[10px] text-white/55 mt-3 flex items-center gap-1 group-hover:text-white/85 transition-colors font-medium">
                    {t("dash.fullReport")} <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </p>
                </div>
              </Link>
            </Section>
          )}

          <Section title={t("dash.quickStart")} icon={Sparkles} delay={0.15}>
            <div className="rounded-xl bg-white border border-ocean/10 overflow-hidden">
              {quickActions.map((a, i) => (
                <motion.div
                  key={a.href}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.25 }}
                  className={i > 0 ? "border-t border-ocean/[0.06]" : ""}
                >
                  <Link
                    href={a.href}
                    className="group flex items-center gap-3 p-3 hover:bg-ocean/[0.02] transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-blush-light/40 flex items-center justify-center shrink-0 group-hover:bg-blush/30 transition-colors">
                      <a.icon className="h-4 w-4 text-blush-dark" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ocean">{a.label}</p>
                      <p className="text-[11px] text-ocean/55 truncate">{a.sub}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ocean/25 group-hover:text-ocean/70 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </Section>

          {!hasStrategy && (
            <div className="rounded-xl border-2 border-dashed border-blush/40 bg-blush-light/20 p-4 text-center">
              <RotateCcw className="h-5 w-5 text-blush-dark mx-auto mb-2" />
              <p className="text-xs text-ocean/65 leading-relaxed">
                {mode === "admin" ? t("dash.noStrategyAdmin") : t("dash.noStrategyClient")}
              </p>
              {mode === "admin" && (
                <Link href={strategyUrl} className="inline-block mt-3 text-xs font-medium text-blush-dark hover:text-ocean">
                  {t("dash.toStrategy")} →
                </Link>
              )}
            </div>
          )}

          <Link
            href={profileUrl}
            className="block rounded-xl bg-white border border-ocean/10 px-4 py-3 hover:border-ocean/20 hover:shadow-[0_4px_16px_rgba(32,35,69,0.04)] transition-all text-center"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ocean/55">
              {mode === "admin" ? t("dash.editProfile") : t("dash.viewProfile")}
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function LivePulse({ active }: { active: boolean }) {
  return (
    <div className="relative h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
      <div className={`h-2.5 w-2.5 rounded-full ${active ? "bg-blush" : "bg-green-400"}`} />
      <div className={`absolute h-2.5 w-2.5 rounded-full animate-ping opacity-70 ${active ? "bg-blush" : "bg-green-400"}`} />
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  sublabel?: string;
  icon: LucideIcon;
  delta?: number;
  trend?: number[];
  accentColor?: string;
  tone?: "default" | "green" | "amber" | "blush";
  href?: string;
}

function MetricCard({ label, value, sublabel, icon: Icon, delta, trend, accentColor = "#202345", tone = "default", href }: MetricCardProps) {
  const toneStyles = {
    default: { iconBg: "bg-ocean/[0.05]", iconColor: "text-ocean/60" },
    green:   { iconBg: "bg-green-50",     iconColor: "text-green-600" },
    amber:   { iconBg: "bg-amber-50",     iconColor: "text-amber-600" },
    blush:   { iconBg: "bg-blush-light/60", iconColor: "text-blush-dark" },
  }[tone];

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative overflow-hidden rounded-xl bg-white border border-ocean/10 p-4 sm:p-5 transition-all duration-200 ${
        href ? "hover:border-ocean/20 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(32,35,69,0.06)] cursor-pointer" : ""
      }`}
    >
      {trend && trend.length > 1 && trend.some(v => v > 0) && (
        <div className="absolute bottom-0 left-0 right-0 h-10 sm:h-12 pointer-events-none opacity-90">
          <Sparkline data={trend} color={accentColor} />
        </div>
      )}

      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <span className="font-mono text-[10px] font-medium text-ocean/45 uppercase tracking-[0.15em] truncate">
            {label}
          </span>
          <div className={`h-7 w-7 rounded-lg ${toneStyles.iconBg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-3.5 w-3.5 ${toneStyles.iconColor}`} />
          </div>
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-3xl sm:text-[32px] font-light text-ocean tabular-nums leading-none">
            <CountUp value={value} />
          </span>
          {delta !== undefined && delta !== 0 && (
            <span className={`flex items-center gap-0.5 font-mono text-[11px] font-semibold ${
              delta > 0 ? "text-green-600" : "text-red-500"
            }`}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
            </span>
          )}
        </div>

        {sublabel && (
          <p className="text-[11px] text-ocean/50 mt-1.5 truncate">{sublabel}</p>
        )}
      </div>
    </motion.div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 30;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h * 0.85 - 2}`).join(" ");
  const id = `spark-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#${id})`}
        stroke="none"
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeOpacity="0.5"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Pill({ tone, label }: { tone: "green" | "amber" | "red"; label: string }) {
  const map = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red:   "bg-red-50 text-red-600 border-red-200",
  } as const;
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider border rounded-md px-1.5 py-0.5 font-semibold shrink-0 ${map[tone]}`}>
      {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.08] backdrop-blur-sm border border-white/[0.10] px-2 py-1.5">
      <p className="font-mono text-base font-light text-white tabular-nums leading-none">{value}</p>
      <p className="font-mono text-[9px] text-white/45 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

function formatRelative(iso: string, lang: string): string {
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "";
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60_000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (min < 1) return lang === "de" ? "jetzt" : "now";
  if (min < 60) return `${min}m`;
  if (h < 24) return `${h}h`;
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString(lang === "en" ? "en-US" : "de-DE", { day: "2-digit", month: "2-digit" });
}
