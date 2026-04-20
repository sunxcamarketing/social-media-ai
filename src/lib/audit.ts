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

/**
 * Parse a preferred video duration from an audit report.
 * Looks for common patterns: "35 Sekunden", "30-40s", "unter 40 Sekunden", etc.
 * Returns the lower bound when a range is given so we stay safely inside the ceiling.
 * Returns null if nothing matches.
 */
export function extractPreferredDurationSeconds(report: string): number | null {
  if (!report) return null;
  const text = report.toLowerCase();

  // "strikt X Sekunden" / "strict X seconds" — strongest signal, take as-is
  const strict = text.match(/(?:strikt|strict|genau|exakt|maximal|höchstens)\s*(?:an\s+|bei\s+)?(\d{2})\s*(?:-\s*(\d{2}))?\s*(?:sekunden|sec|s\b)/);
  if (strict) {
    const low = parseInt(strict[1], 10);
    const high = strict[2] ? parseInt(strict[2], 10) : low;
    return Math.min(low, high);
  }

  // Range like "30-40 Sekunden"
  const range = text.match(/(\d{2})\s*-\s*(\d{2})\s*(?:sekunden|sec|s\b)/);
  if (range) {
    const low = parseInt(range[1], 10);
    const high = parseInt(range[2], 10);
    if (low >= 10 && high <= 120) return low;
  }

  // Plain "unter 40 Sekunden" / "bis 40 Sekunden"
  const under = text.match(/(?:unter|bis|max\.?)\s+(\d{2})\s*(?:sekunden|sec|s\b)/);
  if (under) {
    const sec = parseInt(under[1], 10);
    if (sec >= 15 && sec <= 120) return sec;
  }

  // Bare "40 Sekunden" mentioned near "Länge"/"Dauer"
  const nearLength = text.match(/(?:länge|laenge|dauer|duration)\D{0,40}(\d{2})\s*(?:sekunden|sec|s\b)/);
  if (nearLength) {
    const sec = parseInt(nearLength[1], 10);
    if (sec >= 15 && sec <= 120) return sec;
  }

  return null;
}

export async function getAuditBlock(clientId: string): Promise<string> {
  const { block } = await getAuditBlockAndDuration(clientId);
  return block;
}

export async function getAuditBlockAndDuration(
  clientId: string,
): Promise<{ block: string; preferredDurationSeconds: number | null }> {
  const analyses = (await readAnalysesByClient(clientId))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  if (analyses.length === 0) return { block: "", preferredDurationSeconds: null };

  const latest = analyses[0];
  const report = latest.report || "";
  const audit = extractAuditContext(report);
  const preferredDurationSeconds = extractPreferredDurationSeconds(report);

  const parts: string[] = [];

  if (latest.profileFollowers || latest.profileAvgViews30d) {
    parts.push(`Profil: ${latest.profileFollowers} Follower, ${latest.profileReels30d} Reels/30d, Ø ${latest.profileAvgViews30d} Views`);
  }
  if (preferredDurationSeconds) {
    parts.push(`⚠️ LÄNGEN-VORGABE AUS AUDIT: strikt ${preferredDurationSeconds} Sekunden Sprechzeit. Diese Vorgabe MUSS eingehalten werden — sie überschreibt jede andere Längen-Heuristik.`);
  }
  if (audit.profileOverview) parts.push(`ÜBERBLICK:\n${audit.profileOverview}`);
  if (audit.strengths) parts.push(`STÄRKEN:\n${audit.strengths}`);
  if (audit.improvements) parts.push(`VERBESSERUNGSPOTENZIAL:\n${audit.improvements}`);
  if (audit.contentAnalysis) parts.push(`CONTENT-ANALYSE (was funktioniert vs. was nicht):\n${audit.contentAnalysis}`);
  if (audit.immediateActions) parts.push(`SOFORT-MASSNAHMEN:\n${audit.immediateActions}`);

  return {
    block: parts.length > 0 ? `<audit_report>\n${parts.join("\n\n")}\n</audit_report>` : "",
    preferredDurationSeconds,
  };
}
