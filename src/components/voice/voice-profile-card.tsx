"use client";

import { Waves, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceProfile } from "@/lib/types";

export interface VoiceProfileCardProps {
  lang: "de" | "en";
  profile: VoiceProfile | null;
  /** Open the recorder dialog (record / re-record voice samples) */
  onStart: () => void;
}

/** Renders the client's voice DNA — tone, favorite words, energy. Distinct
 *  from the OnboardingInterviewCard: that one captures WHAT the client
 *  says (business content), this one captures HOW they say it (style).
 *  Profile is filled by the recorder under /portal/voice when the client
 *  reads scripted prompts in their own words. */
export function VoiceProfileCard({ lang, profile, onStart }: VoiceProfileCardProps) {
  // "Empty" = no profile object, OR profile exists but core fields are
  // unfilled (a fresh extraction with no voice material yet).
  const isFilled = !!profile && (
    profile.favoriteWords.length > 0 ||
    profile.tone.trim().length > 0 ||
    profile.energy.trim().length > 0
  );

  return (
    <div className="rounded-2xl border border-ocean/[0.06] bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-ivory/30 flex items-center justify-center">
          <Waves className="h-4 w-4 text-ocean/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-ocean">
              {lang === "en" ? "Voice Profile" : "Stimmprofil"}
              <span className="ml-2 text-[10px] text-ocean/40 font-normal">
                {lang === "en" ? "(voice DNA)" : "(Stimm-DNA)"}
              </span>
            </h3>
            {isFilled && (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                <Sparkles className="h-2.5 w-2.5" />
                {lang === "en" ? "Captured" : "Erfasst"}
              </span>
            )}
          </div>

          <p className="text-xs text-ocean/60 mt-2 leading-relaxed">
            {lang === "en"
              ? "How does the client speak? Tone, pacing, favorite words. Captured by reading scripted prompts in their own style — feeds into script generation so writes sound like them."
              : "Wie spricht der Kunde? Tonfall, Wortwahl, Energie. Aufgenommen durch das Vorlesen vorgegebener Prompts im eigenen Stil — fließt in die Skript-Generierung damit Skripte nach ihm klingen."}
          </p>

          {isFilled && profile && (
            <div className="mt-3 space-y-2">
              {profile.tone && (
                <ProfileField
                  label={lang === "en" ? "Tone" : "Tonfall"}
                  value={profile.tone}
                />
              )}
              {profile.energy && (
                <ProfileField
                  label={lang === "en" ? "Energy" : "Energie"}
                  value={profile.energy}
                />
              )}
              {profile.favoriteWords.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-ocean/40 mb-1">
                    {lang === "en" ? "Favorite words" : "Lieblingswörter"}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {profile.favoriteWords.slice(0, 8).map((w) => (
                      <span
                        key={w}
                        className="text-[10px] bg-ocean/[0.04] border border-ocean/[0.06] rounded-md px-1.5 py-0.5 text-ocean/75"
                      >
                        {w}
                      </span>
                    ))}
                    {profile.favoriteWords.length > 8 && (
                      <span className="text-[10px] text-ocean/40 px-1">
                        +{profile.favoriteWords.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          onClick={onStart}
          size="sm"
          className="shrink-0 gap-1.5 bg-ocean text-white hover:bg-ocean-light"
        >
          {isFilled
            ? (lang === "en" ? "Re-record" : "Neu aufnehmen")
            : (lang === "en" ? "Record" : "Aufnehmen")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ocean/40 mb-0.5">{label}</p>
      <p className="text-xs text-ocean/80 leading-snug">{value}</p>
    </div>
  );
}
