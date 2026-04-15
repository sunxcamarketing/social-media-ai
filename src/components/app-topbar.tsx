"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart2,
  FileText,
  Search,
  Video,
  MessageSquare,
  Mic,
  Lightbulb,
  BookOpen,
  LogOut,
  ChevronDown,
  Plus,
  Check,
  Sparkles,
  LayoutDashboard,
  MoreHorizontal,
  Users,
  Play,
  Command as CommandIcon,
  Settings,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useClientsCache, addClientToCache } from "@/hooks/use-clients-cache";
import type { Config } from "@/lib/types";

interface Tab {
  title: string;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Primary tabs — shown inline. Reduced from 9 to 6 for clarity.
const PRIMARY_CLIENT_TABS: Tab[] = [
  { title: "Dashboard", key: "dashboard", icon: LayoutDashboard },
  { title: "Skripte", key: "scripts", icon: FileText },
  { title: "Strategie", key: "strategy", icon: BarChart2 },
  { title: "Ideen", key: "ideas", icon: Lightbulb },
  { title: "Audit", key: "analyse", icon: Search },
  { title: "Chat", key: "chat", icon: MessageSquare },
];

// Secondary tabs — hidden under a "Mehr" dropdown. Less-used per-client pages.
const SECONDARY_CLIENT_TABS: Tab[] = [
  { title: "Kontext", key: "information", icon: BookOpen },
  { title: "Videos", key: "videos", icon: Video },
  { title: "Voice Agent", key: "voice", icon: Mic },
  { title: "Konkurrenz", key: "creators", icon: Users },
  { title: "Research", key: "research", icon: Search },
  { title: "Pipeline Run", key: "run", icon: Play },
];

// When no client is selected, show the admin tools directly.
interface AdminTab { title: string; href: string; icon: React.ComponentType<{ className?: string }>; }

const ADMIN_TABS: AdminTab[] = [
  { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { title: "Chat", href: "/chat", icon: MessageSquare },
  { title: "Transkribieren", href: "/transcribe", icon: Mic },
  { title: "Viral Script", href: "/viral-script", icon: Sparkles },
  { title: "Viral Builder", href: "/viral-builder", icon: Sparkles },
  { title: "Audit", href: "/analyse", icon: Search },
  { title: "Training", href: "/training", icon: BookOpen },
];

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();

  const clients = useClientsCache();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const clientMatch = pathname.match(/^\/clients\/([^/]+)(?:\/([^/]+))?/);
  const activeClientId = clientMatch?.[1] ?? null;
  const activeTabKey = clientMatch?.[2] ?? (activeClientId ? "dashboard" : null);
  const isAdminSection = !activeClientId;
  const activeClient = clients.find((c) => c.id === activeClientId);
  const activeClientName = activeClient?.configName || activeClient?.name || "Kein Client";

  const switchClient = (clientId: string) => {
    setSwitcherOpen(false);
    router.push(`/clients/${clientId}/dashboard`);
  };

  const createClient = async () => {
    const name = window.prompt("Name des neuen Clients:");
    if (!name?.trim()) return;
    const res = await fetch("/api/configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configName: name.trim() }),
    });
    if (!res.ok) { alert("Fehler beim Erstellen"); return; }
    const created: Config = await res.json();
    addClientToCache(created);
    setSwitcherOpen(false);
    router.push(`/clients/${created.id}/information?setup=1`);
  };

  const activeSecondaryTab = activeClientId
    ? SECONDARY_CLIENT_TABS.find((t) => t.key === activeTabKey)
    : undefined;

