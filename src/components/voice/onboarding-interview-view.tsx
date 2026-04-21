"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { VoiceOnboarding, VoiceBlockId } from "@/lib/types";
import { BLOCK_META } from "./onboarding-interview-card";

interface VoiceSessionEntry {
  id: string;
  createdAt: string;
  durationSeconds: number;
  transcript: Array<{ role: "user" | "model"; text: string; timestamp?: string }>;
}

export interface OnboardingInterviewViewProps {
  lang: "de" | "en";
  onboarding: VoiceOnboarding;
  sessions: VoiceSessionEntry[];
}

export function OnboardingInterviewView({ lang, onboarding, sessions }: OnboardingInterviewViewProps) {
  const [showTranscripts, setShowTranscripts] = useState(false);
  const doneBlocks = onboarding.blocks.filter((b) => b.status === "done");
  const pendingBlocks = onboarding.blocks.filter((b) => b.status === "pending");

  return (
    <div className="space-y-6">
      {/* Synthesis (voice DNA doc) — shown at top when all 8 done */}
      {onboarding.synthesis && (
        <details className="rounded-2xl bg-gradient-to-br from-blush-light/30 to-white border border-blush/20 p-5 group" open>
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-blush-dark font-medium">
                {lang === "en" ? "Voice DNA" : "Stimm-DNA"}
              </p>
              <p className="text-xs text-ocean/55 mt-0.5">
                {lang === "en" ? "Holistic synthesis from the interview" : "Ganzheitliche Synthese aus dem Interview"}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-ocean/40 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-4 text-sm text-ocean/80 leading-relaxed whitespace-pre-wrap">
            {onboarding.synthesis}
          </div>
        </details>
      )}

      {/* Blocks — question + summary + quotes */}
      <div className="space-y-4">
        {doneBlocks.map((b, idx) => {
          const meta = BLOCK_META[b.id as VoiceBlockId][lang];
          return (
            <div key={b.id} className="rounded-2xl bg-white border border-ocean/[0.06] p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-6 w-6 shrink-0 rounded-full bg-ocean text-white text-[10px] font-medium flex items-center justify-center">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-ocean/45 mb-0.5">{meta.label}</p>
                  <p className="text-sm font-medium text-ocean leading-snug">{meta.question}</p>
                </div>
              </div>
              {b.summary ? (
                <div className="pl-9 space-y-3">
                  <p className="text-sm text-ocean/80 leading-relaxed">{b.summary}</p>
                  {b.quotes.length > 0 && (
                    <div className="space-y-1.5 border-l-2 border-blush/30 pl-3 py-1">
                      {b.quotes.map((q, i) => (
                        <p key={i} className="text-xs text-ocean/55 italic leading-relaxed">
                          &ldquo;{q}&rdquo;
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="pl-9 text-xs text-ocean/40 italic">
                  {lang === "en" ? "Marked done — detailed summary pending background analysis." : "Markiert als abgeschlossen — Detail-Zusammenfassung wird im Hintergrund analysiert."}
                </p>
              )}
            </div>
          );
        })}

        {pendingBlocks.length > 0 && (
          <div className="rounded-2xl bg-ocean/[0.02] border border-dashed border-ocean/10 p-5">
            <p className="text-[10px] uppercase tracking-wider text-ocean/45 mb-3">
              {lang === "en" ? "Not yet covered" : "Noch nicht abgedeckt"}
            </p>
            <div className="space-y-2">
              {pendingBlocks.map((b) => {
                const meta = BLOCK_META[b.id as VoiceBlockId][lang];
                return (
                  <div key={b.id} className="text-xs text-ocean/50">
                    <span className="text-ocean/35">·</span> {meta.label} — {meta.question}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Transcripts — collapsible, all sessions concatenated */}
      {sessions.length > 0 && (
        <div className="rounded-2xl bg-ocean/[0.02] border border-ocean/[0.06] p-5">
          <button
            onClick={() => setShowTranscripts((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-xs font-medium text-ocean/70">
                {lang === "en" ? "Full transcripts" : "Vollständige Transkripte"}
              </p>
              <p className="text-[10px] text-ocean/45 mt-0.5">
                {sessions.length} {lang === "en" ? (sessions.length === 1 ? "session" : "sessions") : (sessions.length === 1 ? "Gespräch" : "Gespräche")}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-ocean/40 transition-transform ${showTranscripts ? "rotate-180" : ""}`} />
          </button>
          {showTranscripts && (
            <div className="mt-4 space-y-6">
              {sessions.map((s, sIdx) => (
                <div key={s.id}>
                  <p className="text-[10px] uppercase tracking-wider text-ocean/45 mb-2">
                    {lang === "en" ? `Session ${sIdx + 1}` : `Gespräch ${sIdx + 1}`} · {new Date(s.createdAt).toLocaleDateString(lang === "en" ? "en-US" : "de-DE")} · {Math.floor(s.durationSeconds / 60)}:{(s.durationSeconds % 60).toString().padStart(2, "0")}
                  </p>
                  <div className="space-y-2">
                    {s.transcript.length === 0 && (
                      <p className="text-xs text-ocean/35 italic">
                        {lang === "en" ? "(transcript empty)" : "(Transkript leer)"}
                      </p>
                    )}
                    {s.transcript.map((e, i) => (
                      <div key={i} className="flex gap-2 text-xs leading-relaxed">
                        <span className={`shrink-0 w-12 font-medium ${e.role === "user" ? "text-ocean" : "text-blush-dark"}`}>
                          {e.role === "user" ? "Client:" : "Agent:"}
                        </span>
                        <span className="text-ocean/70 flex-1">{e.text.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
