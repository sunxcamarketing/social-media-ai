import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { supabase } from "@/lib/supabase";
import { readConfig } from "@/lib/csv";
import { getCurrentUser } from "@/lib/auth";
import { buildPrompt, CAROUSEL_UPDATE_TOOL } from "@prompts";
import { toolLoadClientContext, toolLoadVoiceProfile } from "@/lib/agent-tools";
import { trackClaudeCost, type Initiator } from "@/lib/cost-tracking";
import { MODEL_SONNET } from "@/lib/models";
import { loadStyleGuideBlock } from "@/lib/carousel/style-guide";

export const maxDuration = 120;

const MODEL = MODEL_SONNET;

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
  /** Public URLs of user-uploaded photos attached to a user message. */
  imageUrls?: string[];
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
  const imageUrls: string[] = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
    : [];
  if (!userText && imageUrls.length === 0) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  // Load current carousel state
  const { data: carousel, error: loadErr } = await supabase
    .from("carousels")
    .select("id, run_id, client_id, tsx_code, chat_messages, style_guide_id")
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
  const userMessage: CarouselChatMessage = {
    role: "user",
    text: userText,
    ...(imageUrls.length > 0 ? { imageUrls } : {}),
    createdAt: now,
  };

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
    // Build prompt with current TSX + active style guide as context
    const [clientContext, voiceProfile, styleGuide] = await Promise.all([
      toolLoadClientContext(carousel.client_id),
      toolLoadVoiceProfile(carousel.client_id),
      loadStyleGuideBlock(carousel.style_guide_id ?? null, lang),
    ]);

    const systemPrompt = buildPrompt(
      "carousel-chat-refine",
      {
        client_context: clientContext,
        voice_profile: voiceProfile,
        style_guide: styleGuide,
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

    // Build the new user turn — text + freshly uploaded images (multimodal).
    // We download each photo and pass it as base64 so we don't depend on
    // Anthropic being able to reach our Supabase Storage URLs.
    if (imageUrls.length === 0) {
      claudeMessages.push({ role: "user", content: userText });
    } else {
      const fetched = await Promise.all(
        imageUrls.map(async (url) => {
          try {
            const r = await fetch(url);
            if (!r.ok) return null;
            const ct = r.headers.get("content-type") || "image/jpeg";
            const mediaType = (
              ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(ct) ? ct : "image/jpeg"
            ) as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
            const buf = Buffer.from(await r.arrayBuffer());
            return { url, mediaType, base64: buf.toString("base64") };
          } catch {
            return null;
          }
        }),
      );

      const blocks: Anthropic.ContentBlockParam[] = [];
      const usableUrls: string[] = [];
      for (const item of fetched) {
        if (!item) continue;
        usableUrls.push(item.url);
        blocks.push({
          type: "image",
          source: { type: "base64", media_type: item.mediaType, data: item.base64 },
        });
      }
      // Append a text block listing the URLs so Claude can reference them
      // literally in <img src="..."> tags inside the TSX it generates.
      const photoNote = usableUrls.map((u) => `- ${u}`).join("\n");
      const textBlock =
        (userText ? userText + "\n\n" : "") +
        (usableUrls.length > 0
          ? `Hochgeladene Fotos — verwende diese URLs wörtlich in <img src="..."> Tags wenn du sie einbauen sollst:\n${photoNote}`
          : "(Hinweis: Foto-Uploads konnten nicht geladen werden.)");
      blocks.push({ type: "text", text: textBlock });
      claudeMessages.push({ role: "user", content: blocks });
    }

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