  return (
    <div className="border-b border-ocean/[0.06] bg-white/85 backdrop-blur-xl sticky top-0 z-40">
      <div className="h-0.5 bg-gradient-to-r from-blush-light via-blush to-ocean/60" />

      <div className="max-w-7xl mx-auto px-6 flex items-center gap-5 h-16">
        {/* Logo */}
        <Link href="/admin" className="shrink-0">
          <h1 className="text-lg font-light tracking-[0.3em] uppercase text-ocean hover:text-ocean-light transition-colors">
            SUN<span className="text-ivory">X</span>CA
          </h1>
        </Link>

        <div className="h-6 w-px bg-ocean/10 shrink-0" />

        {/* Client Switcher */}
        <div className="relative shrink-0" ref={switcherRef}>
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              switcherOpen
                ? "bg-ocean/[0.05] text-ocean"
                : "text-ocean/80 hover:text-ocean hover:bg-ocean/[0.03]"
            }`}
          >
            <span className="max-w-[180px] truncate">{activeClientName}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-ocean/50 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
          </button>

          {switcherOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50">
              <div className="p-2 max-h-80 overflow-y-auto">
                {clients.map((c) => {
                  const isActive = c.id === activeClientId;
                  const name = c.configName || c.name || "Unbenannt";
                  return (
                    <button
                      key={c.id}
                      onClick={() => switchClient(c.id)}
                      className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-ocean text-white font-medium"
                          : "text-ocean/75 hover:bg-ocean/[0.03] hover:text-ocean"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-white/80" />}
                    </button>
                  );
                })}
                {clients.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-ocean/40">Noch keine Clients</p>
                )}
              </div>
              <button
                onClick={createClient}
                className="w-full flex items-center gap-2 border-t border-ocean/[0.06] px-4 py-2.5 text-xs text-ocean/60 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Neuen Client anlegen
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {activeClientId ? (
            <>
              {PRIMARY_CLIENT_TABS.map((tab) => {
                const isActive = activeTabKey === tab.key;
                return (
                  <Link
                    key={tab.key}
                    href={`/clients/${activeClientId}/${tab.key}`}
                    className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all duration-200 shrink-0 ${
                      isActive
                        ? "bg-ocean text-white font-medium shadow-[0_2px_8px_rgba(32,35,69,0.15)]"
                        : "text-ocean/55 hover:text-ocean hover:bg-ocean/[0.04]"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.title}
                  </Link>
                );
              })}

              {/* Mehr-Dropdown */}
              <div className="relative shrink-0" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all ${
                    activeSecondaryTab
                      ? "bg-ocean text-white font-medium shadow-[0_2px_8px_rgba(32,35,69,0.15)]"
                      : moreOpen
                      ? "bg-ocean/[0.05] text-ocean"
                      : "text-ocean/55 hover:text-ocean hover:bg-ocean/[0.04]"
                  }`}
                >
                  {activeSecondaryTab ? (
                    <>
                      <activeSecondaryTab.icon className="h-4 w-4" />
                      {activeSecondaryTab.title}
                    </>
                  ) : (
                    <>
                      <MoreHorizontal className="h-4 w-4" />
                      Mehr
                    </>
                  )}
                  <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                {moreOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50 p-2">
                    {SECONDARY_CLIENT_TABS.map((tab) => {
                      const isActive = activeTabKey === tab.key;
                      return (
                        <Link
                          key={tab.key}
                          href={`/clients/${activeClientId}/${tab.key}`}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                            isActive
                              ? "bg-blush-light/40 text-ocean font-medium"
                              : "text-ocean/70 hover:bg-ocean/[0.03] hover:text-ocean"
                          }`}
                        >
                          <tab.icon className="h-4 w-4 text-ocean/45" />
                          {tab.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            ADMIN_TABS.map((tab) => {
              const isActive = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all duration-200 shrink-0 ${
                    isActive
                      ? "bg-ocean text-white font-medium shadow-[0_2px_8px_rgba(32,35,69,0.15)]"
                      : "text-ocean/55 hover:text-ocean hover:bg-ocean/[0.04]"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.title}
                </Link>
              );
            })
          )}
        </nav>

        {/* Right cluster: Cmd+K hint + user menu */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Cmd+K trigger */}
          <button
            onClick={() => {
              const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
              window.dispatchEvent(event);
            }}
            title="Suchen (⌘K)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ocean/[0.08] bg-ocean/[0.02] text-xs text-ocean/45 hover:text-ocean hover:border-ocean/[0.15] transition-all"
          >
            <CommandIcon className="h-3 w-3" />
            <span>Suchen</span>
            <kbd className="ml-1 font-mono text-[10px] bg-white rounded border border-ocean/[0.08] px-1">⌘K</kbd>
          </button>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className={`h-9 w-9 flex items-center justify-center rounded-full transition-all ${
                userMenuOpen
                  ? "bg-ocean/[0.06] text-ocean"
                  : "text-ocean/50 hover:text-ocean hover:bg-ocean/[0.04]"
              }`}
              title="Menü"
            >
              <Settings className="h-4 w-4" />
            </button>
            {userMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50 p-1.5">
                {!isAdminSection && (
                  <Link
                    href="/admin"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ocean/70 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4 text-ocean/45" />
                    Admin Konsole
                  </Link>
                )}
                <button
                  onClick={async () => {
                    setUserMenuOpen(false);
                    await supabaseBrowser.auth.signOut();
                    router.push("/login");
                    router.refresh();
                  }}
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
    </div>
  );
}
