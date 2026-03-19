"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Users,
  Eye,
  Film,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Zap,
  Target,
  Rocket,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  username: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  profilePicUrl?: string;
}

interface AuditReportProps {
  report: string;
  profile: ProfileData | null;
}

interface Section {
  id: string;
  title: string;
  content: string;
}

// ── Section config ───────────────────────────────────────────────────────────

const SECTION_STYLE: Record<string, {
  icon: typeof TrendingUp;
  gradient: string;
  iconColor: string;
  border: string;
  accentBg: string;
}> = {
  overview: {
    icon: BarChart3,
    gradient: "from-ocean/5 to-transparent",
    iconColor: "text-ocean",
    border: "border-ocean/10",
    accentBg: "bg-ocean/5",
  },
  strengths: {
    icon: CheckCircle2,
    gradient: "from-green-500/5 to-transparent",
    iconColor: "text-green-600",
    border: "border-green-500/15",
    accentBg: "bg-green-50",
  },
  improvements: {
    icon: AlertTriangle,
    gradient: "from-amber-500/5 to-transparent",
    iconColor: "text-amber-500",
    border: "border-amber-500/15",
    accentBg: "bg-amber-50",
  },
  content: {
    icon: BarChart3,
    gradient: "from-blue-500/5 to-transparent",
    iconColor: "text-blue-500",
    border: "border-blue-500/15",
    accentBg: "bg-blue-50",
  },
  actions: {
    icon: Zap,
    gradient: "from-ivory/5 to-transparent",
    iconColor: "text-ivory",
    border: "border-ivory/15",
    accentBg: "bg-red-50",
  },
  strategy: {
    icon: Target,
    gradient: "from-blush/10 to-transparent",
    iconColor: "text-blush-dark",
    border: "border-blush/30",
    accentBg: "bg-blush/10",
  },
  growth: {
    icon: Rocket,
    gradient: "from-green-500/5 to-transparent",
    iconColor: "text-green-600",
    border: "border-green-500/15",
    accentBg: "bg-green-50",
  },
};

// Map section titles (DE + EN) to style keys
const TITLE_MAP: Record<string, string> = {
  "profil-überblick": "overview",
  "profile overview": "overview",
  "stärken": "strengths",
  "strengths": "strengths",
  "verbesserungspotenzial": "improvements",
  "areas for improvement": "improvements",
  "content-analyse": "content",
  "content analysis": "content",
  "sofort-maßnahmen": "actions",
  "immediate action items": "actions",
  "content-strategie empfehlung": "strategy",
  "content strategy recommendation": "strategy",
  "wachstumsprognose": "growth",
  "growth forecast": "growth",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      if (current) sections.push(current);
      const title = match[1].trim();
      const id = TITLE_MAP[title.toLowerCase()] || title.toLowerCase().replace(/\s+/g, "-");
      current = { id, title, content: "" };
    } else if (current) {
      current.content += line + "\n";
    }
  }
  if (current) sections.push(current);

  return sections;
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: typeof Users;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white border border-ocean/[0.06] px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-semibold text-ocean leading-tight">{value}</p>
        <p className="text-[11px] text-ocean/50">{label}</p>
      </div>
    </div>
  );
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: Section }) {
  const style = SECTION_STYLE[section.id] || SECTION_STYLE.overview;
  const Icon = style.icon;

  return (
    <div className={`rounded-2xl border ${style.border} overflow-hidden`}>
      {/* Section header */}
      <div className={`bg-gradient-to-r ${style.gradient} px-5 py-4 flex items-center gap-3`}>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.accentBg}`}>
          <Icon className={`h-4 w-4 ${style.iconColor}`} />
        </div>
        <h2 className="text-sm font-semibold text-ocean">{section.title}</h2>
      </div>

      {/* Section content */}
      <div className="px-5 py-4">
        <div className="prose prose-sm max-w-none text-ocean/80 prose-headings:text-ocean prose-headings:font-medium prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1 prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-[13px] prose-li:leading-relaxed prose-strong:text-ocean prose-ul:my-2 prose-li:my-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {section.content.trim()}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AuditReport({ report, profile }: AuditReportProps) {
  const sections = useMemo(() => parseSections(report), [report]);

  // Calculate engagement rate if we have data
  const engagementRate = profile && profile.avgViews30d > 0 && profile.followers > 0
    ? ((profile.avgViews30d / profile.followers) * 100).toFixed(1)
    : null;

  return (
    <div className="space-y-5">
      {/* Profile header card */}
      {profile && (
        <div className="rounded-2xl bg-gradient-to-br from-ocean to-ocean-light p-6 text-white">
          <div className="flex items-center gap-4 mb-5">
            {profile.profilePicUrl && (
              <img
                src={profile.profilePicUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover border-2 border-white/20"
              />
            )}
            <div>
              <p className="text-xl font-medium">@{profile.username}</p>
              <p className="text-sm text-white/50 mt-0.5">Instagram Audit Report</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={Users}
              label="Follower"
              value={fmt(profile.followers)}
              color="bg-white/10 text-white"
            />
            <StatCard
              icon={Film}
              label="Reels (30 Tage)"
              value={String(profile.reelsCount30d)}
              color="bg-white/10 text-white"
            />
            <StatCard
              icon={Eye}
              label="Ø Views"
              value={fmt(profile.avgViews30d)}
              color="bg-white/10 text-white"
            />
            {engagementRate && (
              <StatCard
                icon={TrendingUp}
                label="View-Rate"
                value={`${engagementRate}%`}
                color="bg-white/10 text-white"
              />
            )}
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      ) : (
        // Fallback: render raw markdown if parsing fails
        <div className="glass rounded-2xl p-6">
          <div className="prose prose-sm max-w-none text-ocean prose-headings:text-ocean prose-headings:font-medium">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

export type { ProfileData };
