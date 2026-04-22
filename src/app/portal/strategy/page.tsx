"use client";

import { useEffect, useState } from "react";
import { BarChart2, Target, CalendarDays, Layers } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { PortalShell } from "@/components/portal-shell";
import { safeJsonParse } from "@/lib/safe-json";
import { useI18n } from "@/lib/i18n";
import type { Config } from "@/lib/types";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveClientId) return;
    fetch(`/api/configs/${effectiveClientId}`)
      .then(r => r.json())
      .then(setClient)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveClientId]);

  const pillars = safeJsonParse<Pillar[]>(client?.strategyPillars, []);
  const weeklyRaw = safeJsonParse<WeeklyStructure>(client?.strategyWeekly, {});
  const { _reasoning, ...weekly } = weeklyRaw;
  const postsPerWeek = Math.min(7, Math.max(1, parseInt(client?.postsPerWeek || "5", 10)));
  const activeDays = ALL_DAYS.slice(0, postsPerWeek);
  const hasWeekly = activeDays.some((d) => weekly[d]?.type);
  const hasStrategy = Boolean(client?.strategyGoal || pillars.length > 0 || hasWeekly);
  const goal = client?.strategyGoal ? GOAL_LABELS[client.strategyGoal] : null;

  return (
    <PortalShell
      icon={BarChart2}
      title={t("portal.dash.strategy")}
      loading={authLoading || loading}
      isEmpty={!hasStrategy}
      emptyMessage={t("portal.strategy.empty")}
    >
      <div className="space-y-6">
        {/* Strategic Goal */}
        {client?.strategyGoal && (
          <div className="glass rounded-2xl p-4 sm:p-6">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-blush-dark" /> {t("portal.strategy.goal")}
            </h2>
            {goal ? (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl font-light text-ocean">{goal.label}</span>
                <span className="text-sm text-ocean/55">{goal.description}</span>
              </div>
            ) : (
              <p className="text-sm text-ocean leading-relaxed whitespace-pre-wrap break-words">{client.strategyGoal}</p>
            )}
          </div>
        )}

        {/* Weekly Calendar */}
        {hasWeekly && (
          <div className="glass rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blush-dark" /> {t("strategy.weeklyCalendar") || "Wochenplan"}
              </h2>
              <span className="text-[11px] text-ocean/60">
                {postsPerWeek} {t("strategy.postsPerWeek") || "Posts / Woche"}
              </span>
            </div>
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
        )}

        {/* Content Pillars */}
        {pillars.length > 0 && (
          <div className="glass rounded-2xl p-4 sm:p-6">
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Layers className="h-4 w-4 text-blush-dark" /> {t("portal.strategy.pillars")}
            </h2>
            <div className="space-y-4">
              {pillars.map((p, i) => {
                const subTopics = toSubTopicList(p.subTopics);
                return (
                  <div key={i} className="rounded-xl border border-ocean/[0.06] p-4 bg-white/40 space-y-3">
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
          </div>
        )}
      </div>
    </PortalShell>
  );
}
