"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Clock, Trash2, Film } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

// ── Types ─────────────────────────────────────────────────────────────────

interface StoryConcept { hook: string; value_or_proof: string; cta: string }
interface DailyTheme { pillar: string; theme: string }
interface SalesFrames { hook: string; pain: string; solution: string; proof: string; cta: string }
interface SalesSequence { name: string; pillar: string; deployment_timing: string; frames: SalesFrames; keyword: string }
interface SevenDayEntry { day: string; pillar: string; hook: string; key_message: string; visuals: string; cta: string }

interface StoryStrategyContent {
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

interface StrategyRow {
  id: string;
  content: StoryStrategyContent;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const PILLAR_LABELS: Record<string, string> = {
  pain: "Pain & Fehler",
  process: "Prozess & System",
  proof: "Beweis & Cases",
  pitch: "Pitch & CTA",
};

const DAY_LABELS: Record<string, string> = {
  Mon: "Montag", Tue: "Dienstag", Wed: "Mittwoch", Thu: "Donnerstag",
  Fri: "Freitag", Sat: "Samstag", Sun: "Sonntag",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

// ── Page ──────────────────────────────────────────────────────────────────

export default function StoriesPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;

  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/configs/${clientId}/story-strategies`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setStrategies(data);
        if (data.length > 0) setSelectedId(data[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clientId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/configs/${clientId}/story-strategies`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unbekannter Fehler" }));
        setError(err.error || "Generierung fehlgeschlagen");
        return;
      }
      const saved = await res.json();
      await load();
      if (saved?.id) setSelectedId(saved.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerkfehler");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (strategyId: string) => {
    if (!confirm("Diese Strategie wirklich löschen?")) return;
    const res = await fetch(`/api/configs/${clientId}/story-strategies?strategyId=${strategyId}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      if (selectedId === strategyId) setSelectedId(null);
    }
  };

  const selected = strategies.find(s => s.id === selectedId);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={Film}
        eyebrow="Content"
        title="Stories"
        subtitle="Strategische Instagram Story Kampagnen"
        actions={
          strategies.length > 0 ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-ocean text-white px-4 py-2 text-sm font-medium hover:bg-ocean-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? "Generiere…" : "Neue Strategie"}
            </button>
          ) : null
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ocean/50">Lädt…</p>
      ) : strategies.length === 0 ? (
        <div className="rounded-2xl border border-ocean/10 bg-white p-8 text-center">
          <Film className="h-8 w-8 text-ocean/30 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-ocean mb-1">Noch keine Story-Strategie</h3>
          <p className="text-sm text-ocean/60 mb-4">Generiere die erste strategische Story-Kampagne für diesen Client.</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-lg bg-ocean text-white px-4 py-2 text-sm font-medium hover:bg-ocean-light disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {generating ? "Generiere…" : "Jetzt generieren"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* History sidebar */}
          <aside className="space-y-2">
            <p className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider mb-2">Historie</p>
            {strategies.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                type="button"
                className={`w-full text-left rounded-lg border p-3 transition ${
                  selectedId === s.id
                    ? "border-ocean/30 bg-ocean/[0.03]"
                    : "border-ocean/10 bg-white hover:border-ocean/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-ocean/60">
                    <Clock className="h-3 w-3" />
                    {fmtDate(s.created_at)}
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleDelete(s.id); }}
                    className="text-ocean/30 hover:text-red-500 transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="text-sm text-ocean mt-1 line-clamp-2">
                  {s.content.campaign_plan?.objective || "Story-Strategie"}
                </p>
              </button>
            ))}
          </aside>

          {/* Detail view */}
          <div className="space-y-6">
            {selected ? <StrategyDetail content={selected.content} /> : (
              <p className="text-sm text-ocean/50">Wähle eine Strategie aus der Liste.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail view — renders all 5 sections ─────────────────────────────────

function StrategyDetail({ content }: { content: StoryStrategyContent }) {
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
