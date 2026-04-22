"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Mic, Square, Sparkles } from "lucide-react";
import { useAudioCapture } from "@/hooks/use-audio-capture";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { VOICE_PROFILE_STEPS } from "@/lib/voice-profile-scenarios";

type StepState = "intro" | "connecting" | "recording" | "saving" | "done";
type TranscriptEntry = { role: "user" | "model"; text: string };

const VOICE_SERVER_URL = process.env.NEXT_PUBLIC_VOICE_SERVER_URL || "ws://localhost:4001";

interface VoiceProfileRecorderProps {
  onClose: () => void;
  clientIdOverride?: string;
  lang?: "de" | "en";
}

export function VoiceProfileRecorder({ onClose, clientIdOverride, lang }: VoiceProfileRecorderProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [stepState, setStepState] = useState<StepState>("intro");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const playbackQueueRef = useRef<AudioBufferSourceNode[]>([]);

  const step = VOICE_PROFILE_STEPS[stepIdx];
  const isLastStep = stepIdx === VOICE_PROFILE_STEPS.length - 1;
  const allDone = completedSteps.size === VOICE_PROFILE_STEPS.length;

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
    };
  }, []);

  const sendAudioChunk = useCallback((pcmBase64: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "audio", data: pcmBase64 }));
    }
  }, []);

  const { isRecording, audioLevel, start: startCapture, stop: stopCapture } = useAudioCapture({
    onAudioChunk: sendAudioChunk,
  });

  const startRecording = async () => {
    setError(null);
    setTranscript([]);
    setStepState("connecting");

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token) throw new Error("Nicht eingeloggt");

      const params = new URLSearchParams({
        token: session.access_token,
        mode: "voice-profile",
        step: step.id,
      });
      if (clientIdOverride) params.set("clientId", clientIdOverride);
      if (lang) params.set("lang", lang);

      const ws = new WebSocket(`${VOICE_SERVER_URL}?${params.toString()}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "ready":
              // WS + Gemini up. Wait for "speaking" before enabling mic.
              break;
            case "speaking":
              // For scenarios this fires immediately (passive mode); for topic
              // it fires when the agent speaks its first question. Either way,
              // mic goes on now.
              setStepState("recording");
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
            case "voice_profile_summary":
              setCompletedSteps((prev) => new Set(prev).add(stepIdx));
              setStepState("done");
              break;
            case "error":
              setError(msg.message || "Unbekannter Fehler");
              setStepState("intro");
              break;
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };

      ws.onclose = () => {
        stopCapture();
        if (wsRef.current === ws) wsRef.current = null;
      };

      ws.onerror = () => {
        setError("Verbindungsfehler. Bitte erneut versuchen.");
        setStepState("intro");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Start");
      setStepState("intro");
    }
  };

  const stopRecording = () => {
    setStepState("saving");
    stopCapture();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end" }));
    }
  };

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= VOICE_PROFILE_STEPS.length) return;
    if (stepState === "recording" || stepState === "connecting" || stepState === "saving") return;
    setStepIdx(idx);
    setStepState("intro");
    setTranscript([]);
    setError(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      stopCapture();
    };
  }, [stopCapture]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header with back + progress */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onClose}
          disabled={stepState === "recording" || stepState === "connecting"}
          className="flex items-center gap-1.5 text-xs text-ocean/60 hover:text-ocean disabled:opacity-40 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </button>
        <div className="flex items-center gap-1.5">
          {VOICE_PROFILE_STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToStep(i)}
              disabled={stepState === "recording" || stepState === "connecting"}
              className={`h-2 rounded-full transition-all ${
                i === stepIdx
                  ? "w-8 bg-blush-dark"
                  : completedSteps.has(i)
                    ? "w-2 bg-green-500"
                    : "w-2 bg-ocean/15"
              }`}
              title={s.titleDe}
            />
          ))}
        </div>
      </div>

      {allDone ? (
        <AllDoneCard onClose={onClose} />
      ) : (
        <div className="glass rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-blush-dark uppercase tracking-wider">
              Schritt {stepIdx + 1} von {VOICE_PROFILE_STEPS.length}
            </span>
            {completedSteps.has(stepIdx) && (
              <span className="flex items-center gap-1 text-[11px] text-green-600">
                <Check className="h-3 w-3" /> Fertig
              </span>
            )}
          </div>

          <h2 className="text-2xl font-bold tracking-tight">{step.titleDe}</h2>

          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ocean/85 bg-warm-white/60 rounded-xl p-4 border border-ocean/[0.04]">
            {step.promptDe}
          </div>

          {/* State-specific UI */}
          {stepState === "intro" && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-ocean/50">
                {step.kind === "scenario"
                  ? "Wenn du bereit bist — Aufnahme starten und in deinen eigenen Worten erzählen."
                  : "Der Agent stellt dir ein paar Fragen dazu."}
              </p>
              <button
                onClick={startRecording}
                className="flex items-center gap-2 rounded-xl bg-ocean hover:bg-ocean-light text-white px-5 py-2.5 text-sm font-medium transition-colors"
              >
                <Mic className="h-4 w-4" /> Aufnahme starten
              </button>
            </div>
          )}

          {stepState === "connecting" && (
            <div className="flex items-center gap-2 text-sm text-ocean/60 pt-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Verbinde...
            </div>
          )}

          {stepState === "recording" && (
            <RecordingUI
              step={step}
              transcript={transcript}
              audioLevel={audioLevel}
              onStop={stopRecording}
              isRecording={isRecording}
            />
          )}

          {stepState === "saving" && (
            <div className="flex items-center gap-2 text-sm text-ocean/60 pt-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Speichere...
            </div>
          )}

          {stepState === "done" && (
            <DoneStepUI
              isLast={isLastStep}
              onNext={() => goToStep(stepIdx + 1)}
              onRetry={() => { setStepState("intro"); setTranscript([]); }}
              onFinish={() => setStepIdx(0)}
              transcript={transcript}
            />
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RecordingUI({
  step,
  transcript,
  audioLevel,
  onStop,
  isRecording,
}: {
  step: typeof VOICE_PROFILE_STEPS[number];
  transcript: TranscriptEntry[];
  audioLevel: number;
  onStop: () => void;
  isRecording: boolean;
}) {
  const userLines = transcript.filter((t) => t.role === "user");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
          <div
            className="absolute inset-0 rounded-full bg-red-500/20 transition-all"
            style={{ transform: `scale(${1 + (isRecording ? audioLevel * 0.6 : 0)})` }}
          />
          <Mic className="h-5 w-5 text-red-500 relative" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ocean">
            {step.kind === "scenario" ? "Du bist dran — erzähl drauf los." : "Der Agent hört zu und stellt gleich eine Frage."}
          </p>
          <p className="text-[11px] text-ocean/50 mt-0.5">
            {step.kind === "scenario"
              ? "Ich höre nur zu. Wenn du eine Pause brauchst — ist okay."
              : "Antwort in deinen eigenen Worten. Keine Show-Antworten."}
          </p>
        </div>
        <button
          onClick={onStop}
          className="flex items-center gap-2 rounded-xl bg-ocean/90 hover:bg-ocean text-white px-4 py-2 text-sm font-medium transition-colors shrink-0"
        >
          <Square className="h-3.5 w-3.5 fill-white" /> Fertig
        </button>
      </div>

      {userLines.length > 0 && (
        <div className="space-y-2 max-h-40 overflow-y-auto rounded-xl bg-ocean/[0.02] border border-ocean/[0.04] p-3">
          {userLines.slice(-5).map((line, i) => (
            <p key={i} className="text-xs text-ocean/75 leading-relaxed">
              {line.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function DoneStepUI({
  isLast,
  onNext,
  onRetry,
  onFinish,
  transcript,
}: {
  isLast: boolean;
  onNext: () => void;
  onRetry: () => void;
  onFinish: () => void;
  transcript: TranscriptEntry[];
}) {
  const userLines = transcript.filter((t) => t.role === "user");
  const totalChars = userLines.reduce((sum, l) => sum + l.text.length, 0);
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" /> Aufnahme gespeichert · {totalChars} Zeichen
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl border border-ocean/[0.08] bg-white hover:bg-warm-white text-ocean px-4 py-2.5 text-sm font-medium transition-colors"
        >
          Nochmal
        </button>
        {!isLast ? (
          <button
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-ocean hover:bg-ocean-light text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            Nächster Schritt <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onFinish}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <Check className="h-4 w-4" /> Alles fertig
          </button>
        )}
      </div>
    </div>
  );
}

function AllDoneCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="glass rounded-2xl p-8 text-center space-y-4 border border-blush/30 bg-gradient-to-br from-blush-light/20 to-white">
      <div className="h-14 w-14 rounded-2xl bg-blush/30 border border-blush/50 flex items-center justify-center mx-auto">
        <Sparkles className="h-7 w-7 text-blush-dark" />
      </div>
      <div>
        <h2 className="text-xl font-bold tracking-tight">Stimmprofil aufgenommen</h2>
        <p className="text-sm text-ocean/60 mt-2 leading-relaxed max-w-md mx-auto">
          Danke — deine Aufnahmen sind gespeichert. Deine Skripte werden ab jetzt besser nach dir klingen.
        </p>
      </div>
      <button
        onClick={onClose}
        className="rounded-xl bg-ocean hover:bg-ocean-light text-white px-6 py-2.5 text-sm font-medium transition-colors"
      >
        Fertig
      </button>
    </div>
  );
}
