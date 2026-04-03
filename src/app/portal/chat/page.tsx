"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { usePortalClient } from "../use-portal-client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function PortalChat() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          clientId: effectiveClientId,
        }),
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              assistantText += data.text;
              setMessages([...newMessages, { role: "assistant", content: assistantText }]);
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Fehler beim Laden der Antwort." }]);
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
          <MessageSquare className="h-5 w-5" /> Chat
        </h1>
        <p className="text-xs text-ocean/50 mt-1">Frag mich alles zu deinem Content</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-ocean/30 text-sm">
            Stell deine erste Frage...
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-ocean text-white"
                : "glass text-ocean"
            }`}>
              {msg.content || (streaming && i === messages.length - 1 ? "..." : "")}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-4 border-t border-ocean/[0.06]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Deine Frage..."
          className="flex-1 rounded-xl border border-ocean/10 bg-warm-white px-4 py-3 text-sm text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          className="rounded-xl bg-ocean px-4 py-3 text-white hover:bg-ocean-light transition-colors disabled:opacity-40"
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
