/**
 * Audit report helpers — extract and format audit data for AI prompts.
 * Previously lived in generate-week-scripts/route.ts but imported by 4+ files.
 */

import { readAnalysesByClient } from "@/lib/csv";

export function extractAuditContext(report: string): {
  profileOverview: string;
  strengths: string;
  improvements: string;
  contentAnalysis: string;
  immediateActions: string;
} {
  const sections: Record<string, string> = {};
  const parts = report.split(/^## /m);
  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    if (newlineIdx === -1) continue;
    const heading = part.slice(0, newlineIdx).trim().toLowerCase();
    const body = part.slice(newlineIdx + 1).trim();
    sections[heading] = body;
  }

  const trim = (s: string, max = 800) => s ? s.slice(0, max) : "";

  return {
    profileOverview: trim(sections["profil-überblick"] || sections["profil-übersicht"] || ""),
    strengths: trim(sections["stärken"] || sections["strengths"] || ""),
    improvements: trim(sections["verbesserungspotenzial"] || sections["improvements"] || ""),
    contentAnalysis: trim(sections["content-analyse"] || sections["content analysis"] || "", 1200),
    immediateActions: trim(sections["sofort-maßnahmen"] || sections["sofort-massnahmen"] || sections["immediate actions"] || "", 1000),
  };
}

export async function getAuditBlock(clientId: string): Promise<string> {
  const analyses = (await readAnalysesByClient(clientId))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  if (analyses.length === 0) return "";

  const latest = analyses[0];
  const audit = extractAuditContext(latest.report || "");

  const parts: string[] = [];

  if (latest.profileFollowers || latest.profileAvgViews30d) {
    parts.push(`Profil: ${latest.profileFollowers} Follower, ${latest.profileReels30d} Reels/30d, Ø ${latest.profileAvgViews30d} Views`);
  }
  if (audit.profileOverview) parts.push(`ÜBERBLICK:\n${audit.profileOverview}`);
  if (audit.strengths) parts.push(`STÄRKEN:\n${audit.strengths}`);
  if (audit.improvements) parts.push(`VERBESSERUNGSPOTENZIAL:\n${audit.improvements}`);
  if (audit.contentAnalysis) parts.push(`CONTENT-ANALYSE (was funktioniert vs. was nicht):\n${audit.contentAnalysis}`);
  if (audit.immediateActions) parts.push(`SOFORT-MASSNAHMEN:\n${audit.immediateActions}`);

  return parts.length > 0 ? `<audit_report>\n${parts.join("\n\n")}\n</audit_report>` : "";
}
