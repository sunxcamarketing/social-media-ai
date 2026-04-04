import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

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

/**
 * Load a foundational prompt file by name (without .md extension)
 */
export function loadFoundational(name: string): string {
  const filePath = path.join(PROMPTS_DIR, "foundational", `${name}.md`);
  const content = readCached(filePath);
  if (content === null) {
    console.error(`Failed to load foundational prompt: ${name}`);
    return "";
  }
  return content;
}

/**
 * Load an agent prompt file by name (without .md extension)
 */
export function loadAgent(name: string): string {
  const filePath = path.join(PROMPTS_DIR, "agents", `${name}.md`);
  const content = readCached(filePath);
  if (content === null) {
    console.error(`Failed to load agent prompt: ${name}`);
    return "";
  }
  return content;
}

// Pre-compiled regex — reused across all buildPrompt calls
const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g;

/**
 * Build a prompt from an agent template by substituting {{placeholders}}
 *
 * Placeholders can be:
 * - {{name}} — Replaced with value from substitutions object
 * - If the placeholder name matches a foundational prompt file, it auto-loads that file
 *
 * @param agentPromptName - Name of the agent prompt (without .md)
 * @param substitutions - Object with placeholder values
 */
export function buildPrompt(
  agentPromptName: string,
  substitutions: Record<string, string | null | undefined> = {},
): string {
  const template = loadAgent(agentPromptName);

  return template.replace(PLACEHOLDER_RE, (_match, placeholder) => {
    const key = placeholder.trim();

    // First check if it's in substitutions
    if (key in substitutions) {
      return substitutions[key] || "";
    }

    // Otherwise try to load as a foundational prompt
    const foundationalContent = loadFoundational(key);
    if (foundationalContent) {
      return foundationalContent;
    }

    // If nothing found, return empty (silent fallback for optional sections)
    console.warn(`No substitution found for placeholder: ${key}`);
    return "";
  });
}
