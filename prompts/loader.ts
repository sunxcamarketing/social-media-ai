import fs from "fs";
import path from "path";

const PROMPTS_DIR = path.join(process.cwd(), "prompts");

/**
 * Load a foundational prompt file by name (without .md extension)
 */
export function loadFoundational(name: string): string {
  const filePath = path.join(PROMPTS_DIR, "foundational", `${name}.md`);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load foundational prompt: ${name}`, error);
    return "";
  }
}

/**
 * Load an agent prompt file by name (without .md extension)
 */
export function loadAgent(name: string): string {
  const filePath = path.join(PROMPTS_DIR, "agents", `${name}.md`);
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load agent prompt: ${name}`, error);
    return "";
  }
}

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
  let template = loadAgent(agentPromptName);

  // Find all {{placeholder}} patterns
  const placeholderRegex = /\{\{([^}]+)\}\}/g;

  template = template.replace(placeholderRegex, (_match, placeholder) => {
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

  return template;
}
