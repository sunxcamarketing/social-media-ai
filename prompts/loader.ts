import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

export type Lang = "de" | "en";

// ── In-memory cache — skip in dev so prompt edits take effect immediately ──
const isDev = process.env.NODE_ENV === "development";
const cache = new Map<string, string>();

function readCached(filePath: string): string | null {
  if (!isDev) {
    const cached = cache.get(filePath);
    if (cached !== undefined) return cached;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (!isDev) cache.set(filePath, content);
    return content;
  } catch {
    return null;
  }
}

function tryReadLocalized(dir: string, name: string, lang: Lang | undefined): string | null {
  // English: try {name}.en.md first, fall back to {name}.md (German default)
  if (lang === "en") {
    const enPath = path.join(PROMPTS_DIR, dir, `${name}.en.md`);
    const en = readCached(enPath);
    if (en !== null) return en;
    console.warn(`[prompts] missing English variant: ${dir}/${name}.en.md — falling back to German`);
  }
  const dePath = path.join(PROMPTS_DIR, dir, `${name}.md`);
  return readCached(dePath);
}

/**
 * Load a foundational prompt file by name (without .md extension).
 * When lang is "en", tries {name}.en.md first and falls back to {name}.md.
 */
export function loadFoundational(name: string, lang?: Lang): string {
  const content = tryReadLocalized("foundational", name, lang);
  if (content === null) {
    console.error(`Failed to load foundational prompt: ${name}`);
    return "";
  }
  return content;
}

/**
 * Load an agent prompt file by name (without .md extension).
 * When lang is "en", tries {name}.en.md first and falls back to {name}.md.
 */
export function loadAgent(name: string, lang?: Lang): string {
  const content = tryReadLocalized("agents", name, lang);
  if (content === null) {
    console.error(`Failed to load agent prompt: ${name}`);
    return "";
  }
  return content;
}

// Pre-compiled regex — reused across all buildPrompt calls
const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

/**
 * Build a prompt from an agent template by substituting {{placeholders}}.
 *
 * Placeholders can be:
 * - {{name}} — Replaced with value from substitutions object
 * - If the placeholder name matches a foundational prompt file, it auto-loads that file
 *
 * @param agentPromptName - Name of the agent prompt (without .md)
 * @param substitutions - Object with placeholder values
 * @param lang - Language variant (defaults to "de"). Falls back to German if .en.md missing.
 */
export function buildPrompt(
  agentPromptName: string,
  substitutions: Record<string, string | null | undefined> = {},
  lang?: Lang,
): string {
  const template = loadAgent(agentPromptName, lang);

  return template.replace(PLACEHOLDER_RE, (_match, placeholder) => {
    const key = placeholder.trim();

    // First check if it's in substitutions
    if (key in substitutions) {
      return substitutions[key] || "";
    }

    // Otherwise try to load as a foundational prompt in the same language
    const foundationalContent = loadFoundational(key, lang);
    if (foundationalContent) {
      return foundationalContent;
    }

    // If nothing found, return empty (silent fallback for optional sections)
    console.warn(`No substitution found for placeholder: ${key}`);
    return "";
  });
}
