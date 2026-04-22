"use client";

import { useEffect, useState } from "react";
import { BarChart2, Target, CalendarDays, Layers, TrendingUp, Eye, Heart, ExternalLink, Search, ChevronDown } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { PortalShell } from "@/components/portal-shell";
import { AuditReport, type ProfileData } from "@/components/audit-report";
import { safeJsonParse } from "@/lib/safe-json";
import { useI18n } from "@/lib/i18n";
import { fmt } from "@/lib/format";
import { parseInsights, type VideoInsight } from "@/lib/performance-helpers";
import type { Config, Analysis } from "@/lib/types";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const GOAL_LABELS: Record<string, { label: string; description: string }> = {
  reach:   { label: "Reach",   description: "Education + Polarisation" },
  trust:   { label: "Trust",   description: "Story + Social Proof" },
  revenue: { label: "Revenue", description: "Authority + Social Proof" },
};

const TYPE_COLORS: Record<string, string> = {
  "Authority":                 "bg-blush/20 text-blush-dark border-blush/40",
  "Story / Personality":       "bg-pink-500/10 text-pink-600 border-pink-500/20",
  "Social Proof":              "bg-green-50 text-green-600 border-green-200",
  "Education":                 "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Education / Value":         "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Polarisation":              "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Opinion / Polarisation":    "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Behind the Scenes":         "bg-slate-500/10 text-slate-500 border-slate-500/20",
  "Inspiration / Motivation":  "bg-blush/20 text-blush-dark border-blush/40",
  "Entertainment":             "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  "Community / Interaction":   "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  "Promotion / Offer":         "bg-blush/20 text-blush-dark border-blush/40",
};

interface StructuredSubTopic { title: string; angle?: string; }
interface Pillar { name: string; why?: string; subTopics?: string | StructuredSubTopic[]; }
interface DaySlot { type: string; format: string; pillar?: string; reason?: string; }
type WeeklyStructure = Record<string, DaySlot> & { _reasoning?: string };

