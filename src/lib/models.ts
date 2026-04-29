// ── Model Tiers ────────────────────────────────────────────────────────
// Centralized Claude model selection. Picking the right tier per task is
// the single biggest cost lever in this codebase: a Haiku call is ~12x
// cheaper than Opus and faster, and works fine for extraction / classify
// / quality-gate jobs where the structure is fixed and reasoning is
// shallow. Opus is reserved for the few calls that genuinely need
// multi-step reasoning over loaded context (the chat agent, the weekly
// idea Opus pass).
//
// Always import from here. Never hardcode a model id at the call site —
// makes it impossible to retune the whole system at once.

/** Cheap + fast. Extraction, classification, quality gates, parsing. */
export const MODEL_HAIKU = "claude-haiku-4-5-20251001";

/** Balanced default. Standard generation, summarization, creative writes. */
export const MODEL_SONNET = "claude-sonnet-4-6";

/** Top tier. Multi-step reasoning, planning, agentic tool loops. */
export const MODEL_OPUS = "claude-opus-4-7";
