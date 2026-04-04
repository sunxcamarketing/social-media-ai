/**
 * Safe JSON parsing — replaces 15+ duplicated try/catch JSON.parse patterns.
 */

/** Parse JSON with fallback — never throws. */
export function safeJsonParse<T = Record<string, unknown>>(
  json: string | null | undefined,
  fallback: T = {} as T,
): T {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
