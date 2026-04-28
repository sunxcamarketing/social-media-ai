"use client";

import { useState } from "react";
import {
  Target,
  Sparkles,
  Calendar,
  TrendingUp,
  MessageCircle,
  Heart,
  ChevronDown,
  DollarSign,
  Film,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ── Types ─────────────────────────────────────────────────────────────────

export interface StoryConcept { hook: string; value_or_proof: string; cta: string }
export interface DailyTheme { pillar: string; theme: string }
export interface SalesFrames { hook: string; pain: string; solution: string; proof: string; cta: string }
export interface SalesSequence { name: string; pillar: string; deployment_timing: string; frames: SalesFrames; keyword: string }
export interface SevenDayEntry { day: string; pillar: string; hook: string; key_message: string; visuals: string; cta: string }

export interface StoryStrategyContent {
  campaign_plan?: {
    objective?: string;
    duration_days?: number;
    daily_themes?: DailyTheme[];
    story_concepts?: StoryConcept[];
    expected_metrics?: string;
  };
  community_building?: {
    interactive_formats?: string[];
    member_features?: string;
    recurring_series?: string[];
    engagement_loops?: string;
  };
  sales_sequences?: SalesSequence[];
  daily_insights?: {
    day_in_life_concepts?: string[];
    business_weaving?: string;
    bts_moments?: string;
    balance_personal_business?: string;
  };
  seven_day_plan?: SevenDayEntry[];
}

// ── Labels & Styling ──────────────────────────────────────────────────────

export const PILLAR_LABELS: Record<string, string> = {
  pain: "Pain & Fehler",
  process: "Prozess & System",
  proof: "Beweis & Cases",
  pitch: "Pitch & CTA",
};

// Subtle tinted palette per pillar — reads as a colored badge, not screaming.
const PILLAR_TONE: Record<string, { bg: string; text: string; dot: string }> = {
  pain:    { bg: "bg-red-50",     text: "text-red-700",    dot: "bg-red-400" },
  process: { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-400" },
  proof:   { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
  pitch:   { bg: "bg-purple-50",  text: "text-purple-700", dot: "bg-purple-400" },
};

export const DAY_LABELS: Record<string, string> = {
  Mon: "Montag", Tue: "Dienstag", Wed: "Mittwoch", Thu: "Donnerstag",
  Fri: "Freitag", Sat: "Samstag", Sun: "Sonntag",
};
const DAY_SHORT: Record<string, string> = {
  Mon: "MO", Tue: "DI", Wed: "MI", Thu: "DO", Fri: "FR", Sat: "SA", Sun: "SO",
};
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Shared UI atoms ───────────────────────────────────────────────────────

function PillarBadge({ pillar }: { pillar: string }) {
  const tone = PILLAR_TONE[pillar] || { bg: "bg-ocean/[0.06]", text: "text-ocean/70", dot: "bg-ocean/40" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${tone.bg} ${tone.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {PILLAR_LABELS[pillar] || pillar}
    </span>
  );
}

function SectionShell({
  title,
  subtitle,
  icon: Icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-ocean/[0.06] bg-white overflow-hidden">
        <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-ocean/[0.015] transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-blush-light/50 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-blush-dark" />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ocean">{title}</span>
                {count !== undefined && count > 0 && (
                  <span className="text-[10px] font-medium text-ocean/40">· {count}</span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-ocean/50 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <ChevronDown className={`h-4 w-4 text-ocean/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-ocean/[0.04] px-5 py-4 bg-ocean/[0.008]">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Day card (used in 7-day plan grid) ────────────────────────────────────

function DayCard({ entry }: { entry: SevenDayEntry }) {
  const [open, setOpen] = useState(false);
  const tone = PILLAR_TONE[entry.pillar] || PILLAR_TONE.proof;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-2xl border border-ocean/[0.06] bg-white overflow-hidden transition-all ${open ? "shadow-[0_4px_20px_rgba(32,35,69,0.08)]" : "hover:shadow-[0_2px_8px_rgba(32,35,69,0.04)]"}`}>
        <CollapsibleTrigger className="w-full p-4 text-left">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className={`h-9 w-9 rounded-xl ${tone.bg} flex items-center justify-center`}>
                <span className={`text-[10px] font-bold ${tone.text} tracking-wider`}>{DAY_SHORT[entry.day] || entry.day.slice(0, 2).toUpperCase()}</span>
              </div>
              <div>
                <div className="text-[11px] font-medium text-ocean">{DAY_LABELS[entry.day] || entry.day}</div>
                <PillarBadge pillar={entry.pillar} />
              </div>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-ocean/30 mt-2 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
          {entry.hook && (
            <p className="text-sm text-ocean leading-snug line-clamp-3 mt-2">
              {entry.hook}
            </p>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-ocean/[0.04] px-4 py-3 space-y-2.5">
          {entry.key_message && (
            <Field label="Kern-Message" value={entry.key_message} />
          )}
          {entry.visuals && (
            <Field label="Visuals" value={entry.visuals} muted />
          )}
          {entry.cta && (
            <Field label="CTA" value={entry.cta} highlight />
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// A labeled text field, used inside expanded cards — no more "Label: Text" inline.
function Field({ label, value, muted, highlight }: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div>
      <p className={`text-[10px] font-medium uppercase tracking-wider mb-0.5 ${highlight ? "text-blush-dark" : "text-ocean/40"}`}>
        {label}
      </p>
      <p className={`text-[13px] leading-snug ${muted ? "text-ocean/60" : "text-ocean"}`}>
        {value}
      </p>
    </div>
  );
}

// ── Main detail view ──────────────────────────────────────────────────────

export function StoryStrategyDetail({ content }: { content: StoryStrategyContent }) {
  const cp = content.campaign_plan;
  const cb = content.community_building;
  const ss = content.sales_sequences ?? [];
  const di = content.daily_insights;
  const sdpRaw = content.seven_day_plan ?? [];

  // Sort 7-day plan by weekday order, fall back to insertion order for unknown days
  const sdp = [...sdpRaw].sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a.day);
    const bi = DAY_ORDER.indexOf(b.day);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="space-y-5">
      {/* ── Overview hero ─────────────────────────────────────────── */}
      {cp?.objective && (
        <div className="relative rounded-2xl bg-gradient-to-br from-ocean via-ocean to-ocean-light p-5 sm:p-6 text-white overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.04]" />
          <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-white/[0.03]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-white/70" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">Kampagnen-Ziel</span>
            </div>
            <p className="text-lg sm:text-xl font-semibold leading-snug mb-4">
              {cp.objective}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {cp.duration_days && (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/80 bg-white/10 rounded-full px-3 py-1">
                  <Calendar className="h-3 w-3" />
                  {cp.duration_days} Tage
                </span>
              )}
              {cp.expected_metrics && (
                <span className="inline-flex items-center gap-1.5 text-xs text-white/80 bg-white/10 rounded-full px-3 py-1">
                  <TrendingUp className="h-3 w-3" />
                  {cp.expected_metrics}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7-day plan: the star of the show ──────────────────── */}
      {sdp.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <h3 className="text-sm font-semibold text-ocean">7-Tage-Plan</h3>
              <p className="text-xs text-ocean/50 mt-0.5">Klick auf einen Tag für Details</p>
            </div>
            <span className="text-[10px] font-medium text-ocean/40 uppercase tracking-wider">
              {sdp.length} {sdp.length === 1 ? "Tag" : "Tage"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sdp.map((d, i) => <DayCard key={i} entry={d} />)}
          </div>
        </div>
      )}

      {/* ── Tages-Themen chips + Story-Konzepte combined ─────────── */}
      {(cp?.daily_themes?.length || cp?.story_concepts?.length) && (
        <SectionShell
          title="Tages-Themen & Story-Konzepte"
          subtitle="Welche Inhalte passen pro Tag"
          icon={Film}
          count={(cp?.daily_themes?.length || 0) + (cp?.story_concepts?.length || 0)}
        >
          <div className="space-y-5">
            {(cp?.daily_themes?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Tages-Themen</p>
                <div className="flex flex-wrap gap-2">
                  {cp!.daily_themes!.map((t, i) => (
                    <div key={i} className="inline-flex items-center gap-2 rounded-xl border border-ocean/[0.08] bg-white px-3 py-1.5 text-[13px]">
                      <PillarBadge pillar={t.pillar} />
                      <span className="text-ocean">{t.theme}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(cp?.story_concepts?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Story-Konzepte</p>
                <div className="space-y-2.5">
                  {cp!.story_concepts!.map((c, i) => (
                    <div key={i} className="rounded-xl border border-ocean/[0.08] bg-white p-3.5 space-y-2">
                      <Field label="Hook" value={c.hook} />
                      <Field label="Value / Beweis" value={c.value_or_proof} muted />
                      <Field label="CTA" value={c.cta} highlight />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionShell>
      )}

      {/* ── Sales sequences ─────────────────────────────────────── */}
      {ss.length > 0 && (
        <SectionShell
          title="Sales-Sequenzen"
          subtitle="DM-Funnels mit 5-Frame-Aufbau"
          icon={DollarSign}
          count={ss.length}
        >
          <div className="space-y-3">
            {ss.map((seq, i) => (
              <div key={i} className="rounded-xl border border-ocean/[0.08] bg-white p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                  <h4 className="text-sm font-semibold text-ocean">{seq.name}</h4>
                  <PillarBadge pillar={seq.pillar} />
                </div>
                {seq.deployment_timing && (
                  <p className="text-[11px] text-ocean/55 mb-3">
                    <span className="uppercase tracking-wider text-ocean/40">Einsatz:</span> {seq.deployment_timing}
                  </p>
                )}
                {seq.frames && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    <Field label="Frame 1 — Hook" value={seq.frames.hook} />
                    <Field label="Frame 2 — Pain" value={seq.frames.pain} />
                    <Field label="Frame 3 — Lösung" value={seq.frames.solution} />
                    <Field label="Frame 4 — Beweis" value={seq.frames.proof} />
                    <div className="sm:col-span-2">
                      <Field label="Frame 5 — CTA" value={seq.frames.cta} highlight />
                    </div>
                  </div>
                )}
                {seq.keyword && (
                  <div className="pt-2 border-t border-ocean/[0.06] flex items-center gap-2">
                    <span className="text-[10px] font-medium text-ocean/40 uppercase tracking-wider">DM-Keyword</span>
                    <code className="text-xs px-2 py-0.5 rounded-md bg-ocean/[0.06] font-mono text-ocean">{seq.keyword}</code>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionShell>
      )}

      {/* ── Community Building ─────────────────────────────────── */}
      {cb && (cb.interactive_formats?.length || cb.member_features || cb.recurring_series?.length || cb.engagement_loops) && (
        <SectionShell
          title="Community Building"
          subtitle="Engagement-Formate & wiederkehrende Serien"
          icon={Heart}
        >
          <div className="space-y-4">
            {(cb.interactive_formats?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Interaktive Formate</p>
                <div className="flex flex-wrap gap-1.5">
                  {cb.interactive_formats!.map((f, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-white border border-ocean/[0.08] text-ocean/80">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(cb.recurring_series?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Wiederkehrende Serien</p>
                <div className="flex flex-wrap gap-1.5">
                  {cb.recurring_series!.map((s, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-white border border-ocean/[0.08] text-ocean/80">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {cb.member_features && <Field label="Community-Features" value={cb.member_features} />}
            {cb.engagement_loops && <Field label="Engagement-Loops" value={cb.engagement_loops} />}
          </div>
        </SectionShell>
      )}

      {/* ── Daily Insights Framework ───────────────────────────── */}
      {di && (di.day_in_life_concepts?.length || di.business_weaving || di.bts_moments || di.balance_personal_business) && (
        <SectionShell
          title="Daily Insights Framework"
          subtitle="Day-in-the-Life & Behind-the-Scenes"
          icon={Sparkles}
        >
          <div className="space-y-4">
            {(di.day_in_life_concepts?.length ?? 0) > 0 && (
              <div>
                <p className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Day-in-the-Life-Konzepte</p>
                <ul className="space-y-1.5">
                  {di.day_in_life_concepts!.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ocean">
                      <span className="text-ocean/30 mt-1.5 shrink-0">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {di.business_weaving && <Field label="Business natürlich einbinden" value={di.business_weaving} />}
            {di.bts_moments && <Field label="Behind-the-Scenes" value={di.bts_moments} />}
            {di.balance_personal_business && <Field label="Balance Personal / Business" value={di.balance_personal_business} />}
          </div>
        </SectionShell>
      )}

      {/* ── Empty hint ──────────────────────────────────────────── */}
      {!cp && !cb && ss.length === 0 && !di && sdp.length === 0 && (
        <div className="rounded-2xl border border-ocean/10 bg-white p-8 text-center">
          <MessageCircle className="h-6 w-6 text-ocean/30 mx-auto mb-2" />
          <p className="text-sm text-ocean/60">Diese Strategie enthält keine Inhalte.</p>
        </div>
      )}
    </div>
  );
}
