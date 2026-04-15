"use client";

import { useParams } from "next/navigation";
import { VoiceAgent } from "@/components/voice-agent";

export default function ClientVoicePage() {
  const { id: clientId } = useParams<{ id: string }>();
  return <VoiceAgent clientIdOverride={clientId} />;
}
