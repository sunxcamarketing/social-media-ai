import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropic";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";
import {
  buildPrompt,
  AGENT_LIST_CLIENTS_TOOL,
  AGENT_LOAD_CONTEXT_TOOL,
  AGENT_LOAD_VOICE_TOOL,
  AGENT_SEARCH_SCRIPTS_TOOL,
  AGENT_CHECK_PERFORMANCE_TOOL,
  AGENT_LOAD_AUDIT_TOOL,
  AGENT_GENERATE_SCRIPT_TOOL,
  AGENT_CHECK_COMPETITORS_TOOL,
  AGENT_CHECK_LEARNINGS_TOOL,
  AGENT_SEARCH_WEB_TOOL,
  AGENT_RESEARCH_TRENDS_TOOL,
  AGENT_SAVE_IDEA_TOOL,
  AGENT_UPDATE_PROFILE_TOOL,
} from "@prompts";
import { executeAgentTool, toolLoadClientContext } from "@/lib/agent-tools";
import { sendEvent, sseResponse } from "@/lib/sse";
import { readConfig } from "@/lib/csv";
import { buildPlatformContext, parseTargetPlatforms, DEFAULT_PLATFORM } from "@/lib/platforms";

export const maxDuration = 120;

const MAX_ITERATIONS = 10;

// Shared tools available to both admins and clients
const SHARED_TOOLS = [
  AGENT_LOAD_CONTEXT_TOOL,
  AGENT_LOAD_VOICE_TOOL,
  AGENT_SEARCH_SCRIPTS_TOOL,
  AGENT_CHECK_PERFORMANCE_TOOL,
  AGENT_LOAD_AUDIT_TOOL,
  AGENT_GENERATE_SCRIPT_TOOL,
  AGENT_CHECK_COMPETITORS_TOOL,
  AGENT_CHECK_LEARNINGS_TOOL,
  AGENT_SEARCH_WEB_TOOL,
  AGENT_RESEARCH_TRENDS_TOOL,
  AGENT_SAVE_IDEA_TOOL,
  AGENT_UPDATE_PROFILE_TOOL,
];

// Admin gets list_clients in addition to shared tools
const ADMIN_TOOLS = [AGENT_LIST_CLIENTS_TOOL, ...SHARED_TOOLS];

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

  // Load platform context for this client
  let platformContext = buildPlatformContext(DEFAULT_PLATFORM);
  if (scopedClientId) {
    const clientConfig = await readConfig(scopedClientId);
    if (clientConfig) {
      const platforms = parseTargetPlatforms(clientConfig.targetPlatforms);
      platformContext = buildPlatformContext(platforms[0] || DEFAULT_PLATFORM);
    }
  }

  let systemPrompt = buildPrompt("content-agent", { platform_context: platformContext });

  if (isAdmin && !scopedClientId) {
    systemPrompt += `\n\n# ADMIN-MODUS
Du sprichst mit Aysun, der Inhaberin von SUNXCA. Sie hat Zugriff auf ALLE Clients.
Nutze list_clients um alle Clients zu sehen. Bei allen anderen Tools MUSST du client_name angeben.
Wenn Aysun keinen Client-Namen nennt, frag kurz nach.`;
  } else if (scopedClientId && isFirstMessage) {
    // Pre-load client context on first message (admin-per-client or client user)
    const context = await toolLoadClientContext(scopedClientId);
    const header = isAdmin
      ? `\n\n# ADMIN-MODUS (SCOPED AUF EINEN CLIENT)\nDu sprichst mit Aysun über einen konkreten Client. Nutze Tools OHNE client_name — der Kontext ist bereits vorgeladen.\n\n# CLIENT-KONTEXT\n`
      : "\n\n# DEIN CLIENT-KONTEXT (vorgeladen)\n";
    systemPrompt += header + context;
  }

  // When admin is scoped to a specific client, drop list_clients to avoid
  // scope drift — the chat is about THIS client only.
  const tools = isAdmin && !scopedClientId ? ADMIN_TOOLS : SHARED_TOOLS;
  const client = getAnthropicClient();

  const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const readable = new ReadableStream({
    async start(controller) {
      try {
        let currentMessages = [...anthropicMessages];

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            system: systemPrompt,
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

          // Execute tools
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const toolBlock of toolUseBlocks) {
            sendEvent(controller, { type: "tool_status", tool: toolBlock.name, status: "running" });

            const result = await executeAgentTool(
              scopedClientId,
              toolBlock.name,
              toolBlock.input as Record<string, unknown>,
            );

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: result,
            });

            sendEvent(controller, { type: "tool_status", tool: toolBlock.name, status: "done" });
          }

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
