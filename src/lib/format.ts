/**
 * Shared formatting utilities — used across API routes and UI components.
 * Replaces 10+ duplicated fmt/formatViews/formatNumber/fmtDuration functions.
 */

/** Compact number format: 1500 → "1.5K", 1200000 → "1.2M" */
export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

/** Duration format: 90 → "1m30s", 45 → "45s" */
export function fmtDuration(s: number): string {
  if (!s) return "?s";
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ""}`;
}

/** Approximate word count for a given duration in seconds (~2 words/sec). */
export function secondsToWords(s: number): number {
  return Math.round(s * 2);
}
