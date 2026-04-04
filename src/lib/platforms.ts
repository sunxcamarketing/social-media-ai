// ── Platform Abstraction Layer ─────────────────────────────────────────────
// Defines platform-specific configs for IG, TikTok, LinkedIn.
// Used by pipelines and prompts via {{platform_context}} placeholder.

export type PlatformId = "instagram" | "tiktok" | "linkedin";

export interface PlatformConfig {
  id: PlatformId;
  label: string;
  shortLabel: string;
  contentFormats: string[];
  optimalDurations: {
    short: { min: number; max: number; label: string };
    long: { min: number; max: number; label: string };
  };
  hookStyle: string;
  captionRules: string;
  hashtagStrategy: string;
  scraperAvailable: boolean;
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram Reels",
    shortLabel: "IG",
    contentFormats: ["Reel", "Carousel", "Story", "Post"],
    optimalDurations: {
      short: { min: 15, max: 40, label: "15-40 Sek" },
      long: { min: 45, max: 90, label: "45-90 Sek" },
    },
    hookStyle: "Erster Satz muss in 1.5 Sekunden fesseln. Audio UND Text-Hook gleichzeitig. Scroll-Stopper.",
    captionRules: "Max 2200 Zeichen. Erste Zeile = Neugier-Lücke. CTA am Ende.",
    hashtagStrategy: "3-5 Nischen-Hashtags, 1-2 große. Keine Spam-Tags.",
    scraperAvailable: true,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    shortLabel: "TT",
    contentFormats: ["Video", "Photo Carousel", "LIVE"],
    optimalDurations: {
      short: { min: 7, max: 30, label: "7-30 Sek" },
      long: { min: 30, max: 60, label: "30-60 Sek" },
    },
    hookStyle: "Erste 0.5 Sekunden entscheiden. Visueller Hook dominant. Pattern Interrupt. Casual Ton.",
    captionRules: "Max 4000 Zeichen. Casual, Emojis ok. Kein Corporate-Ton.",
    hashtagStrategy: "2-3 trending Hashtags. Nischen-Tags. FYP-Optimierung.",
    scraperAvailable: true,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    shortLabel: "LI",
    contentFormats: ["Video", "Text Post", "Carousel (PDF)", "Newsletter"],
    optimalDurations: {
      short: { min: 30, max: 60, label: "30-60 Sek" },
      long: { min: 60, max: 180, label: "1-3 Min" },
    },
    hookStyle: "Erster Satz = kontroverse Aussage oder überraschende Zahl. Professionell aber nicht steril.",
    captionRules: "Max 3000 Zeichen. Absätze mit Zeilenumbrüchen. Storytelling-Format funktioniert am besten.",
    hashtagStrategy: "Max 3 Hashtags. Industry-spezifisch. Keine Trending-Tags.",
    scraperAvailable: false,
  },
};

export const DEFAULT_PLATFORM: PlatformId = "instagram";

/**
 * Build the {{platform_context}} block for prompts.
 */
export function buildPlatformContext(platformId: PlatformId): string {
  const p = PLATFORMS[platformId];
  return `ZIEL-PLATFORM: ${p.label}

HOOK-REGELN FÜR ${p.label.toUpperCase()}:
${p.hookStyle}

OPTIMALE DAUER:
- Kurz: ${p.optimalDurations.short.label}
- Lang: ${p.optimalDurations.long.label}

CAPTION/BESCHREIBUNG:
${p.captionRules}

HASHTAGS:
${p.hashtagStrategy}`;
}

/**
 * Get duration limits in words for a platform + version.
 */
export function getPlatformWordLimits(platformId: PlatformId): { shortMax: number; longMax: number } {
  const p = PLATFORMS[platformId];
  // ~2 words per second of speech
  return {
    shortMax: p.optimalDurations.short.max * 2,
    longMax: p.optimalDurations.long.max * 2,
  };
}

/**
 * Parse target platforms from config field (JSON array string).
 */
export function parseTargetPlatforms(raw: string | undefined | null): PlatformId[] {
  if (!raw) return [DEFAULT_PLATFORM];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((p: string) => p in PLATFORMS) as PlatformId[];
    }
  } catch {
    // invalid JSON
  }
  return [DEFAULT_PLATFORM];
}
