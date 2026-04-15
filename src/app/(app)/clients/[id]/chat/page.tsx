"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ContentAgentChat } from "@/components/content-agent-chat";

export default function ClientChatPage() {
  const { id: clientId } = useParams<{ id: string }>();
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/configs/${clientId}`)
      .then((r) => r.json())
      .then((cfg) => setClientName(cfg.configName || cfg.name || ""))
      .catch(() => {});
  }, [clientId]);

  const suggestions = clientName
    ? [
        `Schreib ein Skript für ${clientName}`,
        `Was sagt ${clientName}s Audit?`,
        `Welche Hooks performen bei ${clientName}?`,
        "Was machen die Konkurrenten?",
      ]
    : ["Schreib ein Skript", "Was sagt das Audit?", "Welche Hooks performen?"];

  return (
    <ContentAgentChat
      clientId={clientId}
      clientName={clientName}
      suggestions={suggestions}
      emptyStateSubtitle="Der Content Agent hat Zugriff auf Kontext, Audit, Performance & Skripte — alles über diesen Client. Du kannst auch PDFs oder Bilder anhängen."
    />
  );
}
