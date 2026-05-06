// ── Tool Schemas — Re-export Index ─────────────────────────────────────────
// Schemas are split by domain into the files in this directory.
// Importers can use either the bundled re-export (@prompts/tools) or
// the specific domain file (@prompts/tools/strategy etc.).

export type { StrategyPromptContext, StrategyOutput } from "./strategy";
export {
  WEEKLY_IDEAS_TOOL,
  TREND_RESEARCH_TOOL,
  STRATEGY_ANALYSIS_TOOL,
  STRATEGY_CREATION_TOOL,
  STRATEGY_REVIEW_TOOL,
} from "./strategy";

export {
  VOICE_PROFILE_TOOL,
  SCRIPT_STRUCTURE_TOOL,
  VOICE_AGENT_GEMINI_TOOLS,
} from "./voice";

export {
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
} from "./agent";

export { CAROUSEL_UPDATE_TOOL, CAROUSEL_UPDATE_SLIDES_TOOL, CAROUSEL_PATCH_TOOL } from "./carousel";
export { ENRICH_PROFILE_TOOL } from "./enrich";