function toSubTopicList(raw: Pillar["subTopics"]): StructuredSubTopic[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw
    .split(/[/,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((title) => ({ title }));
}

export default function PortalStrategy() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [client, setClient] = useState<Config | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditOpen, setAuditOpen] = useState(false);

  useEffect(() => {
    if (!effectiveClientId) return;
    Promise.all([
      fetch(`/api/configs/${effectiveClientId}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/analyses?clientId=${effectiveClientId}`).then((r) => r.json()).catch(() => []),
    ]).then(([cfg, analyses]) => {
      setClient(cfg || null);
      setAnalysis(Array.isArray(analyses) && analyses.length > 0 ? analyses[0] : null);
      setLoading(false);
    });
  }, [effectiveClientId]);

  const pillars = safeJsonParse<Pillar[]>(client?.strategyPillars, []);
  const weeklyRaw = safeJsonParse<WeeklyStructure>(client?.strategyWeekly, {});
  const { _reasoning, ...weekly } = weeklyRaw;
  const postsPerWeek = Math.min(7, Math.max(1, parseInt(client?.postsPerWeek || "5", 10)));
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);
  const hasWeekly = activeDays.some((d) => weekly[d]?.type);
  const goal = client?.strategyGoal ? GOAL_LABELS[client.strategyGoal] : null;
  const insights = parseInsights(client?.performanceInsights || "");
  const hasPerformance = Boolean(insights && (insights.top30Days.length > 0 || insights.topAllTime.length > 0));

  const hasAnyContent = Boolean(
    analysis ||
    hasPerformance ||
    client?.strategyGoal ||
    pillars.length > 0 ||
    hasWeekly,
  );

  const auditProfile: ProfileData | null = analysis
    ? {
        username: analysis.instagramHandle || "",
        followers: analysis.profileFollowers || 0,
        reelsCount30d: analysis.profileReels30d || 0,
        avgViews30d: analysis.profileAvgViews30d || 0,
        profilePicUrl: analysis.profilePicUrl || undefined,
      }
    : null;

  return (
    <PortalShell
      icon={BarChart2}
      title={t("portal.dash.strategy")}
      loading={authLoading || loading}
      isEmpty={!hasAnyContent}
      emptyMessage={t("portal.strategy.empty")}
    >
      <div className="space-y-10">
        {/* ── Audit ───────────────────────────────────────────────────────── */}
        {analysis && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold tracking-wider uppercase text-ocean/60 flex items-center gap-2">
              <Search className="h-3.5 w-3.5" /> Audit
            </h2>
            <div className="rounded-2xl border border-ocean/[0.06] bg-white overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setAuditOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-ocean/[0.02] transition-colors text-left"
                aria-expanded={auditOpen}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {analysis.profilePicUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/proxy-image?url=${encodeURIComponent(analysis.profilePicUrl)}`}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CalendarDays className="h-3 w-3 text-ocean/40 shrink-0" />
                      <span className="text-xs font-semibold text-ocean truncate">
                        {analysis.createdAt
                          ? new Date(analysis.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })
                          : "Audit"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-ocean/50 mt-0.5 flex-wrap">
                      {analysis.instagramHandle && <span>@{analysis.instagramHandle}</span>}
                      <span>{fmt(analysis.profileFollowers || 0)} Follower</span>
                      <span>{analysis.profileReels30d || 0} Reels</span>
                      <span>{fmt(analysis.profileAvgViews30d || 0)} Ø Views</span>
                    </div>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-ocean/40 shrink-0 transition-transform duration-200 ${auditOpen ? "rotate-180" : ""}`} />
              </button>
              {auditOpen && (
                <div className="border-t border-ocean/[0.06] px-4 py-4 animate-fade">
                  <AuditReport report={analysis.report || ""} profile={auditProfile} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Performance ─────────────────────────────────────────────────── */}
        {hasPerformance && insights && (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="text-xs font-semibold tracking-wider uppercase text-ocean/60 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Performance
              </h2>
              {insights.scrapedAt && (
                <p className="text-[11px] text-ocean/40">
                  {t("strategy.lastAnalyzed")} {insights.scrapedAt}
                </p>
              )}
            </div>

            {insights.top30Days.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-ocean/55 font-medium">{t("strategy.top30Days") || "Top Reels — letzte 30 Tage"}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {insights.top30Days.map((v, i) => <VideoInsightCard key={i} video={v} />)}
                </div>
              </div>
            )}

            {insights.topAllTime.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-ocean/55 font-medium">
                  {t("strategy.topLast")} {insights.scrapeWindowDays ? `${insights.scrapeWindowDays} ${t("strategy.days")}` : "12 Monate"} · {t("strategy.excludingLast30") || "ohne letzte 30 Tage"}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {insights.topAllTime.map((v, i) => <VideoInsightCard key={i} video={v} />)}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Strategic Goal ──────────────────────────────────────────────── */}
        {client?.strategyGoal && (
          <section>
            <h2 className="text-xs font-semibold tracking-wider uppercase text-ocean/60 flex items-center gap-2 mb-3">
              <Target className="h-3.5 w-3.5" /> {t("portal.strategy.goal")}
            </h2>
            <div className="glass rounded-2xl p-4 sm:p-6">
              {goal ? (
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-2xl font-light text-ocean">{goal.label}</span>
                  <span className="text-sm text-ocean/55">{goal.description}</span>
                </div>
              ) : (
                <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap break-words">{client.strategyGoal}</p>
              )}
            </div>
          </section>
        )}

        {/* ── Weekly Plan ─────────────────────────────────────────────────── */}
        {hasWeekly && (
          <section>
            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <h2 className="text-xs font-semibold tracking-wider uppercase text-ocean/60 flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" /> {t("strategy.weeklyCalendar") || "Wochenplan"}
              </h2>
              <span className="text-[11px] text-ocean/60">
                {postsPerWeek} {t("strategy.postsPerWeek") || "Posts / Woche"}
              </span>
            </div>
            <div className="glass rounded-2xl p-4 sm:p-6">
              <div className="rounded-xl border border-ocean/[0.06] overflow-hidden">
                {activeDays.map((day, i) => {
                  const slot = weekly[day];
                  if (!slot?.type) return null;
                  const colorClass = TYPE_COLORS[slot.type] || "bg-ocean/[0.02] text-ocean/70 border-ocean/[0.06]";
                  return (
                    <div
                      key={day}
                      className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 px-3 sm:px-4 py-3 ${
                        i > 0 ? "border-t border-ocean/[0.04]" : ""
                      }`}
                    >
                      <span className="text-xs font-semibold text-ocean sm:w-12 shrink-0">{day}</span>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium shrink-0 w-fit ${colorClass}`}>
                        {slot.type}
                      </span>
                      <span className="text-xs text-ocean/50 shrink-0">{slot.format || ""}</span>
                      <span className="text-xs text-ocean/70 flex-1 sm:text-right break-words">{slot.pillar || ""}</span>
                    </div>
                  );
                })}
              </div>
              {_reasoning && (
                <p className="mt-3 text-xs text-ocean/55 leading-relaxed">{_reasoning}</p>
              )}
            </div>
          </section>
        )}

        {/* ── Content Pillars ─────────────────────────────────────────────── */}
        {pillars.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold tracking-wider uppercase text-ocean/60 flex items-center gap-2 mb-3">
              <Layers className="h-3.5 w-3.5" /> {t("portal.strategy.pillars")}
            </h2>
            <div className="space-y-3">
              {pillars.map((p, i) => {
                const subTopics = toSubTopicList(p.subTopics);
                return (
                  <div key={i} className="glass rounded-2xl p-4 sm:p-5 space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blush-light/60 text-[11px] font-bold text-blush-dark shrink-0">
                          {i + 1}
                        </span>
                        <h3 className="text-sm font-semibold text-ocean break-words">{p.name}</h3>
                      </div>
                      {p.why && (
                        <p className="mt-2 text-xs text-ocean/55 leading-relaxed break-words">{p.why}</p>
                      )}
                    </div>

                    {subTopics.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-ocean/45 font-medium">Subtopics</p>
                        <ul className="space-y-1">
                          {subTopics.map((st, j) => (
                            <li key={j} className="flex gap-2 text-xs text-ocean/75">
                              <span className="text-blush-dark shrink-0">·</span>
                              <span className="break-words">
                                <span className="font-medium">{st.title}</span>
                                {st.angle && <span className="text-ocean/50"> — {st.angle}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </PortalShell>
  );
}

// ── Video insight card (inlined — same visual as admin) ─────────────────────

function VideoInsightCard({ video }: { video: VideoInsight }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="glass rounded-2xl overflow-hidden border border-ocean/[0.06]">
      <div className="flex gap-4 p-4">
        <div className="shrink-0 relative">
          {video.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`} alt="" className="h-20 w-14 rounded-xl object-cover" />
          ) : (
            <div className="h-20 w-14 rounded-xl bg-ocean/[0.02] flex items-center justify-center">
              <Eye className="h-4 w-4 text-ocean/60" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug line-clamp-2 break-words">{video.topic || "—"}</p>
            {video.url && (
              <a href={video.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-ocean/65 hover:text-ocean transition-colors mt-0.5">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-ocean flex-wrap">
            <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{fmt(video.views)}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{fmt(video.likes)}</span>
            <span>{video.datePosted}</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {video.audioHook && video.audioHook !== "none" && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-medium text-blush-dark uppercase tracking-wider shrink-0 mt-0.5">Audio</span>
                <p className="text-xs text-ocean italic leading-relaxed break-words">&ldquo;{video.audioHook}&rdquo;</p>
              </div>
            )}
            {video.textHook && video.textHook !== "none" && (
              <div className="flex items-start gap-1.5">
                <span className="text-[10px] font-medium text-red-500 uppercase tracking-wider shrink-0 mt-0.5">Text</span>
                <p className="text-xs text-ocean italic leading-relaxed break-words">&ldquo;{video.textHook}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 pb-2 text-left text-[11px] text-ocean/60 hover:text-ocean transition-colors">
        {expanded ? t("strategy.hideAnalysis") : t("strategy.showAnalysis")}
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-ocean/[0.06]">
          {video.scriptSummary && (
            <div>
              <p className="text-[10px] font-medium text-ocean uppercase tracking-wider mb-1">{t("strategy.scriptSummary")}</p>
              <p className="text-xs text-ocean leading-relaxed break-words">{video.scriptSummary}</p>
            </div>
          )}
          {video.whyItWorked && (
            <div>
              <p className="text-[10px] font-medium text-green-600 uppercase tracking-wider mb-1">{t("strategy.whyItWorked")}</p>
              <p className="text-xs text-ocean leading-relaxed break-words">{video.whyItWorked}</p>
            </div>
          )}
          {video.howToReplicate && (
            <div>
              <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wider mb-1">{t("strategy.howToReplicate")}</p>
              <p className="text-xs text-ocean leading-relaxed break-words">{video.howToReplicate}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
