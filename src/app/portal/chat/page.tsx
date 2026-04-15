"use client";

import { usePortalClient } from "../use-portal-client";
import { ContentAgentChat } from "@/components/content-agent-chat";

const SUGGESTIONS = [
  "Schreib mir ein Skript",
  "Was sagt mein Audit?",
  "Welche Hooks performen gut?",
  "Was machen meine Konkurrenten?",
];

export default function PortalChat() {
  const { loading: authLoading } = usePortalClient();

  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  return (
    <ContentAgentChat
      layout="embedded"
      suggestions={SUGGESTIONS}
      emptyStateSubtitle="Frag mich alles zu deinem Content, lass Skripte generieren oder check deine Performance. Du kannst auch PDFs oder Bilder anhängen."
    />
  );
}
