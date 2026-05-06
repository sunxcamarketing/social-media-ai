"use client";

import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import {
  Send,
  Loader2,
  Wand2,
  User as UserIcon,
  Sparkles,
  Paperclip,
  X,
  Trash2,
} from "lucide-react";

export interface CarouselChatMessage {
  role: "user" | "assistant";
  text: string;
  update?: { summary: string; tsxChars: number };
  /** Public URLs of photos attached to this message (user) or referenced in the slide (assistant). */
  imageUrls?: string[];
  createdAt: string;
}

interface Props {
  runId: string;
  clientId: string;
  /** Called when Claude returned a new TSX — parent re-renders the preview. */
  onTsxUpdate: (tsx: string) => void;
}

interface PendingPhoto {
  /** Local preview URL (object URL). Replaced with public URL after upload. */
  previewUrl: string;
  publicUrl?: string;
  filename: string;
  uploading: boolean;
  error?: string;
}

const MAX_PHOTOS = 6;
// Anthropic's Vision API has a hard 5 MB / image limit; we target well below
// that so a single carousel refine call with multiple photos stays under
// total context budget too. Server cap stays at 20 MB as defence in depth.
const MAX_BYTES = 20 * 1024 * 1024;
const COMPRESS_THRESHOLD_BYTES = 1 * 1024 * 1024; // anything > 1 MB gets re-encoded
const COMPRESS_OPTIONS = {
  maxSizeMB: 3.5,           // hard cap below Anthropic's 5 MB
  maxWidthOrHeight: 1920,    // Instagram shows max ~1080 wide; 1920 is more than enough
  useWebWorker: true,
  fileType: "image/jpeg" as const,
  initialQuality: 0.8,
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

export function CarouselChat({ runId, clientId, onTsxUpdate }: Props) {
  const [messages, setMessages] = useState<CarouselChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial load from DB — so tab-switching during a generation doesn't lose context.
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setLoadingInitial(true);
    fetch(`/api/carousel/${runId}/chat`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.chat_messages)) setMessages(data.chat_messages);
        if (data?.chat_status === "generating") setStatus("generating");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
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
      } catch {
        /* ignore transient errors */
      }
    }, 2500);
    return () => clearInterval(iv);
  }, [status, runId, onTsxUpdate]);

  // Revoke object URLs when photos are removed/cleared
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadPhoto(file: File, slot: number) {
    try {
      // Compress big photos client-side. PNGs from KI-tools / DSLRs are often
      // 8-15 MB which would blow Anthropic's 5 MB Vision-API limit (used by
      // the carousel refine chat). We re-encode to JPEG, cap dimensions, and
      // run a second pass with lower quality if still too big.
      let toUpload = file;
      if (file.type.startsWith("image/") && file.size > COMPRESS_THRESHOLD_BYTES) {
        try {
          toUpload = await imageCompression(file, COMPRESS_OPTIONS);
          // Edge case: browser-image-compression can't always hit the target
          // for very dense images. Second pass at lower quality if still
          // dangerously close to Anthropic's 5 MB cap.
          if (toUpload.size > 4 * 1024 * 1024) {
            toUpload = await imageCompression(toUpload, { ...COMPRESS_OPTIONS, initialQuality: 0.65, maxSizeMB: 2 });
          }
        } catch {
          toUpload = file;
        }
      }

      if (toUpload.size > MAX_BYTES) {
        setPhotos((prev) => {
          const next = [...prev];
          if (next[slot]) next[slot] = {
            ...next[slot],
            uploading: false,
            error: `Foto ist ${(toUpload.size / 1024 / 1024).toFixed(1)} MB, max ${MAX_BYTES / 1024 / 1024} MB`,
          };
          return next;
        });
        return;
      }

      const fd = new FormData();
      fd.append("file", toUpload);
      fd.append("clientId", clientId);
      const res = await fetch("/api/client-photos", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload fehlgeschlagen" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { url: string };
      setPhotos((prev) => {
        const next = [...prev];
        if (next[slot]) next[slot] = { ...next[slot], publicUrl: data.url, uploading: false };
        return next;
      });
    } catch (e) {
      setPhotos((prev) => {
        const next = [...prev];
        if (next[slot]) {
          next[slot] = {
            ...next[slot],
            uploading: false,
            error: e instanceof Error ? e.message : "Upload fehlgeschlagen",
          };
        }
        return next;
      });
    }
  }

  function addFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const accepted = list.slice(0, room);
    setPhotos((prev) => {
      const startIdx = prev.length;
      const next: PendingPhoto[] = [
        ...prev,
        ...accepted.map((f) => ({
          previewUrl: URL.createObjectURL(f),
          filename: f.name,
          uploading: true,
        })),
      ];
      // Fire uploads in parallel — each writes back to its slot by index.
      accepted.forEach((file, i) => uploadPhoto(file, startIdx + i));
      return next;
    });
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function clearChat() {
    if (status === "generating") return;
    if (!confirm("Chat leeren? Das Karussell selbst bleibt unverändert — nur der Gesprächsverlauf wird zurückgesetzt.")) return;
    try {
      const res = await fetch(`/api/carousel/${runId}/chat`, { method: "DELETE" });
      if (!res.ok) {
        alert("Konnte Chat nicht leeren — versuch's gleich nochmal.");
        return;
      }
      setMessages([]);
      setStatus("idle");
    } catch {
      alert("Netzwerk-Fehler beim Chat-Reset.");
    }
  }

  async function send() {
    const text = input.trim();
    const readyUrls = photos.filter((p) => p.publicUrl).map((p) => p.publicUrl!);
    if ((!text && readyUrls.length === 0) || status === "generating") return;
    if (photos.some((p) => p.uploading)) return; // wait for uploads

    // Optimistic UI
    const optimistic: CarouselChatMessage = {
      role: "user",
      text,
      ...(readyUrls.length > 0 ? { imageUrls: readyUrls } : {}),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    // Clear photo previews — they'll be re-rendered from message.imageUrls
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setStatus("generating");

    try {
      const res = await fetch(`/api/carousel/${runId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, imageUrls: readyUrls }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Fehler" }));
        setStatus("error");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `⚠️ ${err.error || "Anfrage fehlgeschlagen"}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message as CarouselChatMessage]);
      }
      if (typeof data.tsxCode === "string" && data.message?.update) {
        onTsxUpdate(data.tsxCode);
      }
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `⚠️ Netzwerkfehler: ${e instanceof Error ? e.message : "unbekannt"}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  const uploading = photos.some((p) => p.uploading);
  const canSend =
    !uploading && status !== "generating" && (input.trim().length > 0 || photos.some((p) => p.publicUrl));

  return (
    <div
      className="flex flex-col h-full min-h-0 bg-white"
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {/* Top bar — only when there's history to clear. Lets the user reset the
          conversation without losing the carousel design. */}
      {messages.length > 0 && (
        <div className="flex items-center justify-end px-4 py-2 border-b border-ocean/[0.06] shrink-0">
          <button
            type="button"
            onClick={clearChat}
            disabled={status === "generating"}
            className="inline-flex items-center gap-1.5 text-[11px] text-ocean/50 hover:text-blush-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Chat-Verlauf leeren — Karussell bleibt unverändert"
          >
            <Trash2 className="h-3 w-3" />
            Chat leeren
          </button>
        </div>
      )}

      <div
        ref={listRef}
        className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 transition-colors ${
          dragOver ? "bg-blush-light/30 outline-dashed outline-2 outline-blush/40 -outline-offset-4" : ""
        }`}
      >
        {loadingInitial ? (
          <p className="text-sm text-ocean/40">Historie wird geladen…</p>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl bg-ocean/[0.03] border border-ocean/[0.06] px-4 py-3 text-sm text-ocean/70 leading-relaxed">
            Karussell ist fertig. Schreib was du ändern willst — Slide kürzer, anderer CTA,
            andere Farbe — oder zieh ein Foto rein, das in einem Slide auftauchen soll.
          </div>
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

      <div className="border-t border-ocean/[0.06] p-3 shrink-0">
        {/* Pending photo thumbnails */}
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {photos.map((p, i) => (
              <div
                key={i}
                className="relative h-14 w-14 rounded-lg overflow-hidden border border-ocean/10 bg-warm-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.previewUrl}
                  alt={p.filename}
                  className="h-full w-full object-cover"
                />
                {p.uploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  </div>
                )}
                {p.error && (
                  <div
                    className="absolute inset-0 bg-red-500/70 flex items-center justify-center text-[9px] text-white text-center px-1 leading-tight"
                    title={p.error}
                  >
                    Fehler
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-ocean text-white flex items-center justify-center hover:bg-ocean-light"
                  aria-label="Foto entfernen"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Inline error banner — shows the first photo's error message in full
            so the user knows why upload failed (instead of just hover-tooltip). */}
        {photos.find((p) => p.error) && (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 leading-snug break-words">
            {photos.find((p) => p.error)?.error}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={status === "generating" || photos.length >= MAX_PHOTOS}
            className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg border border-ocean/10 text-ocean/60 hover:text-ocean hover:bg-ocean/[0.04] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Foto hochladen"
            aria-label="Foto hochladen"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="z.B. 'Slide 3 kürzer und Hook aggressiver' oder zieh ein Foto rein"
            rows={2}
            disabled={status === "generating"}
            className="flex-1 resize-none rounded-lg border border-ocean/10 bg-warm-white px-3 py-2 text-sm text-ocean focus:outline-none focus:border-blush disabled:opacity-60"
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-ocean text-white hover:bg-ocean-light disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Senden"
          >
            {status === "generating" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        {uploading && (
          <p className="text-[10px] text-ocean/45 mt-1.5">Fotos werden hochgeladen…</p>
        )}
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
          {message.update ? (
            <Wand2 className="h-3 w-3 text-blush-dark" />
          ) : (
            <Sparkles className="h-3 w-3 text-blush-dark" />
          )}
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm space-y-2 ${
          isUser
            ? "bg-ocean text-white"
            : message.update
            ? "bg-green-50 border border-green-200 text-ocean"
            : "bg-ocean/[0.04] text-ocean"
        }`}
      >
        {message.update && (
          <p className="text-[10px] font-medium text-green-700 uppercase tracking-wider">
            Karussell aktualisiert
          </p>
        )}
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.imageUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Foto ${i + 1}`}
                className={`h-16 w-16 rounded-md object-cover border ${
                  isUser ? "border-white/20" : "border-ocean/10"
                }`}
              />
            ))}
          </div>
        )}
        {message.text && (
          <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
        )}
        <p className={`text-[10px] ${isUser ? "text-white/50" : "text-ocean/40"}`}>
          {fmtTime(message.createdAt)}
        </p>
      </div>
      {isUser && (
        <div className="shrink-0 h-6 w-6 rounded-full bg-ocean/[0.06] flex items-center justify-center">
          <UserIcon className="h-3 w-3 text-ocean/60" />
        </div>
      )}
    </div>
  );
}
