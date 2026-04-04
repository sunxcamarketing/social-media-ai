/**
 * Anthropic client factory — single creation point for all Claude API calls.
 * Replaces 20 duplicated `new Anthropic({ apiKey })` + env checks.
 */

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/** Get the shared Anthropic client. Throws if ANTHROPIC_API_KEY is not set. */
export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}
