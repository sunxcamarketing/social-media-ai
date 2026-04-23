"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Wand2, User as UserIcon, Sparkles } from "lucide-react";

export interface CarouselChatMessage {
  role: "user" | "assistant";
  text: string;
  update?: { summary: string; tsxChars: number };
  createdAt: string;
}

interface Props {
  runId: string;
  /** Called when Claude returned a new TSX — parent re-renders the preview. */
  onTsxUpdate: (tsx: string) => void;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

export function CarouselChat({ runId, onTsxUpdate }: Props) {
  const [messages, setMessages] = useState<CarouselChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Initial load from DB — so tab-switching during a generation doesn't lose context.
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoadingInitial(true);
    fetch(`/api/carousel/${runId}/chat`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data?.chat_messages)) setMessages(data.chat_messages);
        if (data?.chat_status === "generating") setStatus("generating");
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingInitial(false); });
    return () => { cancelled = true; };
  }, [runId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Poll while generating — catches updates from requests that kicked off in a
  // previous tab session. Stops once status flips back to idle/error.
  useEffect(() => {
    if (status !== "generating") return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch(`/api/carousel/${runId}/chat`);
        const data = await r.json();
        if (Array.isArray(data?.chat_messages)) setMessages(data.chat_messages);
        if (data?.chat_status !== "generating") {
          setStatus(data.chat_status === "error" ? "error" : "idle");
          if (typeof data?.tsx_code === "string") onTsxUpdate(data.tsx_code);
        }
      } catch { /* ignore transient errors */ }
    }, 2500);
    return () => clearInterval(iv);
  }, [status, runId, onTsxUpdate]);

  async function send() {
    const text = input.trim();
    if (!text || status === "generating") return;

    // Optimistic UI
    const optimistic: CarouselChatMessage = { role: "user", text, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    setInput("");
    setStatus("generating");

    try {
      const res = await fetch(`/api/carousel/${runId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Fehler" }));
        setStatus("error");
        // Put an error message into the stream so the user knows
        setMessages(prev => [...prev, {
          role: "assistant",
          text: `⚠️ ${err.error || "Anfrage fehlgeschlagen"}`,
          createdAt: new Date().toISOString(),
        }]);
        return;
      }

      const data = await res.json();
      if (data.message) {
        setMessages(prev => [...prev, data.message as CarouselChatMessage]);
      }
      if (typeof data.tsxCode === "string" && data.message?.update) {
        onTsxUpdate(data.tsxCode);
      }
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `⚠️ Netzwerkfehler: ${e instanceof Error ? e.message : "unbekannt"}`,
        createdAt: new Date().toISOString(),
      }]);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-ocean/10 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-ocean/[0.06] flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-blush-dark" />
        <div className="text-sm font-medium text-ocean">Refine</div>
        <div className="ml-auto text-[11px] text-ocean/50">
          {status === "generating" ? "Claude arbeitet…" : "Schreib was du ändern willst"}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[200px]">
        {loadingInitial ? (
          <p className="text-sm text-ocean/40">Historie wird geladen…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-ocean/50">
            Das Karussell ist fertig. Wenn du was ändern willst — Slide kürzer, anderer CTA, bestimmte Farbe, anderer Winkel —
            schreib es unten rein. Claude kann auch Rückfragen stellen wenn was unklar ist.
          </p>
        ) : (
          messages.map((m, i) => <ChatBubble key={i} message={m} />)
        )}
        {status === "generating" && (
          <div className="flex items-center gap-2 text-xs text-ocean/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Claude überlegt…</span>
          </div>
        )}
      </div>

      <div className="border-t border-ocean/[0.06] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="z.B. 'Slide 3 kürzer und Hook aggressiver'"
            rows={2}
            disabled={status === "generating"}
            className="flex-1 resize-none rounded-lg border border-ocean/10 bg-warm-white px-3 py-2 text-sm text-ocean focus:outline-none focus:border-blush disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || status === "generating"}
            className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-ocean text-white hover:bg-ocean-light disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Senden"
          >
            {status === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: CarouselChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="shrink-0 h-6 w-6 rounded-full bg-blush-light/60 flex items-center justify-center">
          {message.update ? <Wand2 className="h-3 w-3 text-blush-dark" /> : <Sparkles className="h-3 w-3 text-blush-dark" />}
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
          isUser
            ? "bg-ocean text-white"
            : message.update
              ? "bg-green-50 border border-green-200 text-ocean"
              : "bg-ocean/[0.04] text-ocean"
        }`}
      >
        {message.update && (
          <p className="text-[10px] font-medium text-green-700 uppercase tracking-wider mb-1">
            Karussell aktualisiert
          </p>
        )}
        <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        <p className={`text-[10px] mt-1 ${isUser ? "text-white/50" : "text-ocean/40"}`}>{fmtTime(message.createdAt)}</p>
      </div>
      {isUser && (
        <div className="shrink-0 h-6 w-6 rounded-full bg-ocean/[0.06] flex items-center justify-center">
          <UserIcon className="h-3 w-3 text-ocean/60" />
        </div>
      )}
    </div>
  );
}
