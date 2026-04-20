"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, User, Phone, PhoneOff, Loader2, PauseCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/lib/i18n";
import { VOICE_BLOCK_ORDER, type VoiceBlockId } from "@/lib/types";
import { ParticipantCard } from "@/components/voice/participant-card";
import { OnboardingProgress } from "@/components/voice/onboarding-progress";
import { SessionSummaryView } from "@/components/voice/session-summary";

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

interface FieldSuggestion {
  field: string;
  value: string;
  sourceQuote: string;
}

interface SessionSummary {
  ideas?: IdeaResult[];                // content-ideas mode
  doneCount?: number;                  // onboarding mode
  total?: number;                      // onboarding mode
  synthesisGenerated?: boolean;        // onboarding mode
  fieldSuggestions?: FieldSuggestion[]; // onboarding mode: extracted profile field updates
  backgroundProcessing?: boolean;      // onboarding mode: Claude enrichment still running
  durationSeconds: number;
  transcriptLength: number;
}

const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || "ws://localhost:4001";

const VALID_BLOCK_IDS = new Set<string>(VOICE_BLOCK_ORDER);
function isVoiceBlockId(v: string): v is VoiceBlockId {
  return VALID_BLOCK_IDS.has(v);
}

interface VoiceAgentProps {
  /** If set, passed as clientId query param (admin view). If omitted, the
   *  voice-server resolves the clientId from the authenticated Supabase user. */
  clientIdOverride?: string;
  /** If set, passed as lang query param — forces agent language. If omitted,
   *  the voice-server falls back to the client's stored language preference. */
  lang?: "de" | "en";
  /** "onboarding" = structured 8-block interview with progress bar.
   *  "content-ideas" = free-form content interview (default, original behavior). */
  mode?: "onboarding" | "content-ideas";
  /** For onboarding mode: which blocks are already done from a previous session. */
  initialCompletedBlocks?: VoiceBlockId[];
  /** Callback after session ends. */
  onSessionEnd?: () => void;
}

