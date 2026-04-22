"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { supabaseBrowser } from "@/lib/supabase-browser";

const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || "ws://localhost:4001";

export type GeminiLiveState = "idle" | "connecting" | "preparing" | "active" | "ending";

export interface TranscriptEntry {
  role: "user" | "model";
  text: string;
}

export interface GeminiLiveMessage {
  type: string;
  [key: string]: unknown;
}

export interface StartOptions {
  /** Query string params sent on the WS URL, e.g. `{ mode: "voice-profile", step: "scenario1" }`. `token` is added automatically. */
  params: Record<string, string>;
}

export interface GeminiLiveSocket {
  state: GeminiLiveState;
  transcript: TranscriptEntry[];
  agentSpeaking: boolean;
  audioLevel: number;
  isRecording: boolean;
  error: string | null;
  /** Opens the WS, starts audio playback pipeline. Mic turns on when the server emits `speaking`. */
  start: (opts: StartOptions) => Promise<void>;
  /** Sends `{ type: "end" }` and closes cleanly. */
  stop: () => void;
  /** Manually resets transcript/state between steps. */
  reset: () => void;
}

interface UseGeminiLiveSocketOptions {
  /**
   * Called for every message received that isn't one of the built-in types
   * (ready, speaking, audio, transcript, interrupted, error). The component
   * uses this to handle mode-specific events like `voice_profile_summary`,
   * `onboarding_summary`, etc.
   */
  onMessage?: (msg: GeminiLiveMessage) => void;
  /**
   * Called when the session transitions to "active" (agent started speaking
   * OR server signalled passive-listen mode is ready). Useful to start timers.
   */
  onActive?: () => void;
  /**
   * Called when the session is closed (user stop, server disconnect, or error).
   * The final `transcript` is passed back so the caller can persist it.
   */
  onClosed?: (finalTranscript: TranscriptEntry[]) => void;
}

/**
 * Shared transport for the Gemini Live voice pipeline. Handles:
 *   - WebSocket connect (with Supabase auth)
 *   - Audio playback (24kHz PCM from Gemini)
 *   - Mic capture (via useAudioCapture) streamed back as 16kHz PCM
 *   - Transcript stitching (consecutive same-role fragments merged)
 *   - Built-in events: ready → preparing, speaking → active + mic on,
 *     audio → play, transcript → append, interrupted → flush queue,
 *     error → set error + reset state
 *
 * Mode-specific events (summaries, block progress, tool status, …) are
 * forwarded via `onMessage`. State management for those lives in the component.
 */
export function useGeminiLiveSocket(options: UseGeminiLiveSocketOptions = {}): GeminiLiveSocket {
  const { onMessage, onActive, onClosed } = options;

  const [state, setState] = useState<GeminiLiveState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const playbackQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  transcriptRef.current = transcript;

  const playAudio = useCallback((base64: string) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 0x8000;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;
    playbackQueueRef.current.push(source);
    source.onended = () => {
      playbackQueueRef.current = playbackQueueRef.current.filter((n) => n !== source);
      if (playbackQueueRef.current.length === 0) setAgentSpeaking(false);
    };
    setAgentSpeaking(true);
  }, []);

  const flushAudio = useCallback(() => {
    for (const src of playbackQueueRef.current) {
      try { src.stop(); } catch {}
    }
    playbackQueueRef.current = [];
    nextStartTimeRef.current = audioContextRef.current?.currentTime || 0;
    setAgentSpeaking(false);
  }, []);

  const sendAudioChunk = useCallback((pcmBase64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "audio", data: pcmBase64 }));
    }
  }, []);

  const {
    isRecording,
    audioLevel,
    start: startCapture,
    stop: stopCapture,
  } = useAudioCapture({ onAudioChunk: sendAudioChunk });

  const reset = useCallback(() => {
    setTranscript([]);
    setError(null);
    setState("idle");
    setAgentSpeaking(false);
  }, []);

  const start = useCallback(async ({ params }: StartOptions) => {
    setError(null);
    setTranscript([]);
    setState("connecting");

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) {
        setError("Nicht eingeloggt");
        setState("idle");
        return;
      }

      const urlParams = new URLSearchParams({ token: session.access_token, ...params });
      const ws = new WebSocket(`${VOICE_SERVER_URL}?${urlParams.toString()}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        let msg: GeminiLiveMessage;
        try { msg = JSON.parse(event.data); } catch { return; }

        switch (msg.type) {
          case "ready":
            setState("preparing");
            break;
          case "speaking":
            setState("active");
            startCapture();
            onActive?.();
            break;
          case "audio":
            if (typeof msg.data === "string") playAudio(msg.data);
            break;
          case "transcript":
            if ((msg.role === "user" || msg.role === "model") && typeof msg.text === "string") {
              const role = msg.role;
              const text = msg.text;
              setTranscript((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === role) {
                  return [...prev.slice(0, -1), { ...last, text: last.text + " " + text }];
                }
                return [...prev, { role, text }];
              });
            }
            break;
          case "interrupted":
            flushAudio();
            break;
          case "error":
            setError(typeof msg.message === "string" ? msg.message : "Unbekannter Fehler");
            setState("idle");
            break;
          default:
            onMessage?.(msg);
        }
      };

      ws.onclose = () => {
        stopCapture();
        flushAudio();
        if (wsRef.current === ws) wsRef.current = null;
        onClosed?.(transcriptRef.current);
        setState("idle");
      };

      ws.onerror = () => {
        setError("Verbindungsfehler. Bitte erneut versuchen.");
        setState("idle");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Start");
      setState("idle");
    }
  }, [flushAudio, onActive, onClosed, onMessage, playAudio, startCapture, stopCapture]);

  const stop = useCallback(() => {
    setState("ending");
    stopCapture();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end" }));
    }
  }, [stopCapture]);

  // Cleanup on unmount — flush playback, close socket.
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      stopCapture();
      for (const src of playbackQueueRef.current) {
        try { src.stop(); } catch {}
      }
    };
  }, [stopCapture]);

  return { state, transcript, agentSpeaking, audioLevel, isRecording, error, start, stop, reset };
}
