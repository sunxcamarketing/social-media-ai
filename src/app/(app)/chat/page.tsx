"use client";

import { ContentAgentChat } from "@/components/content-agent-chat";

const SUGGESTIONS = [
  "Zeig mir alle Clients",
  "Was sagt Elliotts Audit?",
  "Schreib ein Skript für Elliott über Trading-Fehler",
  "Welche Hooks performen am besten?",
];

export default function GlobalContentAgentChat() {
  return (
    <ContentAgentChat
      suggestions={SUGGESTIONS}
      emptyStateSubtitle="Ich habe Zugriff auf alle Clients, Strategien, Skripte, Audits und Performance-Daten. Du kannst auch PDFs oder Bilder anhängen."
    />
  );
}
