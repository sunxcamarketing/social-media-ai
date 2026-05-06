import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { supabase } from "@/lib/supabase";
import { readConfig } from "@/lib/csv";
import { getCurrentUser } from "@/lib/auth";
import { buildPrompt, CAROUSEL_UPDATE_TOOL, CAROUSEL_UPDATE_SLIDES_TOOL, CAROUSEL_PATCH_TOOL } from "@prompts";
import { toolLoadClientContext, toolLoadVoiceProfile } from "@/lib/agent-tools";
import { trackClaudeCost, type Initiator } from "@/lib/cost-tracking";
import { MODEL_SONNET } from "@/lib/models";
import { loadStyleGuideBlock } from "@/lib/carousel/style-guide";
import { replaceSlides, findSlideBlocks } from "@/lib/carousel/slide-parser";

export const maxDuration = 300;

const MODEL = MODEL_SONNET;

type Patch = { find?: string; replace?: string; replace_all?: boolean };

// Apply a list of find/replace patches to TSX text. Strict by default —
// `find` must be a unique substring or the patch is rejected, so Sonnet has
// to provide enough surrounding context to disambiguate. `replace_all` is
// the opt-in for "@handle in every slide footer" type changes. We bail on
// the first failure rather than partially applying — better to ask the
// model to retry the whole batch than ship a half-mutated carousel.
function applyPatches(
  existing: string,
  patches: Patch[],
): { tsx: string } | { error: string } {
  if (!patches.length) return { error: "Keine Patches übergeben." };
  let current = existing;
  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    const find = p.find ?? "";
    const replace = p.replace ?? "";
    if (!find) return { error: `Patch ${i + 1} hat keinen find-Text. Für Einfügungen: setze 'find' auf einen kurzen, eindeutigen Anker direkt vor (oder nach) der gewünschten Position und schreib in 'replace' den Anker + das neue Element. Alternativ: nutze update_carousel für komplettes Rewrite.` };
    const preview = find.slice(0, 80) + (find.length > 80 ? "…" : "");
    if (p.replace_all) {
      if (!current.includes(find)) {
        return { error: `Patch ${i + 1}: find-Text nicht gefunden ("${preview}").` };
      }
      current = current.split(find).join(replace);
      continue;
    }
    const idx = current.indexOf(find);
    if (idx === -1) {
      return { error: `Patch ${i + 1}: find-Text nicht gefunden ("${preview}").` };
    }
    if (current.indexOf(find, idx + find.length) !== -1) {
      return { error: `Patch ${i + 1}: find-Text mehrdeutig (mehrfach im Code) — gib mehr Kontext drumrum mit, oder nutze replace_all ("${preview}").` };
    }
    current = current.slice(0, idx) + replace + current.slice(idx + find.length);
  }
  return { tsx: current };
}

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
      tools: [CAROUSEL_PATCH_TOOL, CAROUSEL_UPDATE_SLIDES_TOOL, CAROUSEL_UPDATE_TOOL],
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

    // Parse Claude's output — either a tool_use (update/patch) or text (question).
    const toolUse = response.content.find(b => b.type === "tool_use");
    const textBlocks = response.content.filter(b => b.type === "text");
    const replyText = textBlocks.map(b => (b.type === "text" ? b.text : "")).join("\n").trim();

    const assistantAt = new Date().toISOString();
    let assistantMessage: CarouselChatMessage;
    let newTsx: string | undefined;

    if (toolUse && toolUse.type === "tool_use" && toolUse.name === "patch_carousel") {
      // Server-side find/replace patches — fastest path. If a patch is
      // ambiguous or its `find` text isn't in the current TSX we don't surface
      // an error: we auto-fall-back to update_slides which is server-enforced
      // safe (other slides physically untouched).
      const input = toolUse.input as {
        patches?: Array<{ find?: string; replace?: string; replace_all?: boolean }>;
        summary?: string;
      };
      const summary = (input.summary || "Karussell aktualisiert.").trim();
      const patchResult = applyPatches(carousel.tsx_code || "", input.patches || []);
      if ("error" in patchResult) {
        // Fallback to update_slides. The model only writes the slides it
        // wants to change; the server keeps every other slide byte-for-byte.
        // No drift on unaffected slides is structurally guaranteed.
        const blocks = findSlideBlocks(carousel.tsx_code || "");
        const slideCount = blocks.length;
        const retry = await client.messages.create({
          model: MODEL,
          max_tokens: 16000,
          system: systemPrompt,
          tools: [CAROUSEL_UPDATE_SLIDES_TOOL],
          tool_choice: { type: "tool", name: "update_slides" },
          messages: [
            ...claudeMessages,
            { role: "assistant", content: response.content },
            {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUse.id,
                  content: `Patch fehlgeschlagen: ${patchResult.error}\n\nNutze update_slides — gib NUR die Slides zurück die wirklich geändert werden müssen. Das aktuelle Karussell hat ${slideCount} Slides (Indizes 0..${slideCount - 1}). Alle nicht zurückgegebenen Slides bleiben byte-für-byte original — du musst sie also nicht ausschreiben.`,
                  is_error: true,
                },
              ],
            },
          ],
        });
        trackClaudeCost({
          usage: retry.usage,
          model: MODEL,
          clientId: carousel.client_id,
          userId,
          operation: "carousel_chat",
          initiator,
        });
        const retryUse = retry.content.find((b) => b.type === "tool_use" && b.name === "update_slides");
        if (retryUse && retryUse.type === "tool_use") {
          const retryInput = retryUse.input as {
            changes?: Array<{ slide_index?: number; tsx?: string }>;
            summary?: string;
          };
          const changes = (retryInput.changes || [])
            .filter((c): c is { slide_index: number; tsx: string } =>
              typeof c.slide_index === "number" && typeof c.tsx === "string",
            )
            .map((c) => ({ index: c.slide_index, tsx: c.tsx }));
          const result = replaceSlides(carousel.tsx_code || "", changes);
          if (result.ok) {
            newTsx = result.tsx;
            const retrySummary = (retryInput.summary || summary).trim();
            assistantMessage = {
              role: "assistant",
              text: retrySummary,
              update: { summary: retrySummary, tsxChars: newTsx.length },
              createdAt: assistantAt,
            };
          } else {
            assistantMessage = {
              role: "assistant",
              text: `Hatte ein Problem beim Anwenden: ${result.error} — sag mir nochmal kurz wo genau es hin soll.`,
              createdAt: assistantAt,
            };
          }
        } else {
          assistantMessage = {
            role: "assistant",
            text: `Hatte ein Problem beim Anwenden des Patches: ${patchResult.error} — sag mir nochmal kurz wo genau es hin soll.`,
            createdAt: assistantAt,
          };
        }
      } else {
        newTsx = patchResult.tsx;
        assistantMessage = {
          role: "assistant",
          text: summary,
          update: { summary, tsxChars: newTsx.length },
          createdAt: assistantAt,
        };
      }
    } else if (toolUse && toolUse.type === "tool_use" && toolUse.name === "update_slides") {
      // Surgical slide replacement. The server splits the existing TSX, swaps
      // ONLY the indices the model returns, and stitches the rest back
      // byte-for-byte. Drift on un-targeted slides is impossible by
      // construction — that's the whole point of this tool over update_carousel.
      const input = toolUse.input as {
        changes?: Array<{ slide_index?: number; tsx?: string }>;
        summary?: string;
      };
      const summary = (input.summary || "Karussell aktualisiert.").trim();
      const changes = (input.changes || [])
        .filter((c): c is { slide_index: number; tsx: string } =>
          typeof c.slide_index === "number" && typeof c.tsx === "string",
        )
        .map((c) => ({ index: c.slide_index, tsx: c.tsx }));
      const result = replaceSlides(carousel.tsx_code || "", changes);
      if (result.ok) {
        newTsx = result.tsx;
        const slidesLabel = result.replaced.length === 1
          ? `Slide ${result.replaced[0] + 1}`
          : `Slides ${result.replaced.map((i) => i + 1).join(", ")}`;
        assistantMessage = {
          role: "assistant",
          text: summary,
          update: {
            summary: `${summary} (${slidesLabel} ersetzt — alle anderen 1:1 erhalten)`,
            tsxChars: newTsx.length,
          },
          createdAt: assistantAt,
        };
      } else {
        assistantMessage = {
          role: "assistant",
          text: `Hatte ein Problem: ${result.error} — sag mir nochmal kurz wo genau es hin soll.`,
          createdAt: assistantAt,
        };
      }
    } else if (toolUse && toolUse.type === "tool_use" && toolUse.name === "update_carousel") {
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
