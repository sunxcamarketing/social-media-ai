"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2, Check } from "lucide-react";
import { usePortalClient } from "../use-portal-client";

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
};

export default function PortalChat() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

      // Check if it's a simple JSON response (opening message)
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
        // Keep the last potentially incomplete line in the buffer
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
            } else if (data.type === "done") {
              // Stream complete
            } else if (data.type === "error") {
              assistantText += `\n\nFehler: ${data.error}`;
              setMessages([...newMessages, { role: "assistant", content: assistantText }]);
            }
          } catch {
            // Skip malformed SSE lines -- partial chunks are expected during streaming
          }
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

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="mb-4">
        <h1 className="text-xl font-light text-ocean flex items-center gap-2">
          <MessageSquare className="h-5 w-5" /> Content Agent
        </h1>
        <p className="text-xs text-ocean/50 mt-1">Frag mich alles zu deinem Content, lass Skripte generieren oder check deine Performance</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-ocean/30 text-sm">Stell deine erste Frage...</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {[
                "Schreib mir ein Skript",
                "Was sagt mein Audit?",
                "Welche Hooks performen gut?",
                "Was machen meine Konkurrenten?",
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border border-ocean/10 text-ocean/50 hover:text-ocean hover:border-ocean/20 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-ocean text-white"
                : "glass text-ocean"
            }`}>
              {msg.content || (streaming && i === messages.length - 1 ? "..." : "")}
            </div>
          </div>
        ))}

        {/* Tool statuses */}
        {toolStatuses.length > 0 && streaming && (
          <div className="flex justify-start">
            <div className="flex flex-col gap-1.5 px-4 py-2">
              {toolStatuses.map((ts) => (
                <div key={ts.tool} className="flex items-center gap-2 text-xs text-ocean/50">
                  {ts.status === "running" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-ocean/40" />
                  ) : (
                    <Check className="h-3 w-3 text-green-500" />
                  )}
                  <span>{TOOL_LABELS[ts.tool] || ts.tool}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t border-ocean/[0.06]">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Deine Frage..."
          rows={1}
          className="flex-1 rounded-xl border border-ocean/10 bg-warm-white px-4 py-3 text-sm text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors resize-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          className="rounded-xl bg-ocean px-4 py-3 text-white hover:bg-ocean-light transition-colors disabled:opacity-40 self-end"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
