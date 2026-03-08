"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Config } from "@/lib/types";

const tabLabels: Record<string, string> = {
  information: "Context",
  strategy:    "Strategie",
  scripts:     "Posts",
  videos:      "Videos",
  creators:    "Creators",
};

export function TopBar() {
  const pathname = usePathname();
  const [clientName, setClientName] = useState<string | null>(null);

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
    : clientName ?? tabLabel ?? "Virality AI";

  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-background/80 px-6 backdrop-blur-xl">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
      <div className="h-4 w-px bg-white/10" />
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}
