// ── Prompt System ──────────────────────────────────────────────────────────
// Modular markdown-based prompt architecture.
// Agent templates in agents/, foundational sub-prompts in foundational/.
// Use buildPrompt() to assemble complete system prompts.

// Loader
export { buildPrompt, loadFoundational, loadAgent } from "./loader";

// Tool schemas
export {
  TOPIC_SELECTION_TOOL,
  HOOK_GENERATION_TOOL,
  BODY_WRITING_TOOL,
  QUALITY_REVIEW_TOOL,
  VOICE_PROFILE_TOOL,
  SCRIPT_STRUCTURE_TOOL,
  TREND_RESEARCH_TOOL,
  STRATEGY_ANALYSIS_TOOL,
  STRATEGY_CREATION_TOOL,
  STRATEGY_REVIEW_TOOL,
  VIRAL_STRUCTURE_TOOL,
  VIRAL_ADAPT_TOOL,
  VIRAL_PRODUCTION_TOOL,
} from "./tools";

// Types
export type { StrategyPromptContext, StrategyOutput } from "./tools";

// Video analysis pipeline (Gemini — separate, unchanged)
export { ANALYSIS_PROMPT, VIRAL_SCRIPT_ANALYSIS_PROMPT, buildConceptsPrompt } from "./analysis";
