// ── Strategy Generation Prompt ───────────────────────────────────────────────
// Used by: POST /api/configs/[id]/generate-strategy
// Creates the complete content strategy: goal, pillars, weekly plan.
// This prompt receives client profile, audit data, performance data,
// competitor data, and training examples.
//
// NOTE: The actual prompt assembly happens inline in the API route
// (src/app/api/configs/[id]/generate-strategy/route.ts) because
// it conditionally includes data blocks based on what's available.
// This file documents the expected input/output contract.

export interface StrategyPromptContext {
  clientContext: string;
  contentTypeList: string;
  formatList: string;
  postsPerWeek: number;
  activeDays: string[];
  auditBlock: string;
  performanceBlock: string;
  competitorBlock: string;
  trainingBlock: string;
}

export interface StrategyOutput {
  strategyGoal: "reach" | "trust" | "revenue";
  reasoning: string;
  pillars: { name: string; subTopics: string }[];
  weekly: Record<string, { type: string; format: string; reason: string }>;
}
