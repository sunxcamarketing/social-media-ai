"use client";

import { useMemo, useCallback, type ReactNode, type ComponentPropsWithoutRef } from "react";
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
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/format";

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
  onSave?: () => void;
  saved?: boolean;
}

interface Section {
  id: string;
  title: string;
  content: string;
}

// ── Section config ───────────────────────────────────────────────────────────

const SECTION_STYLE: Record<string, {
  icon: typeof TrendingUp;
  iconColor: string;
  accentBg: string;
  headerBg: string;
  border: string;
  dotColor: string;
  highlightBg: string;
  highlightText: string;
  exportInclude: boolean;
}> = {
  overview: {
    icon: BarChart3,
    iconColor: "text-ocean",
    accentBg: "bg-ocean/8",
    headerBg: "bg-gradient-to-r from-ocean/[0.06] to-transparent",
    border: "border-ocean/10",
    dotColor: "bg-ocean/40",
    highlightBg: "bg-ocean/[0.06]",
    highlightText: "text-ocean",
    exportInclude: true,
  },
  strengths: {
    icon: CheckCircle2,
    iconColor: "text-green-600",
    accentBg: "bg-green-50",
    headerBg: "bg-gradient-to-r from-green-50 to-transparent",
    border: "border-green-200/60",
    dotColor: "bg-green-500/50",
    highlightBg: "bg-green-50",
    highlightText: "text-green-800",
    exportInclude: true,
  },
  improvements: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    accentBg: "bg-amber-50",
    headerBg: "bg-gradient-to-r from-amber-50 to-transparent",
    border: "border-amber-200/60",
    dotColor: "bg-amber-500/50",
    highlightBg: "bg-amber-50",
    highlightText: "text-amber-800",
    exportInclude: true,
  },
  content: {
    icon: BarChart3,
    iconColor: "text-blue-500",
    accentBg: "bg-blue-50",
    headerBg: "bg-gradient-to-r from-blue-50 to-transparent",
    border: "border-blue-200/60",
    dotColor: "bg-blue-500/50",
    highlightBg: "bg-blue-50",
    highlightText: "text-blue-800",
    exportInclude: false,
  },
  actions: {
    icon: Zap,
    iconColor: "text-ivory",
    accentBg: "bg-red-50",
    headerBg: "bg-gradient-to-r from-red-50 to-transparent",
    border: "border-red-200/60",
    dotColor: "bg-red-400/50",
    highlightBg: "bg-red-50",
    highlightText: "text-red-800",
    exportInclude: true,
  },
  strategy: {
    icon: Target,
    iconColor: "text-blush-dark",
    accentBg: "bg-blush/10",
    headerBg: "bg-gradient-to-r from-blush/10 to-transparent",
    border: "border-blush/30",
    dotColor: "bg-blush-dark/50",
    highlightBg: "bg-blush/10",
    highlightText: "text-blush-dark",
    exportInclude: true,
  },
  growth: {
    icon: Rocket,
    iconColor: "text-green-600",
    accentBg: "bg-green-50",
    headerBg: "bg-gradient-to-r from-green-50 to-transparent",
    border: "border-green-200/60",
    dotColor: "bg-green-500/50",
    highlightBg: "bg-green-50",
    highlightText: "text-green-800",
    exportInclude: true,
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

// ── Custom markdown components ──────────────────────────────────────────────

function createMarkdownComponents(style: (typeof SECTION_STYLE)[string]) {
  let olCounter = 0;

  return {
    p: ({ children }: { children?: ReactNode }) => (
      <p className="text-[14.5px] leading-[1.9] text-ocean/75 mb-4">{children}</p>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <div className={`${style.highlightBg} rounded-lg px-4 py-2.5 mt-6 mb-3`}>
        <h3 className={`text-[12px] font-bold uppercase tracking-wider ${style.highlightText}`}>{children}</h3>
      </div>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold text-ocean">{children}</strong>
    ),
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`font-medium underline decoration-1 underline-offset-2 ${style.highlightText} hover:opacity-70 transition-opacity`}
      >
        {children}
      </a>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="space-y-3 my-4">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => {
      olCounter = 0;
      return <ol className="space-y-3 my-4">{children}</ol>;
    },
    li: ({ children, ...props }: ComponentPropsWithoutRef<"li"> & { children?: ReactNode; ordered?: boolean }) => {
      const isOrdered = props.ordered;
      if (isOrdered) {
        olCounter++;
        return (
          <li className="flex gap-3 items-start">
            <span className={`flex-shrink-0 w-6 h-6 rounded-lg ${style.highlightBg} flex items-center justify-center mt-0.5`}>
              <span className={`text-[11px] font-bold ${style.highlightText}`}>{olCounter}</span>
            </span>
            <div className="text-[14.5px] leading-[1.9] text-ocean/75 flex-1">{children}</div>
          </li>
        );
      }
      return (
        <li className="flex gap-3 items-start">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${style.dotColor} mt-[10px]`} />
          <div className="text-[14.5px] leading-[1.9] text-ocean/75 flex-1">{children}</div>
        </li>
      );
    },
    table: ({ children }: { children?: ReactNode }) => (
      <div className="my-5 rounded-xl border border-ocean/10 overflow-hidden">
        <table className="w-full text-[13px]">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => (
      <thead className="bg-ocean/[0.04]">{children}</thead>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <th className="text-left font-semibold text-ocean px-4 py-3 border-b border-ocean/10 text-[12px] uppercase tracking-wide">{children}</th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td className="px-4 py-3 border-b border-ocean/[0.05] text-ocean/70">{children}</td>
    ),
  };
}

// ── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ section, index }: { section: Section; index: number }) {
  const style = SECTION_STYLE[section.id] || SECTION_STYLE.overview;
  const Icon = style.icon;
  const components = useMemo(() => createMarkdownComponents(style), [section.id]);

  return (
    <div className={`rounded-2xl border ${style.border} overflow-hidden bg-white`}>
      {/* Section header */}
      <div className={`${style.headerBg} px-6 py-4 flex items-center gap-3`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.accentBg}`}>
          <Icon className={`h-4.5 w-4.5 ${style.iconColor}`} />
        </div>
        <div className="flex items-center gap-2.5 flex-1">
          <span className="text-[10px] font-bold text-ocean/25 uppercase tracking-widest">{String(index + 1).padStart(2, "0")}</span>
          <h2 className="text-[15px] font-semibold text-ocean">{section.title}</h2>
        </div>
      </div>

      {/* Section content */}
      <div className="px-6 py-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {section.content.trim()}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ── PDF Export ───────────────────────────────────────────────────────────────

const SECTION_ICONS_SVG: Record<string, string> = {
  overview: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#202345" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  strengths: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  improvements: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  actions: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D42E35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  strategy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c4707c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  growth: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
  content: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
};

const SECTION_COLORS: Record<string, { bg: string; border: string; text: string; highlightBg: string }> = {
  overview: { bg: "#f0f1f8", border: "#d0d3e8", text: "#202345", highlightBg: "#e8e9f4" },
  strengths: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a", highlightBg: "#dcfce7" },
  improvements: { bg: "#fffbeb", border: "#fde68a", text: "#d97706", highlightBg: "#fef3c7" },
  content: { bg: "#eff6ff", border: "#bfdbfe", text: "#3b82f6", highlightBg: "#dbeafe" },
  actions: { bg: "#fef2f2", border: "#fecaca", text: "#D42E35", highlightBg: "#fee2e2" },
  strategy: { bg: "#fdf2f4", border: "#F2C8D2", text: "#c4707c", highlightBg: "#fce7f3" },
  growth: { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a", highlightBg: "#dcfce7" },
};

function markdownToHtml(md: string): string {
  return md
    .replace(/### (.+)/g, (_, title) => {
      return `<div style="background:#f0f1f8;border-radius:8px;padding:8px 14px;margin:20px 0 10px"><h3 style="font-size:12px;font-weight:700;color:#202345;text-transform:uppercase;letter-spacing:0.5px;margin:0">${title}</h3></div>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#202345;font-weight:600">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)/gm, `<div style="display:flex;gap:10px;align-items:flex-start;margin:8px 0"><span style="flex-shrink:0;width:7px;height:7px;border-radius:50%;background:#20234540;margin-top:8px"></span><span style="flex:1;font-size:14px;line-height:1.85;color:#202345cc">$1</span></div>`)
    .replace(/^(\d+)\. (.+)/gm, `<div style="display:flex;gap:10px;align-items:flex-start;margin:8px 0"><span style="flex-shrink:0;width:22px;height:22px;border-radius:6px;background:#f0f1f8;color:#202345;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:2px">$1</span><span style="flex:1;font-size:14px;line-height:1.85;color:#202345cc">$2</span></div>`)
    .replace(/\n\n/g, '<div style="height:12px"></div>')
    .replace(/^(?!<)(.+)$/gm, '<p style="margin:0 0 8px;line-height:1.85;font-size:14px;color:#202345cc">$1</p>');
}

function openPdfExport(profile: ProfileData | null, sections: Section[]) {
  const exportSections = sections.filter(s => {
    const style = SECTION_STYLE[s.id];
    return style ? style.exportInclude : true;
  });

  const engagementRate = profile && profile.avgViews30d > 0 && profile.followers > 0
    ? ((profile.avgViews30d / profile.followers) * 100).toFixed(1)
    : null;

  const date = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

  const sectionHtml = exportSections.map((s, i) => {
    const colors = SECTION_COLORS[s.id] || SECTION_COLORS.overview;
    const icon = SECTION_ICONS_SVG[s.id] || SECTION_ICONS_SVG.overview;
    const content = markdownToHtml(s.content.trim());

    return `
      <div style="border:1px solid ${colors.border};border-radius:12px;overflow:hidden;margin-bottom:24px;break-inside:avoid">
        <div style="background:${colors.bg};padding:14px 20px;display:flex;align-items:center;gap:10px;border-bottom:1px solid ${colors.border}">
          ${icon}
          <span style="font-size:10px;font-weight:700;color:#20234525;letter-spacing:1.5px">${String(i + 1).padStart(2, "0")}</span>
          <span style="font-size:15px;font-weight:600;color:#202345">${s.title}</span>
        </div>
        <div style="padding:20px 24px">
          ${content}
        </div>
      </div>`;
  }).join("\n");

  const statsHtml = profile ? `
    <div style="display:flex;gap:12px;margin-top:20px">
      <div style="flex:1;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Follower</div>
        <div style="font-size:22px;font-weight:700">${fmt(profile.followers)}</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Reels / 30d</div>
        <div style="font-size:22px;font-weight:700">${profile.reelsCount30d}</div>
      </div>
      <div style="flex:1;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Ø Views</div>
        <div style="font-size:22px;font-weight:700">${fmt(profile.avgViews30d)}</div>
      </div>
      ${engagementRate ? `
      <div style="flex:1;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">View-Rate</div>
        <div style="font-size:22px;font-weight:700">${engagementRate}%</div>
      </div>` : ""}
    </div>` : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Audit Report – @${profile?.username || "report"}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #202345; background: #FAF8F5; }
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      @page { margin: 15mm 18mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:20px;right:20px;z-index:100">
    <button onclick="window.print()" style="background:#202345;color:white;border:none;padding:10px 24px;border-radius:999px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Als PDF speichern
    </button>
  </div>

  <div style="max-width:680px;margin:0 auto;padding:40px 24px">
    <div style="background:linear-gradient(135deg,#202345 0%,#2d3060 100%);border-radius:16px;padding:32px 28px;color:white;margin-bottom:28px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div>
          <div style="font-size:22px;font-weight:600">@${profile?.username || ""}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;text-transform:uppercase;letter-spacing:2px">Instagram Audit Report</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:17px;font-weight:300;letter-spacing:3px">SUN<span style="color:#D42E35">X</span>CA</div>
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px">${date}</div>
        </div>
      </div>
      ${statsHtml}
    </div>

    ${sectionHtml}

    <div style="text-align:center;padding:28px 0 12px;border-top:1px solid #20234510;margin-top:16px">
      <div style="font-size:15px;font-weight:300;letter-spacing:3px;color:#202345">SUN<span style="color:#D42E35">X</span>CA</div>
      <div style="font-size:10px;color:#20234540;margin-top:4px;letter-spacing:0.5px">MARKETING</div>
      <div style="font-size:10px;color:#20234530;margin-top:8px">www.sunxca.com</div>
    </div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ── Main component ───────────────────────────────────────────────────────────

export function AuditReport({ report, profile, onSave, saved }: AuditReportProps) {
  const sections = useMemo(() => parseSections(report), [report]);

  const engagementRate = profile && profile.avgViews30d > 0 && profile.followers > 0
    ? ((profile.avgViews30d / profile.followers) * 100).toFixed(1)
    : null;

  const handleExport = useCallback(() => {
    openPdfExport(profile, sections);
  }, [profile, sections]);

  return (
    <div className="space-y-6">
      {/* Profile header card */}
      {profile && (
        <div className="rounded-2xl bg-gradient-to-br from-ocean via-ocean to-ocean-light p-6 text-white relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.04]" />
          <div className="absolute -right-4 bottom-0 h-20 w-20 rounded-full bg-white/[0.03]" />

          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-lg font-semibold">@{profile.username}</p>
                  <p className="text-xs text-white/40 mt-0.5 tracking-wide uppercase">Instagram Audit Report</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onSave && !saved && (
                  <Button
                    size="sm"
                    onClick={onSave}
                    className="h-8 gap-1.5 rounded-lg px-3 text-xs bg-white/15 hover:bg-white/25 text-white border border-white/10"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Speichern
                  </Button>
                )}
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs text-green-300">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Gespeichert
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExport}
                  className="h-8 gap-1.5 rounded-lg px-3 text-xs text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                >
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-3.5 w-3.5 text-white/50" />
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Follower</span>
                </div>
                <p className="text-xl font-bold">{fmt(profile.followers)}</p>
              </div>
              <div className="rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Film className="h-3.5 w-3.5 text-white/50" />
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Reels / 30d</span>
                </div>
                <p className="text-xl font-bold">{profile.reelsCount30d}</p>
              </div>
              <div className="rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="h-3.5 w-3.5 text-white/50" />
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">Ø Views</span>
                </div>
                <p className="text-xl font-bold">{fmt(profile.avgViews30d)}</p>
              </div>
              {engagementRate && (
                <div className="rounded-xl bg-white/[0.08] backdrop-blur-sm border border-white/[0.08] px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-white/50" />
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">View-Rate</span>
                  </div>
                  <p className="text-xl font-bold">{engagementRate}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table of contents */}
      {sections.length > 2 && (
        <div className="rounded-2xl border border-ocean/[0.06] bg-warm-white/50 px-6 py-5">
          <p className="text-[10px] font-bold text-ocean/30 uppercase tracking-widest mb-3">Inhalt</p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {sections.map((section, i) => {
              const sStyle = SECTION_STYLE[section.id] || SECTION_STYLE.overview;
              const Icon = sStyle.icon;
              return (
                <div key={section.id} className="flex items-center gap-2.5 py-1 text-[13px] text-ocean/70">
                  <Icon className={`h-3.5 w-3.5 ${sStyle.iconColor} shrink-0`} />
                  <span className="text-ocean/25 text-[11px] font-mono">{String(i + 1).padStart(2, "0")}</span>
                  <span>{section.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.length > 0 ? (
        <div className="space-y-6">
          {sections.map((section, i) => (
            <SectionCard key={section.id} section={section} index={i} />
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export type { ProfileData };
