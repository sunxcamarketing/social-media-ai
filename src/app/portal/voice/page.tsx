"use client";

import { usePortalClient } from "../use-portal-client";
import { VoiceAgent } from "@/components/voice-agent";

export default function PortalVoice() {
  const { loading: authLoading } = usePortalClient();
  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }
  // Client users are authenticated — the voice server resolves their clientId
  // from the Supabase session, no override needed.
  return <VoiceAgent />;
}
