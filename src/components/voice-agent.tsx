"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, User, Phone, PhoneOff, Loader2, Check, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { supabaseBrowser } from "@/lib/supabase-browser";

type SessionState = "idle" | "connecting" | "preparing" | "active" | "ending" | "summary";

interface TranscriptEntry {
  role: "user" | "model";
  text: string;
}

interface IdeaResult {
  title: string;
  description: string;
  contentType: string;
}

interface SessionSummary {
  ideas: IdeaResult[];
  durationSeconds: number;
  transcriptLength: number;
}

const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || "ws://localhost:4001";

interface VoiceAgentProps {
  /** If set, passed as clientId query param (admin view). If omitted, the
   *  voice-server resolves the clientId from the authenticated Supabase user. */
  clientIdOverride?: string;
}

export function VoiceAgent({ clientIdOverride }: VoiceAgentProps) {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackQueueRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const agentSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    if (sessionState !== "active" && sessionState !== "ending") {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionState]);

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const flushAudio = useCallback(() => {
    for (const node of playbackQueueRef.current) {
      try { node.stop(); node.disconnect(); } catch { /* ignore */ }
    }
    playbackQueueRef.current = [];
    nextStartTimeRef.current = 0;
  }, []);

  const playAudio = useCallback((base64Data: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") ctx.resume();

    setAgentSpeaking(true);
    if (agentSilenceTimerRef.current) clearTimeout(agentSilenceTimerRef.current);
    agentSilenceTimerRef.current = setTimeout(() => setAgentSpeaking(false), 400);

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

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
    };
  }, []);

  const handleAudioChunk = useCallback((pcmBase64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "audio", data: pcmBase64 }));
    }
  }, []);

  const { isRecording, audioLevel, start: startCapture, stop: stopCapture } = useAudioCapture({
    onAudioChunk: handleAudioChunk,
  });

  const startSession = async () => {
    setError(null);
    setTranscript([]);
    setSummary(null);
    setSessionState("connecting");

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) throw new Error("Nicht eingeloggt");

      const params = new URLSearchParams({ token: session.access_token });
      if (clientIdOverride) params.set("clientId", clientIdOverride);
      const ws = new WebSocket(`${VOICE_SERVER_URL}?${params.toString()}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "ready":
              // WS + Gemini up. Agent processes greeting — don't start mic
              // yet (background noise would interrupt the agent's first turn).
              setSessionState("preparing");
              break;
            case "speaking":
              // First audio chunk arriving — flip to active and enable mic.
              setSessionState("active");
              startCapture();
              break;
            case "audio":
              playAudio(msg.data);
              break;
            case "transcript":
              setTranscript((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === msg.role) {
                  return [...prev.slice(0, -1), { ...last, text: last.text + " " + msg.text }];
                }
                return [...prev, { role: msg.role, text: msg.text }];
              });
              break;
            case "summary":
              setSummary(msg);
              setSessionState("summary");
              break;
            case "interrupted":
              flushAudio();
              break;
            case "error":
              setError(msg.message);
              break;
          }
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = (event) => {
        if (sessionState === "active" || sessionState === "connecting" || sessionState === "preparing") {
          if (event.code === 4003) setError("Nicht autorisiert");
          else if (event.code === 4005) setError("Verbindung zum Voice-Server fehlgeschlagen");
          if (!summary) setSessionState("idle");
        }
        stopCapture();
      };

      ws.onerror = () => {
        setError("Verbindung zum Voice Server fehlgeschlagen. Läuft der Server? (npm run voice-server)");
        setSessionState("idle");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Starten");
      setSessionState("idle");
    }
  };

  const endSession = () => {
    setSessionState("ending");
    stopCapture();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end" }));
    }
  };

  const resetSession = () => {
    setSessionState("idle");
    setTranscript([]);
    setSummary(null);
    setError(null);
    wsRef.current = null;
    flushAudio();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const isActive = sessionState === "active" || sessionState === "ending";
  const isLoading = sessionState === "connecting" || sessionState === "preparing";
  const statusLabel =
    sessionState === "idle" ? "Bereit"
    : sessionState === "connecting" ? "Verbinde..."
    : sessionState === "preparing" ? "Lade Kontext..."
    : sessionState === "ending" ? "Wird beendet..."
    : sessionState === "summary" ? "Beendet"
    : "Verbunden";
  const statusDotClass =
    sessionState === "idle" ? "bg-ocean/30"
    : isLoading ? "bg-amber-400 animate-pulse"
    : sessionState === "active" ? "bg-green-500 animate-pulse"
    : "bg-ocean/30";

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {sessionState !== "summary" && (
        <>
          <div className="shrink-0 flex items-center justify-between pb-4 border-b border-ocean/[0.06]">
            <div className="flex items-center gap-2 text-xs text-ocean/55">
              <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
              <span className="font-medium">{statusLabel}</span>
            </div>
            <div className="text-xs font-mono tabular-nums text-ocean/40">
              {isActive ? formatTime(elapsedSeconds) : "--:--"}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mb-10">
              <ParticipantCard
                name="Du"
                role="Client"
                icon={<User className="h-7 w-7 text-ocean/40" />}
                level={isRecording ? audioLevel : 0}
                speaking={isRecording && audioLevel > 0.08}
                active={isActive}
              />
              <ParticipantCard
                name="SUNXCA Agent"
                role="KI-Interviewer"
                icon={<Mic className="h-7 w-7 text-ocean" />}
                level={agentSpeaking ? 0.6 : 0}
                speaking={agentSpeaking}
                active={isActive}
                primary
              />
            </div>

            {sessionState === "idle" && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={startSession}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-ocean text-white font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 btn-press"
              >
                <Phone className="h-5 w-5" />
                Interview starten
              </motion.button>
            )}

            {isLoading && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-ocean/50 text-white font-medium">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {sessionState === "connecting" ? "Verbinde mit Agent..." : "Lade deinen Kontext..."}
                </div>
                <p className="text-xs text-ocean/45 max-w-sm text-center leading-relaxed">
                  {sessionState === "connecting"
                    ? "Session wird aufgebaut."
                    : "Client-Profil, Audit, Performance werden vorgeladen. Der Agent begrüßt dich gleich."}
                </p>
              </div>
            )}

            {isActive && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={endSession}
                disabled={sessionState === "ending"}
                className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-red-500 text-white font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 btn-press disabled:opacity-60"
              >
                {sessionState === "ending" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <PhoneOff className="h-5 w-5" />
                )}
                {sessionState === "ending" ? "Wird zusammengefasst..." : "Interview beenden"}
              </motion.button>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-5 text-sm text-red-500/80 max-w-sm text-center"
              >
                {error}
              </motion.p>
            )}
          </div>

          {isActive && (
            <div ref={scrollRef} className="shrink-0 max-h-48 overflow-y-auto border-t border-ocean/[0.06] pt-4">
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {transcript.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-start gap-2 text-xs leading-relaxed"
                    >
                      <span className={`shrink-0 font-medium ${entry.role === "user" ? "text-ocean" : "text-blush-dark"}`}>
                        {entry.role === "user" ? "Du:" : "Agent:"}
                      </span>
                      <span className="text-ocean/70">{entry.text}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </>
      )}

      {sessionState === "summary" && summary && (
        <div className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-8">
              <div className="h-12 w-12 rounded-2xl bg-green-500/10 flex items-center justify-center mb-3 mx-auto">
                <Check className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-lg font-medium text-ocean mb-1">Session abgeschlossen</p>
              <p className="text-sm text-ocean/45">
                {Math.floor(summary.durationSeconds / 60)} Min. Gespräch
                {summary.ideas.length > 0 && ` · ${summary.ideas.length} Ideen gespeichert`}
              </p>
            </div>

            {summary.ideas.length > 0 && (
              <div className="space-y-3 mb-8">
                <p className="text-xs font-medium text-ocean/50 uppercase tracking-wider">
                  Gespeicherte Content-Ideen
                </p>
                {summary.ideas.map((idea, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white rounded-2xl border border-ocean/[0.06] p-4 shadow-[0_1px_8px_rgba(32,35,69,0.04)]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-xl bg-blush-light/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Lightbulb className="h-4 w-4 text-blush-dark" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ocean mb-0.5">{idea.title}</p>
                        <p className="text-xs text-ocean/50 leading-relaxed">{idea.description}</p>
                        {idea.contentType && (
                          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-ocean/[0.04] text-ocean/40">
                            {idea.contentType}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {transcript.length > 0 && (
              <details className="mb-6">
                <summary className="text-xs text-ocean/40 cursor-pointer hover:text-ocean/60 transition-colors">
                  Transkript anzeigen ({transcript.length} Nachrichten)
                </summary>
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {transcript.map((entry, i) => (
                    <div key={i} className="text-xs text-ocean/50">
                      <span className="font-medium">{entry.role === "user" ? "Du" : "Agent"}:</span>{" "}
                      {entry.text}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="text-center">
              <button
                onClick={resetSession}
                className="px-6 py-2.5 rounded-full bg-ocean text-white text-sm font-medium hover:shadow-lg hover:scale-[1.02] transition-all duration-200 btn-press"
              >
                Neues Interview starten
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

interface ParticipantCardProps {
  name: string;
  role: string;
  icon: React.ReactNode;
  level: number;
  speaking: boolean;
  active: boolean;
  primary?: boolean;
}

function ParticipantCard({ name, role, icon, level, speaking, active, primary }: ParticipantCardProps) {
  return (
    <div
      className={`relative rounded-3xl p-6 flex flex-col items-center transition-all duration-300 ${
        primary
          ? "bg-white border border-ocean/[0.08] shadow-[0_2px_20px_rgba(32,35,69,0.06)]"
          : "bg-ocean/[0.02] border border-ocean/[0.05]"
      } ${speaking ? "ring-2 ring-offset-2 ring-green-400/60" : ""}`}
    >
      <motion.div
        animate={speaking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }}
        className={`h-20 w-20 rounded-full flex items-center justify-center mb-4 ${
          primary ? "bg-ocean/[0.06]" : "bg-white border border-ocean/[0.06]"
        }`}
      >
        {icon}
      </motion.div>

      <p className="text-base font-semibold text-ocean mb-0.5">{name}</p>
      <p className="text-xs text-ocean/45 mb-5">{role}</p>

      <div className="flex items-center gap-[3px] h-6">
        {[...Array(16)].map((_, i) => {
          const centerDistance = Math.abs(i - 7.5) / 7.5;
          const peak = 1 - centerDistance * 0.6;
          const height = active
            ? Math.max(3, level * 22 * peak * (0.6 + Math.random() * 0.4))
            : 3;
          return (
            <motion.div
              key={i}
              className={`w-[3px] rounded-full ${primary ? "bg-ocean/50" : "bg-ocean/30"}`}
              animate={{
                height: speaking ? height : 3,
                opacity: speaking ? 0.7 + peak * 0.3 : 0.35,
              }}
              transition={{ duration: 0.12 }}
            />
          );
        })}
      </div>
    </div>
  );
}
