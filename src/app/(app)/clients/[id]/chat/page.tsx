"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Trash2, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { MarkdownContent } from "@/components/markdown-content";
import { ChatInput } from "@/components/ui/chat-input";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ToolStatus {
  tool: string;
  status: "running" | "done";
}

const TOOL_LABELS: Record<string, string> = {
  load_client_context: "Lade Client-Profil",
  load_voice_profile: "Lade Voice Profile",
  search_scripts: "Suche Skripte",
  check_performance: "Prüfe Performance",
  load_audit: "Lade Audit",
  generate_script: "Generiere Skript",
  check_competitors: "Analysiere Wettbewerber",
  check_learnings: "Lade Learnings",
  search_web: "Web-Recherche",
  research_trends: "Trend-Research",
  save_idea: "Speichere Idee",
  update_profile: "Aktualisiere Profil",
};

let msgCounter = 0;
function msgId() { return `msg-${Date.now()}-${++msgCounter}`; }

export default function ClientChatPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const [clientName, setClientName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/configs/${clientId}`)
      .then((r) => r.json())
      .then((cfg) => setClientName(cfg.configName || cfg.name || ""))
      .catch(() => {});
  }, [clientId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, toolStatuses, scrollToBottom]);

  const suggestions = clientName
    ? [
        `Schreib ein Skript für ${clientName}`,
        `Was sagt ${clientName}s Audit?`,
        `Welche Hooks performen bei ${clientName}?`,
        `Was machen die Konkurrenten?`,
      ]
    : ["Schreib ein Skript", "Was sagt das Audit?", "Welche Hooks performen?"];

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming || !clientId) return;

    const userMsg: ChatMessage = { id: msgId(), role: "user", content: text };
    const assistantMsg: ChatMessage = { id: msgId(), role: "assistant", content: "" };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantMsg]);
    setInput("");
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
                  updated[existing] = { tool: data.tool, status: data.status };
                  return updated;
                }
                return [...prev, { tool: data.tool, status: data.status }];
              });
            }
            if (data.error) {
              fullText += `\n\n*Fehler: ${data.error}*`;
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
            updated[updated.length - 1] = { ...last, content: "*Verbindungsfehler. Bitte nochmal versuchen.*" };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() { abortRef.current?.abort(); }
  function handleClear() { if (streaming) handleStop(); setMessages([]); setToolStatuses([]); }

  const hasMessages = messages.length > 0;

  return (
    <div className="-mx-6 -mt-8 -mb-8 flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      <div className="flex items-center justify-between px-6 py-3 border-b border-ocean/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ivory" />
          <span className="text-sm font-medium text-ocean">Content Agent</span>
          {clientName && <span className="text-xs text-ocean/45">· {clientName}</span>}
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
              <Trash2 className="h-3 w-3" /> Chat leeren
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
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
                {clientName ? `Chat über ${clientName}` : "Wie kann ich dir helfen?"}
              </p>
              <p className="text-sm text-ocean/45 max-w-md">
                Der Content Agent hat Zugriff auf Kontext, Audit, Performance & Skripte — alles über diesen Client.
              </p>
            </motion.div>

            <div className="w-full max-w-2xl">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                onStop={handleStop}
                isStreaming={streaming}
                placeholder="Frag mich etwas über diesen Client..."
                suggestions={suggestions}
                onSuggestionClick={(s) => setInput(s)}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
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
                    className={`max-w-[85%] ${
                      msg.role === "user"
                        ? "rounded-3xl rounded-br-lg bg-ocean text-white text-sm px-5 py-3 shadow-sm"
                        : "rounded-3xl rounded-bl-lg bg-white border border-ocean/[0.06] px-5 py-3 shadow-[0_1px_8px_rgba(32,35,69,0.04)]"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
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
                      <motion.div
                        key={ts.tool}
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
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {hasMessages && (
        <div className="shrink-0 px-6 pt-3 pb-6 bg-gradient-to-t from-white via-white to-white/80">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              onStop={handleStop}
              isStreaming={streaming}
              placeholder="Nachricht schreiben..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