export function VoiceAgent({
  clientIdOverride,
  lang: langOverride,
  mode = "content-ideas",
  initialCompletedBlocks = [],
  onSessionEnd,
}: VoiceAgentProps) {
  const { t } = useI18n();
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedBlocks, setCompletedBlocks] = useState<Set<VoiceBlockId>>(
    () => new Set(initialCompletedBlocks),
  );
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<"idle" | "done" | "error">("idle");

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
      if (!session?.access_token) throw new Error(t("voice.notLoggedIn"));

      const params = new URLSearchParams({ token: session.access_token });
      if (clientIdOverride) params.set("clientId", clientIdOverride);
      if (langOverride) params.set("lang", langOverride);
      if (mode === "onboarding") params.set("mode", "onboarding");
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
            case "onboarding_summary":
              setSummary(msg);
              setSessionState("summary");
              break;
            case "onboarding_enriched":
              // Late-arriving background enrichment — merge into current summary
              // so the UI shows fieldSuggestions when they finally land.
              setSummary((prev) => prev ? {
                ...prev,
                synthesisGenerated: msg.synthesisGenerated ?? prev.synthesisGenerated,
                fieldSuggestions: msg.fieldSuggestions ?? prev.fieldSuggestions,
                backgroundProcessing: false,
              } : prev);
              break;
            case "block_progress":
              if (typeof msg.blockId === "string" && isVoiceBlockId(msg.blockId)) {
                setCompletedBlocks((prev) => new Set(prev).add(msg.blockId as VoiceBlockId));
              }
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
        // Map close codes from the server to user-facing messages. 1000 is a
        // clean close after a normal session end — no error. Everything else
        // before we received a summary is a problem worth surfacing.
        const isCleanClose = event.code === 1000 || event.code === 1005;
        if (!summary && !isCleanClose) {
          if (event.code === 4001) setError(t("voice.notLoggedIn"));
          else if (event.code === 4003) setError(t("voice.unauthorized"));
          else if (event.code === 4004) setError(t("voice.notLoggedIn"));
          else if (event.code === 4005) setError(t("voice.connectionFailed"));
          else if (event.code === 4006) setError(t("voice.connectionFailed"));
          else setError(t("voice.serverNotRunning")); // unknown code — default to "server unreachable"
        }
        if (!summary) setSessionState("idle");
        stopCapture();
      };

      // onerror fires before onclose on native network failures. Don't set
      // state/error here — onclose runs next with the actual close code and
      // will pick the right message. Setting state to "idle" here used to
      // race with onclose's state guard, masking the real error.
      ws.onerror = (ev) => {
        console.error("[voice-agent] WebSocket error:", ev);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : t("voice.startError"));
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

  const toggleSuggestion = (field: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  };

  const applySelected = async () => {
    if (!summary?.fieldSuggestions || selectedSuggestions.size === 0) return;
    const targetClientId = clientIdOverride;
    if (!targetClientId) {
      setApplyResult("error");
      return;
    }
    setApplying(true);
    setApplyResult("idle");
    try {
      const patch: Record<string, string> = { id: targetClientId };
      for (const s of summary.fieldSuggestions) {
        if (selectedSuggestions.has(s.field)) patch[s.field] = s.value;
      }
      const res = await fetch("/api/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("save failed");
      setApplyResult("done");
    } catch {
      setApplyResult("error");
    } finally {
      setApplying(false);
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
    onSessionEnd?.();
  };

  const isActive = sessionState === "active" || sessionState === "ending";
  const isLoading = sessionState === "connecting" || sessionState === "preparing";
  const statusLabel =
    sessionState === "idle" ? t("voice.statusReady")
    : sessionState === "connecting" ? t("voice.statusConnecting")
    : sessionState === "preparing" ? t("voice.statusPrep")
    : sessionState === "ending" ? t("voice.statusEnding")
    : sessionState === "summary" ? t("voice.statusDone")
    : t("voice.statusActive");
  const statusDotClass =
    sessionState === "idle" ? "bg-ocean/30"
    : isLoading ? "bg-amber-400 animate-pulse"
    : sessionState === "active" ? "bg-green-500 animate-pulse"
    : "bg-ocean/30";

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {sessionState !== "summary" && (
        <>
          <div className="shrink-0 pb-4 border-b border-ocean/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-ocean/55">
                <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
                <span className="font-medium">{statusLabel}</span>
              </div>
              <div className="text-xs font-mono tabular-nums text-ocean/40">
                {isActive ? formatTime(elapsedSeconds) : "--:--"}
              </div>
            </div>
            {mode === "onboarding" && (
              <OnboardingProgress completed={completedBlocks} t={t} />
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-2xl grid grid-cols-2 gap-4 mb-10">
              <ParticipantCard
                name={t("voice.you")}
                role={t("voice.clientRole")}
                icon={<User className="h-7 w-7 text-ocean/40" />}
                level={isRecording ? audioLevel : 0}
                speaking={isRecording && audioLevel > 0.08}
                active={isActive}
              />
              <ParticipantCard
                name={t("voice.agentName")}
                role={t("voice.agentRole")}
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
                {t("voice.startButton")}
              </motion.button>
            )}

            {isLoading && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-ocean/50 text-white font-medium">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {sessionState === "connecting" ? t("voice.connectingMsg") : t("voice.loadingMsg")}
                </div>
                <p className="text-xs text-ocean/45 max-w-sm text-center leading-relaxed">
                  {sessionState === "connecting"
                    ? t("voice.buildingSession")
                    : t("voice.preloadingContext")}
                </p>
              </div>
            )}

            {isActive && (
              <div className="flex items-center gap-3">
                {mode === "onboarding" && sessionState === "active" && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={endSession}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-ocean/[0.12] text-ocean/70 text-sm font-medium hover:bg-ocean/[0.03] transition-all duration-200 btn-press"
                  >
                    <PauseCircle className="h-4 w-4" />
                    {t("voice.pauseButton")}
                  </motion.button>
                )}
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
                  {sessionState === "ending" ? t("voice.summarizing") : t("voice.endButton")}
                </motion.button>
              </div>
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
                        {entry.role === "user" ? t("voice.youLabel") : t("voice.agentLabel")}
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
        <SessionSummaryView
          mode={mode}
          summary={summary}
          transcript={transcript}
          selectedSuggestions={selectedSuggestions}
          applying={applying}
          applyResult={applyResult}
          onToggleSuggestion={toggleSuggestion}
          onToggleAll={() => {
            if (!summary.fieldSuggestions) return;
            if (selectedSuggestions.size === summary.fieldSuggestions.length) {
              setSelectedSuggestions(new Set());
            } else {
              setSelectedSuggestions(new Set(summary.fieldSuggestions.map((s) => s.field)));
            }
          }}
          onApplySelected={applySelected}
          onReset={resetSession}
          t={t}
        />
      )}
    </div>
  );
}

