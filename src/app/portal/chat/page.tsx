"use client";

import { MessageSquare } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { ContentAgentChat } from "@/components/content-agent-chat";
import { ComingSoonPanel } from "@/components/coming-soon-panel";
import { useI18n } from "@/lib/i18n";

export default function PortalChat() {
  const { t } = useI18n();
  const { user, loading: authLoading } = usePortalClient();

  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">{t("portal.shell.loading")}</div>;
  }

  // Clients see a friendly coming-soon gate. Admins (including when
  // impersonating) keep the real experience so they can test.
  if (user?.role === "client") {
    return (
      <ComingSoonPanel
        icon={MessageSquare}
        titleKey="comingSoon.chatTitle"
        bodyKey="comingSoon.chatBody"
      />
    );
  }

  const suggestions = [
    t("portal.chat.suggestion1"),
    t("portal.chat.suggestion2"),
    t("portal.chat.suggestion3"),
    t("portal.chat.suggestion4"),
  ];

  return (
    <ContentAgentChat
      layout="embedded"
      suggestions={suggestions}
      emptyStateSubtitle={t("portal.chat.emptySubtitle")}
    />
  );
}
