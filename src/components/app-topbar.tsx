"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LogOut,
  Command as CommandIcon,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useClientsCache } from "@/hooks/use-clients-cache";

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  information: "Profil",
  scripts: "Skripte",
  strategy: "Strategie",
  ideas: "Ideen",
  analyse: "Audit",
  chat: "Chat",
  competitors: "Konkurrenz-Analyse",
  // Legacy routes still work
  videos: "Videos",
  voice: "Voice",
  creators: "Creators",
  research: "Research",
  run: "Pipeline Run",
};

const ADMIN_PATH_LABELS: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/chat": "Content Agent",
  "/viral-script": "Viral Script",
  "/viral-builder": "Viral Builder",
  "/analyse": "Audit (global)",
  "/transcribe": "Transkribieren",
  "/training": "Training Scripts",
  "/strategy": "Strategie-Übersicht",
};

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const clients = useClientsCache();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const clientMatch = pathname.match(/^\/clients\/([^/]+)(?:\/([^/]+))?/);
  const activeClientId = clientMatch?.[1] ?? null;
  const activeTabKey = clientMatch?.[2] ?? (activeClientId ? "dashboard" : null);
  const activeClient = clients.find((c) => c.id === activeClientId);
  const activeClientName = activeClient?.configName || activeClient?.name || null;

  // Build breadcrumb
  const breadcrumbParts: Array<{ label: string; href?: string }> = [];
  if (activeClientName && activeClientId) {
    breadcrumbParts.push({
      label: activeClientName,
      href: `/clients/${activeClientId}/dashboard`,
    });
    if (activeTabKey && SECTION_LABELS[activeTabKey]) {
      breadcrumbParts.push({ label: SECTION_LABELS[activeTabKey] });
    }
  } else {
    const label = ADMIN_PATH_LABELS[pathname] || "Admin";
    breadcrumbParts.push({ label });
  }

  const openCmdK = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  const signOut = async () => {
    setMenuOpen(false);
    await supabaseBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-14 shrink-0 border-b border-ocean/[0.06] bg-white/75 backdrop-blur-xl sticky top-0 z-40">
      <div className="h-0.5 bg-gradient-to-r from-blush-light via-blush to-ocean/60" />

      <div className="h-full flex items-center gap-4 px-6">
        {/* Logo */}
        <Link href="/admin" className="shrink-0">
          <h1 className="text-base font-light tracking-[0.3em] uppercase text-ocean hover:text-ocean-light transition-colors">
            SUN<span className="text-ivory">X</span>CA
          </h1>
        </Link>

        <div className="h-5 w-px bg-ocean/10 shrink-0" />

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 min-w-0 flex-1 text-sm">
          {breadcrumbParts.map((part, i) => {
            const isLast = i === breadcrumbParts.length - 1;
            const baseClass = isLast ? "text-ocean font-medium" : "text-ocean/50";
            return (
              <div key={i} className="flex items-center gap-2 min-w-0">
                {i > 0 && <span className="text-ocean/25">/</span>}
                {part.href && !isLast ? (
                  <Link href={part.href} className={`${baseClass} hover:text-ocean truncate transition-colors`}>
                    {part.label}
                  </Link>
                ) : (
                  <span className={`${baseClass} truncate`}>{part.label}</span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right: Search + User */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openCmdK}
            title="Suchen (⌘K)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ocean/[0.08] bg-white/80 text-xs text-ocean/45 hover:text-ocean hover:border-ocean/[0.15] transition-all"
          >
            <CommandIcon className="h-3 w-3" />
            <span>Suchen</span>
            <kbd className="ml-1 font-mono text-[10px] bg-ocean/[0.03] rounded border border-ocean/[0.06] px-1">⌘K</kbd>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title="Menü"
              className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${
                menuOpen ? "bg-ocean/[0.06] text-ocean" : "text-ocean/50 hover:text-ocean hover:bg-ocean/[0.04]"
              }`}
            >
              <Settings className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50 p-1.5">
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ocean/70 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4 text-ocean/45" />
                  Admin Dashboard
                </Link>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ocean/70 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
                >
                  <LogOut className="h-4 w-4 text-ocean/45" />
                  Abmelden
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
