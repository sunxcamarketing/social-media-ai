"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

const pageTitles: Record<string, string> = {
  "/videos": "Videos",
  "/run": "Run Pipeline",
  "/creators": "Creators",
  "/configs": "Configs",
};

export function TopBar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Virality System";

  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-background/80 px-6 backdrop-blur-xl">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
      <div className="h-4 w-px bg-white/10" />
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}
