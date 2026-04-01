"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Sparkles,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { MarkdownContent } from "@/components/markdown-content";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let msgCounter = 0;
function msgId() { return `msg-${Date.now()}-${++msgCounter}`; }

// ── Main Page (Chat Only) ────────────────────────────────────────────────────

export default function DashboardPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { id: msgId(), role: "user", content: text };
    const assistantMsg: ChatMessage = { id: msgId(), role: "assistant", content: "" };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, assistantMsg]);
    setInput("");
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
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
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: fullText };
                return updated;
              });
            }
            if (data.error) {
              fullText += `\n\n*Fehler: ${data.error}*`;
              setMessages(prev => {
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
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant" && !last.content) updated[updated.length - 1] = { ...last, content: "*Verbindungsfehler. Bitte nochmal versuchen.*" };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleStop() { abortRef.current?.abort(); }
  function handleClear() { if (streaming) handleStop(); setMessages([]); }
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="-mx-6 -mt-8 -mb-8 flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-ocean/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ivory" />
          <span className="text-sm font-medium text-ocean">SUNXCA Assistent</span>
        </div>
        {hasMessages && (
          <button onClick={handleClear} className="flex items-center gap-1 text-[11px] text-ocean/30 hover:text-ocean/60 transition-colors">
            <Trash2 className="h-3 w-3" /> Chat leeren
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-14 w-14 rounded-2xl bg-ocean/[0.04] flex items-center justify-center mb-5">
              <Sparkles className="h-7 w-7 text-ocean/15" />
            </div>
            <p className="text-base font-medium text-ocean mb-1">Wie kann ich dir helfen?</p>
            <p className="text-sm text-ocean/50 max-w-md mb-6">
              Ich habe Zugriff auf alle Clients, Strategien, Skripte, Audits und Performance-Daten.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                "Zeig mir eine Zusammenfassung aller Clients",
                "Welche Hooks performen am besten?",
                "Schreib mir 3 Hook-Ideen für Elliott",
                "Was sagt der Audit über die Performance?",
                "Erstelle einen Wochenplan für nächste Woche",
              ].map(s => (
                <button key={s} onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="rounded-xl border border-ocean/[0.06] bg-ocean/[0.02] px-3 py-2 text-xs text-ocean/50 hover:text-ocean hover:border-ocean/[0.12] hover:bg-ocean/[0.04] transition-all"
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {hasMessages && (
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-ocean text-white text-sm"
                    : "glass border border-ocean/[0.06]"
                }`}>
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.content ? (
                    <MarkdownContent content={msg.content} />
                  ) : (
                    <div className="flex items-center gap-2 py-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-ocean/30 animate-pulse" />
                      <div className="h-1.5 w-1.5 rounded-full bg-ocean/30 animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-ocean/30 animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-ocean/[0.06] px-6 py-4 bg-white">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Nachricht schreiben..." disabled={streaming} rows={1}
            className="flex-1 resize-none rounded-xl border border-ocean/[0.08] bg-warm-white px-4 py-2.5 text-sm text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush disabled:opacity-50 transition-colors"
          />
          {streaming ? (
            <button onClick={handleStop} className="shrink-0 h-10 w-10 rounded-xl bg-ocean/10 hover:bg-ocean/20 flex items-center justify-center transition-colors">
              <Square className="h-4 w-4 text-ocean fill-ocean" />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()}
              className="shrink-0 h-10 w-10 rounded-xl bg-ocean hover:bg-ocean-light disabled:opacity-30 flex items-center justify-center transition-colors"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
