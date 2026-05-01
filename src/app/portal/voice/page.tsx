"use client";

import { useEffect, useState } from "react";
import { Mic, ArrowRight } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { VoiceAgent } from "@/components/voice-agent";
import { VoiceProfileRecorder } from "@/components/voice-profile-recorder";
import { VoiceProfileCard } from "@/components/voice/voice-profile-card";
import { ProfileChecklistPortal, hasMissingProfileFields } from "@/components/voice/profile-checklist-portal";
import { safeJsonParse } from "@/lib/safe-json";
import type { Config, VoiceProfile } from "@/lib/types";

type Mode = "hub" | "content-ideas" | "voice-profile";

export default function PortalVoice() {
  const { user, effectiveClientId, loading: authLoading } = usePortalClient();
  const [mode, setMode] = useState<Mode>("hub");
  const [client, setClient] = useState<Config | null>(null);
  const [clientLoading, setClientLoading] = useState(true);

  // Admins (impersonating or bootstrap) need explicit clientId on the WS
  // because cross-origin cookies don't reach the voice server.
  const adminClientIdOverride = user?.role === "admin" ? effectiveClientId ?? undefined : undefined;

  const reloadClient = () => {
    if (!effectiveClientId) return;
    fetch(`/api/configs/${effectiveClientId}`)
      .then((r) => r.json())
      .then((c) => setClient(c))
      .catch(() => {})
      .finally(() => setClientLoading(false));
  };

  useEffect(() => {
    if (!effectiveClientId) return;
    reloadClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveClientId]);

  const lang: "de" | "en" = client?.language === "en" ? "en" : "de";

  if (authLoading || clientLoading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  if (mode === "voice-profile") {
    return (
      <VoiceProfileRecorder
        clientIdOverride={adminClientIdOverride}
        lang={lang}
        onClose={() => {
          setMode("hub");
          reloadClient();
        }}
      />
    );
  }

  if (mode === "content-ideas") {
    return <VoiceAgent clientIdOverride={adminClientIdOverride} lang={lang} onSessionEnd={() => setMode("hub")} />;
  }

  // Hub: show setup cards (profile checklist + stimmprofil) gated on
  // missing data, plus the always-available content-interview entry.
  // Once both setup steps are done, only the content-interview remains.
  const profileMissing = client ? hasMissingProfileFields(client) : false;
  const voiceProfile: VoiceProfile | null = client?.voiceProfile
    ? safeJsonParse<VoiceProfile | null>(client.voiceProfile, null)
    : null;
  const voiceProfileMissing = !voiceProfile || (
    voiceProfile.favoriteWords.length === 0 &&
    !voiceProfile.tone.trim() &&
    !voiceProfile.energy.trim()
  );

  const showSetup = profileMissing || voiceProfileMissing;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {lang === "en" ? "Voice" : "Voice"}
        </h1>
        <p className="mt-1 text-sm text-ocean/60">
          {showSetup
            ? lang === "en"
              ? "Finish your profile setup, then start a content interview."
              : "Schließe dein Profil-Setup ab, dann starte ein Content-Interview."
            : lang === "en"
              ? "All set. Ready when you are."
              : "Alles bereit. Los geht's."}
        </p>
      </div>

      {/* Setup-phase cards — disappear once filled */}
      {client && profileMissing && (
        <ProfileChecklistPortal client={client} lang={lang} onSaved={reloadClient} />
      )}

      {client && voiceProfileMissing && (
        <VoiceProfileCard
          lang={lang}
          profile={voiceProfile}
          onStart={() => setMode("voice-profile")}
        />
      )}

      {/* Always-available "normal voice agent" — content interview */}
      <button
        onClick={() => setMode("content-ideas")}
        className="w-full text-left glass rounded-2xl p-6 border border-ocean/[0.08] hover:border-ocean/[0.16] transition-all group"
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-ocean/[0.04] border border-ocean/[0.08] flex items-center justify-center shrink-0">
            <Mic className="h-5 w-5 text-ocean/70" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">
                {lang === "en" ? "Content Interview" : "Content-Interview"}
              </h2>
              <ArrowRight className="h-4 w-4 text-ocean/40 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-ocean/60 mt-1 leading-relaxed">
              {lang === "en"
                ? "The agent asks you questions and pulls video ideas from the conversation. ~20-30 min."
                : "Der Agent stellt dir Fragen und zieht Video-Ideen aus dem Gespräch. Ca. 20-30 Min."}
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
