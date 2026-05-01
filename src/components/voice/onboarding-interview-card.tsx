"use client";

import { Mic, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceOnboarding, VoiceBlockId } from "@/lib/types";

export interface OnboardingSessionMeta {
  id: string;
  durationSeconds: number;
  createdAt: string;
}

/** Questions + labels per block, keyed by VoiceBlockId. Mirrors the
 *  voice-agent-onboarding.md prompt structure so the UI reads like the
 *  interview itself. */
export const BLOCK_META: Record<VoiceBlockId, { de: { label: string; question: string }; en: { label: string; question: string } }> = {
  identity: {
    de: { label: "Persönlichkeit & Antrieb", question: "Wer bist du als Mensch? Was treibt dich wirklich an?" },
    en: { label: "Identity & Drive", question: "Who are you as a person? What genuinely drives you?" },
  },
  positioning: {
    de: { label: "Positionierung & Autorität", question: "Wofür sollst du bekannt sein? Was ist dein Unfair Advantage?" },
    en: { label: "Positioning & Authority", question: "What should you be known for? What's your unfair advantage?" },
  },
  audience: {
    de: { label: "Zielgruppe", question: "Wen willst du wirklich anziehen — und wen abstoßen?" },
    en: { label: "Audience", question: "Who do you really want to attract — and who to repel?" },
  },
  beliefs: {
    de: { label: "Beliefs der Zielgruppe", question: "Was glaubt deine Zielgruppe über deine Branche, bevor sie dir vertraut?" },
    en: { label: "Audience Beliefs", question: "What does your audience believe about your industry before they trust you?" },
  },
  offer: {
    de: { label: "Emotionales Ergebnis", question: "Was verkaufst du wirklich — emotional? Was verändert sich für den Kunden?" },
    en: { label: "Emotional Outcome", question: "What are you really selling — emotionally? What changes for the customer?" },
  },
  feel: {
    de: { label: "Content-Feel", question: "Wie soll sich dein Content anfühlen? Tonalität, Vibe, Grenzen." },
    en: { label: "Content Feel", question: "How should your content feel? Tonality, vibe, limits." },
  },
  vision: {
    de: { label: "Instagram-Vision & KPIs", question: "Was ist deine Instagram-Vision? Wie sieht Erfolg in 6–12 Monaten aus?" },
    en: { label: "Instagram Vision & KPIs", question: "What's your Instagram vision? What does success look like in 6-12 months?" },
  },
  resources: {
    de: { label: "Ressourcen & Reality-Check", question: "Was ist realistisch machbar — Zeit, Kamera, Freigaben?" },
    en: { label: "Resources & Reality Check", question: "What's realistic — time, camera, approvals?" },
  },
};

export interface OnboardingInterviewCardProps {
  lang: "de" | "en";
  onboarding: VoiceOnboarding;
  sessions: OnboardingSessionMeta[];
  /** Open the live recorder dialog (start / continue interview) */
  onStart: () => void;
  /** Open the read-only viewer dialog. Only shown when doneCount > 0. */
  onReview?: () => void;
}

export function OnboardingInterviewCard({
  lang, onboarding, sessions, onStart, onReview,
}: OnboardingInterviewCardProps) {
  const doneCount = onboarding.blocks.filter((b) => b.status === "done").length;
  const total = onboarding.blocks.length;
  const isComplete = doneCount === total;
  const isStarted = doneCount > 0;
  const totalSeconds = sessions.reduce((n, s) => n + s.durationSeconds, 0);
  const totalMins = Math.floor(totalSeconds / 60);
  const firstDate = sessions.length > 0
    ? sessions.map((s) => new Date(s.createdAt).getTime()).sort((a, b) => a - b)[0]
    : null;

  const actionLabel = !isStarted
    ? (lang === "en" ? "Start" : "Starten")
    : isComplete
    ? (lang === "en" ? "Re-record" : "Neu aufnehmen")
    : (lang === "en" ? "Continue" : "Fortsetzen");

  return (
    <div className="rounded-2xl border border-ocean/[0.06] bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-blush-light/50 flex items-center justify-center">
          <Mic className="h-4 w-4 text-blush-dark" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-ocean">
              {lang === "en" ? "Onboarding Interview" : "Onboarding-Interview"}
            </h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-ocean/[0.04] text-ocean/55">
              {doneCount}/{total}
            </span>
            {isComplete && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {lang === "en" ? "Complete" : "Komplett"}
              </span>
            )}
          </div>

          {isStarted && (
            <p className="text-[11px] text-ocean/50 mt-0.5">
              {firstDate && new Date(firstDate).toLocaleDateString(lang === "en" ? "en-US" : "de-DE")}
              {sessions.length > 0 && ` · ${totalMins} ${lang === "en" ? "min total" : "Min gesamt"} · ${sessions.length} ${lang === "en" ? (sessions.length === 1 ? "session" : "sessions") : (sessions.length === 1 ? "Gespräch" : "Gespräche")}`}
            </p>
          )}

          <p className="text-xs text-ocean/60 mt-2 leading-relaxed">
            {lang === "en"
              ? "Structured voice interview across 8 blocks — identity, positioning, audience, beliefs, offer, feel, vision, resources. Captures WHAT the client says about their business."
              : "Strukturiertes Voice-Interview durch 8 Blöcke — Identität, Positionierung, Zielgruppe, Beliefs, Angebot, Feel, Vision, Ressourcen. Erfasst WAS der Kunde inhaltlich sagt."}
          </p>

          <div className="mt-3 flex gap-1">
            {onboarding.blocks.map((b) => (
              <div
                key={b.id}
                title={BLOCK_META[b.id][lang].label}
                className={`h-1 flex-1 rounded-full transition-all ${b.status === "done" ? "bg-ocean" : "bg-ocean/15"}`}
              />
            ))}
          </div>

          {isStarted && onReview && (
            <button
              onClick={onReview}
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-ocean/60 hover:text-ocean transition-colors"
            >
              {lang === "en" ? "View answers" : "Antworten anschauen"}
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <Button
          onClick={onStart}
          size="sm"
          className="shrink-0 gap-1.5 bg-ocean text-white hover:bg-ocean-light"
        >
          {actionLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
