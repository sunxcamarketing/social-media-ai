"use client";

import { Section } from "@/components/ui/section";

// ── Types ─────────────────────────────────────────────────────────────────

export interface StoryConcept { hook: string; value_or_proof: string; cta: string }
export interface DailyTheme { pillar: string; theme: string }
export interface SalesFrames { hook: string; pain: string; solution: string; proof: string; cta: string }
export interface SalesSequence { name: string; pillar: string; deployment_timing: string; frames: SalesFrames; keyword: string }
export interface SevenDayEntry { day: string; pillar: string; hook: string; key_message: string; visuals: string; cta: string }

export interface StoryStrategyContent {
  campaign_plan: {
    objective: string;
    duration_days: number;
    daily_themes: DailyTheme[];
    story_concepts: StoryConcept[];
    expected_metrics: string;
  };
  community_building: {
    interactive_formats: string[];
    member_features: string;
    recurring_series: string[];
    engagement_loops: string;
  };
  sales_sequences: SalesSequence[];
  daily_insights: {
    day_in_life_concepts: string[];
    business_weaving: string;
    bts_moments: string;
    balance_personal_business: string;
  };
  seven_day_plan: SevenDayEntry[];
}

// ── Labels ────────────────────────────────────────────────────────────────

export const PILLAR_LABELS: Record<string, string> = {
  pain: "Pain & Fehler",
  process: "Prozess & System",
  proof: "Beweis & Cases",
  pitch: "Pitch & CTA",
};

export const DAY_LABELS: Record<string, string> = {
  Mon: "Montag", Tue: "Dienstag", Wed: "Mittwoch", Thu: "Donnerstag",
  Fri: "Freitag", Sat: "Samstag", Sun: "Sonntag",
};

// ── Detail view ───────────────────────────────────────────────────────────

export function StoryStrategyDetail({ content }: { content: StoryStrategyContent }) {
  const { campaign_plan: cp, community_building: cb, sales_sequences: ss, daily_insights: di, seven_day_plan: sdp } = content;

  return (
    <>
      <Section title={`Kampagnen-Plan · ${cp.duration_days} Tage`}>
        <p className="text-sm text-ocean mb-4"><strong>Ziel:</strong> {cp.objective}</p>

        <div className="mb-4">
          <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Tages-Themen</p>
          <ul className="space-y-1.5 text-sm">
            {cp.daily_themes.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-ocean/[0.06] text-ocean/70 uppercase">{PILLAR_LABELS[t.pillar] || t.pillar}</span>
                <span className="text-ocean">{t.theme}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4">
          <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Story-Konzepte</p>
          <div className="space-y-3">
            {cp.story_concepts.map((c, i) => (
              <div key={i} className="rounded-lg border border-ocean/10 p-3 text-sm space-y-1">
                <p><strong className="text-ocean/70">Hook:</strong> {c.hook}</p>
                <p><strong className="text-ocean/70">Value/Beweis:</strong> {c.value_or_proof}</p>
                <p><strong className="text-ocean/70">CTA:</strong> {c.cta}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-ocean/70"><strong>Erwartete Metriken:</strong> {cp.expected_metrics}</p>
      </Section>

      <Section title="Community Building">
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Interaktive Formate</p>
            <ul className="list-disc list-inside text-ocean space-y-0.5">
              {cb.interactive_formats.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Community-Features</p>
            <p className="text-ocean">{cb.member_features}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Wiederkehrende Serien</p>
            <ul className="list-disc list-inside text-ocean space-y-0.5">
              {cb.recurring_series.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Engagement-Loops</p>
            <p className="text-ocean">{cb.engagement_loops}</p>
          </div>
        </div>
      </Section>

      <Section title="Sales-Sequenzen">
        <div className="space-y-4">
          {ss.map((seq, i) => (
            <div key={i} className="rounded-xl border border-ocean/10 p-4 bg-white">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h3 className="text-sm font-medium text-ocean">{seq.name}</h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-ocean/[0.06] text-ocean/70 uppercase">{PILLAR_LABELS[seq.pillar] || seq.pillar}</span>
              </div>
              <p className="text-xs text-ocean/60 mb-3">Einsatz: {seq.deployment_timing}</p>
              <div className="space-y-1.5 text-sm">
                <p><strong className="text-ocean/70">Frame 1 — Hook:</strong> {seq.frames.hook}</p>
                <p><strong className="text-ocean/70">Frame 2 — Pain:</strong> {seq.frames.pain}</p>
                <p><strong className="text-ocean/70">Frame 3 — Lösung:</strong> {seq.frames.solution}</p>
                <p><strong className="text-ocean/70">Frame 4 — Beweis:</strong> {seq.frames.proof}</p>
                <p><strong className="text-ocean/70">Frame 5 — CTA:</strong> {seq.frames.cta}</p>
              </div>
              <p className="mt-2 text-xs text-ocean/60"><strong>DM-Keyword:</strong> <code className="px-1.5 py-0.5 rounded bg-ocean/[0.06] font-mono">{seq.keyword}</code></p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Daily Insights Framework">
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Day-in-the-Life-Konzepte</p>
            <ul className="list-disc list-inside text-ocean space-y-0.5">
              {di.day_in_life_concepts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Business natürlich einbinden</p>
            <p className="text-ocean">{di.business_weaving}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Behind-the-Scenes</p>
            <p className="text-ocean">{di.bts_moments}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-ocean/50 uppercase tracking-wider mb-1">Balance Personal/Business</p>
            <p className="text-ocean">{di.balance_personal_business}</p>
          </div>
        </div>
      </Section>

      <Section title="7-Tage-Plan">
        <div className="space-y-3">
          {sdp.map((d, i) => (
            <div key={i} className="rounded-lg border border-ocean/10 p-3 bg-white">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h4 className="text-sm font-medium text-ocean">{DAY_LABELS[d.day] || d.day}</h4>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-ocean/[0.06] text-ocean/70 uppercase">{PILLAR_LABELS[d.pillar] || d.pillar}</span>
              </div>
              <div className="space-y-1 text-sm text-ocean">
                <p><strong className="text-ocean/70">Hook:</strong> {d.hook}</p>
                <p><strong className="text-ocean/70">Kern-Message:</strong> {d.key_message}</p>
                <p><strong className="text-ocean/70">Visuals:</strong> <span className="text-ocean/70">{d.visuals}</span></p>
                <p><strong className="text-ocean/70">CTA:</strong> {d.cta}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
