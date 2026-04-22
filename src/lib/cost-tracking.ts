// ── API Cost Tracking ─────────────────────────────────────────────────────
// One row per LLM/API call in the `api_costs` table. Admin-only view.
// Split: `admin` = initiated by Aysun, `client` = initiated via the portal.

import { supabase } from "./supabase";

export type Provider = "claude" | "gemini" | "apify" | "brave";
export type Initiator = "admin" | "client";

// Anthropic pricing in USD per 1M tokens. Models not listed fall back to Sonnet rates.
const CLAUDE_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-7":        { input: 15,   output: 75,    cacheRead: 1.5,  cacheWrite: 18.75 },
  "claude-opus-4-7[1m]":    { input: 22.5, output: 112.5, cacheRead: 2.25, cacheWrite: 28.125 },
  "claude-sonnet-4-6":      { input: 3,    output: 15,    cacheRead: 0.3,  cacheWrite: 3.75 },
  "claude-haiku-4-5":       { input: 1,    output: 5,     cacheRead: 0.1,  cacheWrite: 1.25 },
};

const CLAUDE_FALLBACK = CLAUDE_PRICING["claude-sonnet-4-6"];

// Gemini pricing per 1M tokens (2.0 Flash).
const GEMINI_PRICING = {
  textInput:  0.075,
  textOutput: 0.30,
  audioInput: 0.30,   // Live API
  audioOutput: 2.00,  // Live API
};

// Brave Search: $3 per 1000 queries (Pro plan baseline).
const BRAVE_COST_PER_QUERY = 3 / 1000;

// Apify Instagram scraper: ~$0.002 per item (varies by actor).
const APIFY_COST_PER_ITEM = 0.002;

interface AnthropicUsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

interface TrackBase {
  clientId: string | null;
  operation: string;
  initiator: Initiator;
  /** Supabase auth user id — WHICH admin/client triggered this call. Optional
   *  because background jobs (cron) have no user. Enables per-user splits on
   *  the /costs page (e.g. "Aysun vs. Team-Member" once other admins exist). */
  userId?: string | null;
}

async function saveCost(entry: {
  provider: Provider;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd: number;
} & TrackBase) {
  try {
    await supabase.from("api_costs").insert({
      client_id: entry.clientId,
      user_id: entry.userId || null,
      provider: entry.provider,
      operation: entry.operation,
      model: entry.model || null,
      input_tokens: entry.inputTokens || 0,
      output_tokens: entry.outputTokens || 0,
      cache_read_tokens: entry.cacheReadTokens || 0,
      cache_write_tokens: entry.cacheWriteTokens || 0,
      cost_usd: entry.costUsd,
      initiator: entry.initiator,
    });
  } catch (e) {
    // Fire-and-forget: never let cost tracking break a pipeline
    console.error("[cost-tracking] Failed to save:", e);
  }
}

/**
 * Track a Claude API call. Pass `response.usage` from the SDK response.
 * No-op if usage is missing.
 */
export async function trackClaudeCost(opts: TrackBase & {
  usage: AnthropicUsageLike | undefined;
  model: string;
}) {
  if (!opts.usage) return;

  const pricing = CLAUDE_PRICING[opts.model] || CLAUDE_FALLBACK;

  const inputTokens      = opts.usage.input_tokens || 0;
  const outputTokens     = opts.usage.output_tokens || 0;
  const cacheReadTokens  = opts.usage.cache_read_input_tokens || 0;
  const cacheWriteTokens = opts.usage.cache_creation_input_tokens || 0;

  const costUsd =
    (inputTokens      * pricing.input      +
     outputTokens     * pricing.output     +
     cacheReadTokens  * pricing.cacheRead  +
     cacheWriteTokens * pricing.cacheWrite) / 1_000_000;

  await saveCost({
    provider: "claude",
    model: opts.model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costUsd,
    clientId: opts.clientId,
    userId: opts.userId,
    operation: opts.operation,
    initiator: opts.initiator,
  });
}

/**
 * Track a Gemini text generation call.
 */
export async function trackGeminiCost(opts: TrackBase & {
  inputTokens: number;
  outputTokens: number;
  audio?: boolean;
}) {
  const { inputTokens, outputTokens, audio = false } = opts;
  const pricing = audio
    ? { input: GEMINI_PRICING.audioInput, output: GEMINI_PRICING.audioOutput }
    : { input: GEMINI_PRICING.textInput, output: GEMINI_PRICING.textOutput };

  const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

  await saveCost({
    provider: "gemini",
    model: audio ? "gemini-2.0-flash-live" : "gemini-2.0-flash",
    inputTokens,
    outputTokens,
    costUsd,
    clientId: opts.clientId,
    userId: opts.userId,
    operation: opts.operation,
    initiator: opts.initiator,
  });
}

/**
 * Track Brave Search queries.
 */
export async function trackBraveCost(opts: TrackBase & { queryCount: number }) {
  if (opts.queryCount <= 0) return;
  const costUsd = opts.queryCount * BRAVE_COST_PER_QUERY;
  await saveCost({
    provider: "brave",
    costUsd,
    clientId: opts.clientId,
    userId: opts.userId,
    operation: opts.operation,
    initiator: opts.initiator,
  });
}

/**
 * Track Apify actor runs.
 */
export async function trackApifyCost(opts: TrackBase & { itemCount: number }) {
  if (opts.itemCount <= 0) return;
  const costUsd = opts.itemCount * APIFY_COST_PER_ITEM;
  await saveCost({
    provider: "apify",
    costUsd,
    clientId: opts.clientId,
    userId: opts.userId,
    operation: opts.operation,
    initiator: opts.initiator,
  });
}

// Estimated per-call cost for Gemini video analysis (upload + analyze).
// Exact token counts aren't returned by the analyze call, so we estimate.
// ~5-10s video ≈ 2000 input tokens + 500 output tokens at Flash rates.
const GEMINI_VIDEO_ANALYSIS_COST = 0.02;

/**
 * Track a Gemini video analysis call with a fixed estimated cost.
 */
export async function trackGeminiVideoAnalysis(opts: TrackBase) {
  await saveCost({
    provider: "gemini",
    model: "gemini-2.0-flash-video",
    costUsd: GEMINI_VIDEO_ANALYSIS_COST,
    clientId: opts.clientId,
    userId: opts.userId,
    operation: opts.operation,
    initiator: opts.initiator,
  });
}

// Gemini Live audio: ~5000 tokens/minute bidirectional. Cost ≈ duration × rate.
// Avg of input ($0.30/M) and output ($2.00/M) audio rates applied to ~5k tok/min.
const GEMINI_LIVE_COST_PER_SECOND = (5000 / 60) * ((GEMINI_PRICING.audioInput + GEMINI_PRICING.audioOutput) / 2) / 1_000_000;

/**
 * Track a Gemini Live voice session by its duration in seconds.
 */
export async function trackGeminiLiveSession(opts: TrackBase & { durationSeconds: number }) {
  if (opts.durationSeconds <= 0) return;
  const costUsd = opts.durationSeconds * GEMINI_LIVE_COST_PER_SECOND;
  await saveCost({
    provider: "gemini",
    model: "gemini-2.0-flash-live",
    costUsd,
    clientId: opts.clientId,
    userId: opts.userId,
    operation: opts.operation,
    initiator: opts.initiator,
  });
}
