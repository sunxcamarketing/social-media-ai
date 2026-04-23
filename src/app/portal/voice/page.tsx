"use client";

import { useState } from "react";
import { Mic, Sparkles, ArrowRight } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { VoiceAgent } from "@/components/voice-agent";
import { VoiceProfileRecorder } from "@/components/voice-profile-recorder";
import { ComingSoonPanel } from "@/components/coming-soon-panel";

type Mode = "hub" | "content-ideas" | "voice-profile";

export default function PortalVoice() {
  const { user, loading: authLoading } = usePortalClient();
  const [mode, setMode] = useState<Mode>("hub");

  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  // Clients see a friendly coming-soon gate. Admins (including when
  // impersonating) keep the real experience so they can test.
  if (user?.role === "client") {
    return (
      <ComingSoonPanel
        icon={Mic}
        titleKey="comingSoon.voiceTitle"
        bodyKey="comingSoon.voiceBody"
      />
    );
  }

  if (mode === "content-ideas") {
    return <VoiceAgent onSessionEnd={() => setMode("hub")} />;
  }

  if (mode === "voice-profile") {
    return <VoiceProfileRecorder onClose={() => setMode("hub")} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Voice</h1>
        <p className="mt-1 text-sm text-ocean/60">
          Zwei Aufnahme-Modi. Wähle was du gerade machen willst.
        </p>
      </div>

      <button
        onClick={() => setMode("voice-profile")}
        className="w-full text-left glass rounded-2xl p-6 border border-blush/40 bg-gradient-to-br from-blush-light/20 to-white hover:border-blush/60 transition-all group"
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-blush/30 border border-blush/50 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-blush-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Stimmprofil aufnehmen</h2>
              <ArrowRight className="h-4 w-4 text-ocean/40 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-ocean/60 mt-1 leading-relaxed">
              3 kurze Szenarien + ein paar Fragen zu deinem Thema. Ca. 5-10 Min. Hilft uns deine Stimme in Skripten besser zu treffen.
            </p>
          </div>
        </div>
      </button>

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
              <h2 className="text-base font-semibold">Content-Interview</h2>
              <ArrowRight className="h-4 w-4 text-ocean/40 group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-xs text-ocean/60 mt-1 leading-relaxed">
              Der Agent stellt Fragen und zieht Video-Ideen aus dem Gespräch. Ca. 20-30 Min.
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
