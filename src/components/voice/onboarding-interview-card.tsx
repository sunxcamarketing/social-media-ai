"use client";

import { Mic, ArrowRight } from "lucide-react";
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
  onOpen: () => void;
}

export function OnboardingInterviewCard({ lang, onboarding, sessions, onOpen }: OnboardingInterviewCardProps) {
  const doneCount = onboarding.blocks.filter((b) => b.status === "done").length;
  const total = onboarding.blocks.length;
  const totalSeconds = sessions.reduce((n, s) => n + s.durationSeconds, 0);
  const totalMins = Math.floor(totalSeconds / 60);
  const firstDate = sessions.length > 0
    ? sessions.map((s) => new Date(s.createdAt).getTime()).sort((a, b) => a - b)[0]
    : null;

  return (
    <button
      onClick={onOpen}
      className="w-full rounded-2xl border border-ocean/[0.06] bg-white p-5 hover:border-ocean/15 transition-all text-left group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-blush-light/50 flex items-center justify-center">
            <Mic className="h-4 w-4 text-blush-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-ocean">
                {lang === "en" ? "Onboarding Interview" : "Onboarding-Interview"}
              </h3>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-ocean/[0.04] text-ocean/55">
                {doneCount}/{total}
              </span>
            </div>
            <p className="text-[11px] text-ocean/50 mt-0.5">
              {firstDate && new Date(firstDate).toLocaleDateString(lang === "en" ? "en-US" : "de-DE")}
              {sessions.length > 0 && ` · ${totalMins} ${lang === "en" ? "min total" : "Min gesamt"} · ${sessions.length} ${lang === "en" ? (sessions.length === 1 ? "session" : "sessions") : (sessions.length === 1 ? "Gespräch" : "Gespräche")}`}
            </p>
            <p className="text-xs text-ocean/60 mt-2 leading-relaxed">
              {lang === "en"
                ? "Structured voice interview across 8 blocks — identity, positioning, audience, beliefs, offer, feel, vision, resources. Click to view answers."
                : "Strukturiertes Voice-Interview durch 8 Blöcke — Identität, Positionierung, Zielgruppe, Beliefs, Angebot, Feel, Vision, Ressourcen. Klick für Antworten."}
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
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-ocean/30 group-hover:text-ocean/70 transition-colors mt-3" />
      </div>
    </button>
  );
}
