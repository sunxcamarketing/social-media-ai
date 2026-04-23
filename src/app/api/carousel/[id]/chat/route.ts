import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { supabase } from "@/lib/supabase";
import { readConfig } from "@/lib/csv";
import { getCurrentUser } from "@/lib/auth";
import { buildPrompt, CAROUSEL_UPDATE_TOOL } from "@prompts";
import { toolLoadClientContext, toolLoadVoiceProfile } from "@/lib/agent-tools";
import { trackClaudeCost, type Initiator } from "@/lib/cost-tracking";

export const maxDuration = 120;

const MODEL = "claude-sonnet-4-6";

export interface CarouselChatMessage {
  role: "user" | "assistant";
  /** For assistant messages: the plain-text answer (e.g. a follow-up question).
   *  For user messages: what they typed. Empty string allowed when `update` is present. */
  text: string;
  /** Only set on assistant messages that resulted in a TSX update. */
  update?: {
    summary: string;
    /** We don't embed the full tsx in the message to keep payloads light —
     *  the current TSX is always in carousels.tsx_code. We keep a char-count
     *  so the UI can show "updated carousel" without diffing. */
    tsxChars: number;
  };
  createdAt: string;
}

// ── GET: load current carousel state + chat history ─────────────────────

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("carousels")
    .select("id, run_id, client_id, tsx_code, chat_messages, chat_status, updated_at")
    .eq("run_id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// ── POST: append a user message, call Claude, update carousel or answer ─

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const userText: string = (body.message || "").trim();
  if (!userText) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  // Load current carousel state
  const { data: carousel, error: loadErr } = await supabase
    .from("carousels")
    .select("id, run_id, client_id, tsx_code, chat_messages")
    .eq("run_id", runId)
    .single();

  if (loadErr || !carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  const config = await readConfig(carousel.client_id);
  if (!config) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const lang: "de" | "en" = config.language === "en" ? "en" : "de";
  const initiator: Initiator = user.role === "client" ? "client" : "admin";
  const userId = user.id;

  const existingMessages: CarouselChatMessage[] = Array.isArray(carousel.chat_messages)
    ? (carousel.chat_messages as CarouselChatMessage[])
    : [];

  const now = new Date().toISOString();
  const userMessage: CarouselChatMessage = { role: "user", text: userText, createdAt: now };

  // Mark as generating so the UI can reflect in-progress state if user switches tabs.
  await supabase
    .from("carousels")
    .update({
      chat_messages: [...existingMessages, userMessage],
      chat_status: "generating",
      updated_at: now,
    })
    .eq("run_id", runId);

  try {
    // Build prompt with current TSX as context
    const [clientContext, voiceProfile] = await Promise.all([
      toolLoadClientContext(carousel.client_id),
      toolLoadVoiceProfile(carousel.client_id),
    ]);

    const systemPrompt = buildPrompt(
      "carousel-chat-refine",
      {
        client_context: clientContext,
        voice_profile: voiceProfile,
        current_tsx: carousel.tsx_code || "(empty)",
      },
      lang,
    );

    // Multi-turn message history for Claude — flatten DB messages to the shape Claude expects.
    const claudeMessages: Anthropic.MessageParam[] = [];
    for (const m of existingMessages) {
      // Assistant messages with an update get a generic text about the change;
      // the actual new tsx is already in the system prompt (as current_tsx),
      // so we don't need to replay it.
      const content = m.role === "assistant" && m.update
        ? m.update.summary
        : m.text;
      if (!content) continue;
      claudeMessages.push({ role: m.role, content });
    }
    claudeMessages.push({ role: "user", content: userText });

    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt,
      tools: [CAROUSEL_UPDATE_TOOL],
      messages: claudeMessages,
    });

    trackClaudeCost({
      usage: response.usage,
      model: MODEL,
      clientId: carousel.client_id,
      userId,
      operation: "carousel_chat",
      initiator,
    });

    // Parse Claude's output — either a tool_use (update) or text (question).
    const toolUse = response.content.find(b => b.type === "tool_use");
    const textBlocks = response.content.filter(b => b.type === "text");
    const replyText = textBlocks.map(b => (b.type === "text" ? b.text : "")).join("\n").trim();

    const assistantAt = new Date().toISOString();
    let assistantMessage: CarouselChatMessage;
    let newTsx: string | undefined;

    if (toolUse && toolUse.type === "tool_use") {
      const input = toolUse.input as { tsx_code?: string; summary?: string };
      newTsx = (input.tsx_code || "").trim();
      const summary = (input.summary || "Karussell aktualisiert.").trim();
      assistantMessage = {
        role: "assistant",
        text: summary,
        update: { summary, tsxChars: newTsx.length },
        createdAt: assistantAt,
      };
    } else {
      // No tool call — plain text reply (follow-up question or clarification).
      assistantMessage = {
        role: "assistant",
        text: replyText || "(Keine Antwort erhalten — bitte noch einmal versuchen.)",
        createdAt: assistantAt,
      };
    }

    const finalMessages = [...existingMessages, userMessage, assistantMessage];
    const update: Record<string, unknown> = {
      chat_messages: finalMessages,
      chat_status: "idle",
      updated_at: assistantAt,
    };
    if (newTsx) update.tsx_code = newTsx;

    await supabase.from("carousels").update(update).eq("run_id", runId);

    return NextResponse.json({
      message: assistantMessage,
      tsxCode: newTsx || carousel.tsx_code,
    });
  } catch (err) {
    // Reset status so the UI doesn't stay stuck in "generating"
    await supabase
      .from("carousels")
      .update({ chat_status: "error", updated_at: new Date().toISOString() })
      .eq("run_id", runId);
    const msg = err instanceof Error ? err.message : "Chat failed";
    console.error("[carousel/chat] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
