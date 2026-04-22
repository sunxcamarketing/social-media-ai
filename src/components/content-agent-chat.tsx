"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Trash2, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MarkdownContent } from "@/components/markdown-content";
import { ChatInput, type ChatAttachment } from "@/components/ui/chat-input";
import { useI18n } from "@/lib/i18n";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{ name: string; type: string }>;
}

interface ToolStatus {
  tool: string;
  status: "running" | "done";
  /** Sub-steps shown when the script agent is working. */
  subSteps?: string[];
}

let msgCounter = 0;
const msgId = () => `msg-${Date.now()}-${++msgCounter}`;

interface ContentAgentChatProps {
  /** Scope the conversation to a specific client (admin per-client chat). */
  clientId?: string;
  /** Shown in header subtitle. */
  clientName?: string;
  /** Quick-start prompts shown in the empty state. */
  suggestions?: string[];
  /** "fullscreen" uses the full viewport minus topbar. "embedded" fills parent. */
  layout?: "fullscreen" | "embedded";
  /** Header title (default: "Content Agent"). */
  title?: string;
  /** Subtitle copy in the empty state. */
  emptyStateSubtitle?: string;
}

export function ContentAgentChat({
  clientId,
  clientName,
  suggestions,
  layout = "fullscreen",
  title,
  emptyStateSubtitle,
}: ContentAgentChatProps) {
  const { t } = useI18n();
  const TOOL_LABELS: Record<string, string> = {
    list_clients: t("chat.tools.listClients"),
    load_client_context: t("chat.tools.loadClientContext"),
    load_voice_profile: t("chat.tools.loadVoiceProfile"),
    search_scripts: t("chat.tools.searchScripts"),
    check_performance: t("chat.tools.checkPerformance"),
    load_audit: t("chat.tools.loadAudit"),
    check_competitors: t("chat.tools.checkCompetitors"),
    check_learnings: t("chat.tools.checkLearnings"),
    search_web: t("chat.tools.searchWeb"),
    research_trends: t("chat.tools.researchTrends"),
    save_idea: t("chat.tools.saveIdea"),
    update_profile: t("chat.tools.updateProfile"),
  };
  const resolvedTitle = title ?? t("chat.title");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, toolStatuses, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || streaming) return;

    const userAttachmentMeta = attachments.map((a) => ({ name: a.name, type: a.mediaType }));

    const userMsg: ChatMessage = {
      id: msgId(),
      role: "user",
      content: text,
      attachments: userAttachmentMeta.length > 0 ? userAttachmentMeta : undefined,
    };
    const assistantMsg: ChatMessage = { id: msgId(), role: "assistant", content: "" };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantMsg]);
    setInput("");
    const attachmentsToSend = attachments;
    setAttachments([]);
    setStreaming(true);
    setToolStatuses([]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          attachments: attachmentsToSend.map((a) => ({
            name: a.name,
            mediaType: a.mediaType,
            data: a.data,
          })),
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if ((data.type === "text" && data.text) || (!data.type && data.text)) {
              fullText += data.text;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: fullText };
                return updated;
              });
            } else if (data.type === "tool_status") {
              setToolStatuses((prev) => {
                const existing = prev.findIndex((t) => t.tool === data.tool);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = { ...updated[existing], tool: data.tool, status: data.status };
                  return updated;
                }
                return [...prev, { tool: data.tool, status: data.status }];
              });
            }
            if (data.error) {
              fullText += `\n\n${t("chat.errorMsg", { error: data.error })}`;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: fullText };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant" && !last.content)
            updated[updated.length - 1] = { ...last, content: t("chat.connectionError") };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() { abortRef.current?.abort(); }
  function handleClear() {
    if (streaming) handleStop();
    setMessages([]);
    setToolStatuses([]);
    setAttachments([]);
  }

  const hasMessages = messages.length > 0;
  const containerClass =
    layout === "fullscreen"
      ? "-mx-4 sm:-mx-6 md:-mx-8 -mt-6 md:-mt-8 -mb-6 md:-mb-8 flex flex-col"
      : "flex flex-col h-full";
  const containerStyle = layout === "fullscreen" ? { height: "calc(100vh - 3.5rem)" } : undefined;

  return (
    <div className={containerClass} style={containerStyle}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-ocean/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-ivory shrink-0" />
          <span className="text-sm font-medium text-ocean truncate">{resolvedTitle}</span>
          {clientName && <span className="hidden sm:inline text-xs text-ocean/45">· {clientName}</span>}
        </div>
        <AnimatePresence>
          {hasMessages && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleClear}
              className="flex items-center gap-1 text-[11px] text-ocean/30 hover:text-ocean/60 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> {t("chat.clearHistory")}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <div className="h-16 w-16 rounded-2xl bg-ocean/[0.04] flex items-center justify-center mb-5 mx-auto">
                <Sparkles className="h-8 w-8 text-ocean/15" />
              </div>
              <p className="text-lg font-medium text-ocean mb-1">
                {clientName ? t("chat.emptyTitle", { name: clientName }) : t("chat.emptyTitleDefault")}
              </p>
              <p className="text-sm text-ocean/45 max-w-md">
                {emptyStateSubtitle || t("chat.emptySubtitle")}
              </p>
            </motion.div>

            <div className="w-full max-w-2xl">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                onStop={handleStop}
                isStreaming={streaming}
                placeholder={t("chat.placeholder")}
                suggestions={suggestions}
                onSuggestionClick={(s) => setInput(s)}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] break-words ${
                      msg.role === "user"
                        ? "rounded-3xl rounded-br-lg bg-ocean text-white text-sm px-4 sm:px-5 py-3 shadow-sm"
                        : "rounded-3xl rounded-bl-lg bg-white border border-ocean/[0.06] px-4 sm:px-5 py-3 shadow-[0_1px_8px_rgba(32,35,69,0.04)]"
                    }`}
                  >
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {msg.attachments.map((a, i) => (
                          <span
                            key={i}
                            className={`text-[11px] rounded-md px-2 py-1 ${
                              msg.role === "user" ? "bg-white/15 text-white/90" : "bg-ocean/[0.06] text-ocean/70"
                            }`}
                          >
                            📎 {a.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.role === "user" ? (
                      msg.content ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      ) : null
                    ) : msg.content ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      <div className="flex items-center gap-1.5 py-1 px-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-ocean/25"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {toolStatuses.length > 0 && streaming && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="flex flex-col gap-1.5 rounded-2xl bg-ocean/[0.02] border border-ocean/[0.04] px-4 py-3">
                    {toolStatuses.map((ts) => (
                      <div key={ts.tool}>
                        <motion.div
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 text-xs text-ocean/50"
                        >
                          {ts.status === "running" ? (
                            <Loader2 className="h-3 w-3 animate-spin text-blush-dark" />
                          ) : (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <Check className="h-3 w-3 text-green-500" />
                            </motion.div>
                          )}
                          <span>{TOOL_LABELS[ts.tool] || ts.tool}</span>
                        </motion.div>
                        {ts.subSteps && ts.subSteps.length > 0 && (
                          <div className="ml-5 mt-1 flex flex-col gap-1">
                            {ts.subSteps.map((sub, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-1.5 text-[11px] text-ocean/35"
                              >
                                <div className="h-1 w-1 rounded-full bg-ocean/20" />
                                <span>{sub}</span>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {hasMessages && (
        <div className="shrink-0 px-4 sm:px-6 pt-3 pb-4 sm:pb-6 bg-gradient-to-t from-white via-white to-white/80">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              onStop={handleStop}
              isStreaming={streaming}
              placeholder={t("chat.placeholderChat")}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </div>
        </div>
      )}
    </div>
  );
}
