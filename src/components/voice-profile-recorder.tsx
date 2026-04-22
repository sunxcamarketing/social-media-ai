"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Mic, Square, Sparkles } from "lucide-react";
import { VOICE_PROFILE_STEPS } from "@/lib/voice-profile-scenarios";
import { useGeminiLiveSocket, type GeminiLiveMessage, type TranscriptEntry } from "@/hooks/use-gemini-live-socket";

type StepState = "intro" | "connecting" | "recording" | "saving" | "done";

interface VoiceProfileRecorderProps {
  onClose: () => void;
  clientIdOverride?: string;
  lang?: "de" | "en";
}

export function VoiceProfileRecorder({ onClose, clientIdOverride, lang }: VoiceProfileRecorderProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [stepState, setStepState] = useState<StepState>("intro");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const step = VOICE_PROFILE_STEPS[stepIdx];
  const isLastStep = stepIdx === VOICE_PROFILE_STEPS.length - 1;
  const allDone = completedSteps.size === VOICE_PROFILE_STEPS.length;

  const handleMessage = useCallback((msg: GeminiLiveMessage) => {
    if (msg.type === "voice_profile_summary") {
      setCompletedSteps((prev) => new Set(prev).add(stepIdx));
      setStepState("done");
    }
  }, [stepIdx]);

  const socket = useGeminiLiveSocket({
    onMessage: handleMessage,
  });

  // Mirror socket state into our step-state machine where relevant
  if (socket.state === "active" && stepState === "connecting") {
    setStepState("recording");
  }

  const startRecording = async () => {
    setStepState("connecting");
    const params: Record<string, string> = {
      mode: "voice-profile",
      step: step.id,
    };
    if (clientIdOverride) params.clientId = clientIdOverride;
    if (lang) params.lang = lang;
    await socket.start({ params });
  };

  const stopRecording = () => {
    setStepState("saving");
    socket.stop();
  };

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= VOICE_PROFILE_STEPS.length) return;
    if (stepState === "recording" || stepState === "connecting" || stepState === "saving") return;
    setStepIdx(idx);
    setStepState("intro");
    socket.reset();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
              transcript={socket.transcript}
              audioLevel={socket.audioLevel}
              onStop={stopRecording}
              isRecording={socket.isRecording}
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
              onRetry={() => { setStepState("intro"); socket.reset(); }}
              onFinish={() => setStepIdx(0)}
              transcript={socket.transcript}
            />
          )}

          {socket.error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {socket.error}
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
