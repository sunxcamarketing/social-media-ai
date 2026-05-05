// ── Prompt System ──────────────────────────────────────────────────────────
// Modular markdown-based prompt architecture.
// Agent templates in agents/, foundational sub-prompts in foundational/.
// Use buildPrompt() to assemble complete system prompts.

// Loader
export { buildPrompt, loadFoundational, loadAgent } from "./loader";
export type { Lang } from "./loader";

// Tool schemas
export {
  WEEKLY_IDEAS_TOOL,
  VOICE_PROFILE_TOOL,
  SCRIPT_STRUCTURE_TOOL,
  TREND_RESEARCH_TOOL,
  STRATEGY_ANALYSIS_TOOL,
  STRATEGY_CREATION_TOOL,
  STRATEGY_REVIEW_TOOL,
  AGENT_LIST_CLIENTS_TOOL,
  AGENT_LOAD_CONTEXT_TOOL,
  AGENT_LOAD_VOICE_TOOL,
  AGENT_SEARCH_SCRIPTS_TOOL,
  AGENT_CHECK_PERFORMANCE_TOOL,
  AGENT_LOAD_AUDIT_TOOL,
  AGENT_CHECK_COMPETITORS_TOOL,
  AGENT_CHECK_LEARNINGS_TOOL,
  AGENT_SEARCH_WEB_TOOL,
  AGENT_RESEARCH_TRENDS_TOOL,
  AGENT_SAVE_IDEA_TOOL,
  AGENT_LIST_IDEAS_TOOL,
  AGENT_SAVE_SCRIPT_TOOL,
  AGENT_SAVE_STORY_STRATEGY_TOOL,
  AGENT_UPDATE_PROFILE_TOOL,
  VOICE_AGENT_GEMINI_TOOLS,
  CAROUSEL_UPDATE_TOOL,
  CAROUSEL_PATCH_TOOL,
} from "./tools";

// Types
export type { StrategyPromptContext, StrategyOutput } from "./tools";

// Video analysis pipeline (Gemini — separate, unchanged)
export { ANALYSIS_PROMPT, buildConceptsPrompt } from "./analysis";
