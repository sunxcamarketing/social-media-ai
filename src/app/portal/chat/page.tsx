"use client";

import { usePortalClient } from "../use-portal-client";
import { ContentAgentChat } from "@/components/content-agent-chat";
import { useI18n } from "@/lib/i18n";

export default function PortalChat() {
  const { t } = useI18n();
  const { loading: authLoading } = usePortalClient();

  const suggestions = [
    t("portal.chat.suggestion1"),
    t("portal.chat.suggestion2"),
    t("portal.chat.suggestion3"),
    t("portal.chat.suggestion4"),
  ];

  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">{t("portal.shell.loading")}</div>;
  }

  return (
    <ContentAgentChat
      layout="embedded"
      suggestions={suggestions}
      emptyStateSubtitle={t("portal.chat.emptySubtitle")}
    />
  );
}
