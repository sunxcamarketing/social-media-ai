import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import {
  buildPrompt,
  loadFoundational,
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
  AGENT_UPDATE_PROFILE_TOOL,
} from "@prompts";
import { executeAgentTool, toolLoadClientContext } from "@/lib/agent-tools";
import { sendEvent, sseResponse } from "@/lib/sse";
import { readConfig } from "@/lib/csv";
import { buildPlatformContext, parseTargetPlatforms, DEFAULT_PLATFORM } from "@/lib/platforms";

export const maxDuration = 300;

const MAX_ITERATIONS = 10;

// Shared tools available when the chat has a resolved client scope
// (admin-scoped chat or client user). Write tools like save_idea /
// save_script / update_profile belong here because they mutate a
// specific client's data — and a scope is required to know which one.
const SHARED_TOOLS = [
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
  AGENT_UPDATE_PROFILE_TOOL,
];

// Admin global chat (no scopedClientId): read-only + list_clients.
// Write tools are intentionally excluded so a hallucinated or partial
// client_name can't silently persist data to the wrong client.
const ADMIN_GLOBAL_TOOLS = [
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
  AGENT_LIST_IDEAS_TOOL,
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const messages: ChatMessage[] = body.messages || [];
  const requestedClientId: string | undefined = body.clientId;
  const attachments: Array<{ name: string; mediaType: string; data: string }> =
    Array.isArray(body.attachments) ? body.attachments : [];

  if (messages.length === 0) {
    return Response.json({ error: "No messages" }, { status: 400 });
  }

  const isAdmin = user.role === "admin";
  // For admins, a clientId in the request body scopes the conversation to that
  // client (used by /clients/[id]/chat). Otherwise: null for admin (global),
  // effective client for client users.
  const scopedClientId = isAdmin && requestedClientId
    ? requestedClientId
    : getEffectiveClientId(user);

  // Build system prompt based on role
  const isFirstMessage = messages.length === 1;

  // Load platform context + language for this client
  let platformContext = buildPlatformContext(DEFAULT_PLATFORM);
  let lang: "de" | "en" = "de";
  if (scopedClientId) {
    const clientConfig = await readConfig(scopedClientId);
    if (clientConfig) {
      const platforms = parseTargetPlatforms(clientConfig.targetPlatforms);
      platformContext = buildPlatformContext(platforms[0] || DEFAULT_PLATFORM);
      if (clientConfig.language === "en") lang = "en";
    }
  }

  let systemPrompt = buildPrompt("content-agent", { platform_context: platformContext }, lang);

  if (isAdmin && !scopedClientId) {
    systemPrompt += "\n\n" + loadFoundational("chat-admin-mode", lang);
  } else if (scopedClientId && isFirstMessage) {
    // Pre-load client context on first message (admin-per-client or client user)
    const context = await toolLoadClientContext(scopedClientId);
    const header = isAdmin
      ? "\n\n" + loadFoundational("chat-admin-scoped", lang) + "\n"
      : "\n\n" + loadFoundational("chat-client-scoped", lang) + "\n";
    systemPrompt += header + context;
  }

  // When admin is scoped to a specific client, drop list_clients to avoid
  // scope drift — the chat is about THIS client only.
  const tools = isAdmin && !scopedClientId ? ADMIN_GLOBAL_TOOLS : SHARED_TOOLS;
  const client = getAnthropicClient();

  // Strip the "data:<mediatype>;base64," prefix Anthropic blocks expect raw base64.
  const stripDataUrl = (url: string): string => {
    const idx = url.indexOf(",");
    return idx === -1 ? url : url.slice(idx + 1);
  };

  const attachmentBlocks: Anthropic.ContentBlockParam[] = attachments
    .map((a): Anthropic.ContentBlockParam | null => {
      const base64 = stripDataUrl(a.data);
      if (a.mediaType.startsWith("image/")) {
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: a.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
            data: base64,
          },
        };
      }
      if (a.mediaType === "application/pdf") {
        return {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        };
      }
      return null;
    })
    .filter((b): b is Anthropic.ContentBlockParam => b !== null);

  // Attachments come with the LAST user message (the one the user just sent).
  const lastUserIdx = messages.length - 1;
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (i === lastUserIdx && m.role === "user" && attachmentBlocks.length > 0) {
      const textBlock: Anthropic.TextBlockParam[] = m.content
        ? [{ type: "text", text: m.content }]
        : [];
      return { role: "user", content: [...attachmentBlocks, ...textBlock] };
    }
    return { role: m.role, content: m.content };
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...anthropicMessages];

        // Enable Anthropic prompt caching on the system prompt — massive speed-up
        // on multi-turn conversations (cache hit skips re-processing the prompt).
        // Ephemeral cache lives ~5 min, perfect for a chat session.
        const cachedSystem: Anthropic.TextBlockParam[] = [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ];

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          const response = await client.messages.create({
            model: "claude-opus-4-7",
            max_tokens: 4096,
            system: cachedSystem,
            messages: currentMessages,
            tools,
          });

          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          // No tool calls — final text response
          if (toolUseBlocks.length === 0) {
            const fullText = response.content
              .filter((b): b is Anthropic.TextBlock => b.type === "text")
              .map(b => b.text)
              .join("");
            if (fullText) {
              sendEvent(controller, { type: "text", text: fullText });
            }
            break;
          }

          // Stream any text before tool calls
          const preToolText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map(b => b.text)
            .join("");
          if (preToolText) {
            sendEvent(controller, { type: "text", text: preToolText });
          }

          // Execute tools IN PARALLEL — major speed-up when the agent fans out
          // to multiple data sources in a single turn (e.g. load_audit +
          // check_performance + search_scripts).
          for (const toolBlock of toolUseBlocks) {
            sendEvent(controller, { type: "tool_status", tool: toolBlock.name, status: "running" });
          }

          const toolResults = await Promise.all(
            toolUseBlocks.map(async (toolBlock) => {
              const result = await executeAgentTool(
                scopedClientId,
                toolBlock.name,
                toolBlock.input as Record<string, unknown>,
              );
              sendEvent(controller, { type: "tool_status", tool: toolBlock.name, status: "done" });
              return {
                type: "tool_result" as const,
                tool_use_id: toolBlock.id,
                content: result,
              };
            }),
          );

          currentMessages = [
            ...currentMessages,
            { role: "assistant" as const, content: response.content },
            { role: "user" as const, content: toolResults },
          ];
        }

        sendEvent(controller, { type: "done" });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Agent error";
        sendEvent(controller, { type: "error", error: msg });
        controller.close();
      }
    },
  });

  return sseResponse(readable);
}
