"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePortalClient } from "../use-portal-client";
import { ChatInput } from "@/components/ui/chat-input";

interface Message {
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
  save_idea: "Speichere Idee",
  update_profile: "Aktualisiere Profil",
};

const SUGGESTIONS = [
  "Schreib mir ein Skript",
  "Was sagt mein Audit?",
  "Welche Hooks performen gut?",
  "Was machen meine Konkurrenten?",
];

export default function PortalChat() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, toolStatuses]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming || !effectiveClientId) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setToolStatuses([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Fehler");
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.message) {
          setMessages([...newMessages, { role: "assistant", content: data.message }]);
        }
        return;
      }

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

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

            if (data.type === "text" && data.text) {
              assistantText += data.text;
              setMessages([...newMessages, { role: "assistant", content: assistantText }]);
            } else if (data.type === "tool_status") {
              setToolStatuses(prev => {
                const existing = prev.findIndex(t => t.tool === data.tool);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = { tool: data.tool, status: data.status };
                  return updated;
                }
                return [...prev, { tool: data.tool, status: data.status }];
              });
            } else if (data.type === "error") {
              assistantText += `\n\nFehler: ${data.error}`;
              setMessages([...newMessages, { role: "assistant", content: assistantText }]);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler";
      setMessages([...newMessages, { role: "assistant", content: `Fehler: ${msg}` }]);
    } finally {
      setStreaming(false);
    }
  };

  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <div className="h-14 w-14 rounded-2xl bg-ocean/[0.04] flex items-center justify-center mb-4 mx-auto">
                <MessageSquare className="h-7 w-7 text-ocean/15" />
              </div>
              <p className="text-lg font-medium text-ocean mb-1">Content Agent</p>
              <p className="text-sm text-ocean/45 max-w-sm">
                Frag mich alles zu deinem Content, lass Skripte generieren oder check deine Performance.
              </p>
            </motion.div>

            <div className="w-full max-w-xl">
              <ChatInput
                value={input}
                onChange={setInput}
                onSubmit={handleSend}
                isStreaming={streaming}
                placeholder="Stell deine Frage..."
                suggestions={SUGGESTIONS}
                onSuggestionClick={(s) => setInput(s)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5 pb-4 px-1">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={`${msg.role}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "rounded-3xl rounded-br-lg bg-ocean text-white px-5 py-3 shadow-sm"
                      : "rounded-3xl rounded-bl-lg bg-white border border-ocean/[0.06] text-ocean px-5 py-3 shadow-[0_1px_8px_rgba(32,35,69,0.04)]"
                  }`}>
                    {msg.content || (streaming && i === messages.length - 1 ? (
                      <div className="flex items-center gap-1.5 py-1">
                        {[0, 1, 2].map(j => (
                          <motion.div
                            key={j}
                            className="h-1.5 w-1.5 rounded-full bg-ocean/25"
                            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: j * 0.2 }}
                          />
                        ))}
                      </div>
                    ) : "")}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Tool statuses */}
            <AnimatePresence>
              {toolStatuses.length > 0 && streaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
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

      {/* Input - only when messages exist */}
      {hasMessages && (
        <div className="shrink-0 pt-3">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            isStreaming={streaming}
            placeholder="Deine Frage..."
          />
        </div>
      )}
    </div>
  );
}
