"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Config } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

export function TopBar() {
  const pathname = usePathname();
  const [clientName, setClientName] = useState<string | null>(null);
  const { lang, toggleLang, t } = useI18n();

  const tabLabels: Record<string, string> = {
    information: "Context",
    strategy:    t("nav.strategy"),
    scripts:     "Posts",
    videos:      "Videos",
    creators:    "Creators",
  };

  const clientMatch = pathname.match(/^\/clients\/([^/]+)\/([^/]+)/);
  const clientId = clientMatch?.[1] ?? null;
  const tabKey   = clientMatch?.[2] ?? null;
  const tabLabel = tabKey ? (tabLabels[tabKey] ?? tabKey) : null;

  useEffect(() => {
    if (!clientId) { setClientName(null); return; }
    fetch(`/api/configs/${clientId}`)
      .then((r) => r.json())
      .then((c: Config) => setClientName(c.configName || c.name || "Client"))
      .catch(() => setClientName("Client"));
  }, [clientId]);

  const title = clientName && tabLabel
    ? `${clientName} · ${tabLabel}`
    : clientName ?? tabLabel ?? "SUNXCA";

  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-ocean/[0.06] bg-white/80 px-6 backdrop-blur-xl">
      <SidebarTrigger className="text-ocean/65 hover:text-ocean transition-colors" />
      <div className="h-4 w-px bg-ocean/10" />
      <span className="text-sm font-medium text-ocean flex-1">{title}</span>
      <button
        onClick={toggleLang}
        className="flex items-center gap-1.5 rounded-full border border-ocean/10 px-3 py-1.5 text-xs font-medium text-ocean/70 hover:text-ocean hover:border-ocean/20 transition-all"
      >
        <span className="text-[13px]">{lang === "de" ? "DE" : "EN"}</span>
        <span className="text-ocean/40">|</span>
        <span className="text-[13px] text-ocean/40">{lang === "de" ? "EN" : "DE"}</span>
      </button>
    </div>
  );
}
