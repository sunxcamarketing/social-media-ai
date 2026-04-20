// Deterministic week-based seed for the weekly pipeline.
// Same configId + same ISO week → same seed → reproducible rotation/research.
// Different week → different seed → different pillar offset, pattern order, sub-angle picks.

export type PatternType = "STORY" | "HOW_TO" | "MISTAKES" | "PROOF" | "HOT_TAKE";

export const ALL_PATTERN_TYPES: PatternType[] = ["STORY", "HOW_TO", "MISTAKES", "PROOF", "HOT_TAKE"];

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function weekSeed(configId: string, date = new Date()): number {
  const { year, week } = isoWeek(date);
  return fnv1a(`${configId}-${year}-W${week}`);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededInt(rng: () => number, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive);
}

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = seededInt(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function pickN<T>(items: readonly T[], n: number, rng: () => number): T[] {
  if (n >= items.length) return shuffle(items, rng);
  return shuffle(items, rng).slice(0, n);
}
