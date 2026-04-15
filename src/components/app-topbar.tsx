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
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Check,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Config } from "@/lib/types";

interface Tab {
  title: string;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CLIENT_TABS: Tab[] = [
  { title: "Dashboard", key: "dashboard", icon: BarChart2 },
  { title: "Kontext", key: "information", icon: BookOpen },
  { title: "Skripte", key: "scripts", icon: FileText },
  { title: "Strategie", key: "strategy", icon: BarChart2 },
  { title: "Ideen", key: "ideas", icon: Lightbulb },
  { title: "Audit", key: "analyse", icon: Search },
  { title: "Videos", key: "videos", icon: Video },
  { title: "Chat", key: "chat", icon: MessageSquare },
  { title: "Voice", key: "voice", icon: Mic },
];

export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [clients, setClients] = useState<Config[]>([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/configs").then((r) => r.json()).then(setClients).catch(() => {});
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const clientMatch = pathname.match(/^\/clients\/([^/]+)(?:\/([^/]+))?/);
  const activeClientId = clientMatch?.[1] ?? null;
  const activeTabKey = clientMatch?.[2] ?? (activeClientId ? "dashboard" : null);
  const isAdminKonsole = pathname.startsWith("/admin");
  const activeClient = clients.find((c) => c.id === activeClientId);
  const activeClientName = activeClient?.configName || activeClient?.name || "Kein Client";

  const switchClient = (clientId: string) => {
    setSwitcherOpen(false);
    const tab = activeTabKey && activeTabKey !== "dashboard" ? `/${activeTabKey}` : "/dashboard";
    router.push(`/clients/${clientId}${tab}`);
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
    setClients((prev) => [...prev, created]);
    setSwitcherOpen(false);
    router.push(`/clients/${created.id}/information?setup=1`);
  };

  return (
    <div className="border-b border-ocean/[0.06] bg-white/80 backdrop-blur-xl sticky top-0 z-40">
      {/* top hairline gradient — same as portal */}
      <div className="h-0.5 bg-gradient-to-r from-blush-light via-blush to-ocean/60" />

      <div className="max-w-7xl mx-auto px-6 flex items-center gap-4 h-14">
        {/* Logo */}
        <Link href="/admin" className="shrink-0">
          <h1 className="text-lg font-light tracking-[0.3em] uppercase text-ocean hover:text-ocean-light transition-colors">
            SUN<span className="text-ivory">X</span>CA
          </h1>
        </Link>

        <div className="h-5 w-px bg-ocean/10 shrink-0" />

        {/* Client Switcher */}
        <div className="relative shrink-0" ref={switcherRef}>
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-light transition-all ${
              switcherOpen ? "bg-ocean/[0.05] text-ocean" : "text-ocean/70 hover:text-ocean hover:bg-ocean/[0.03]"
            }`}
          >
            <span>{activeClientName}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
          </button>

          {switcherOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50">
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
                          ? "bg-blush-light/50 text-ocean font-medium"
                          : "text-ocean/70 hover:bg-ocean/[0.03] hover:text-ocean"
                      }`}
                    >
                      <span className="truncate">{name}</span>
                      {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-ivory" />}
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
        <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar flex-1 justify-center">
          {CLIENT_TABS.map((tab) => {
            const href = activeClientId ? `/clients/${activeClientId}/${tab.key}` : "#";
            const disabled = !activeClientId;
            const isActive = !isAdminKonsole && activeTabKey === tab.key;
            return (
              <Link
                key={tab.key}
                href={href}
                onClick={(e) => { if (disabled) e.preventDefault(); }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 shrink-0 ${
                  disabled
                    ? "text-ocean/20 cursor-not-allowed"
                    : isActive
                    ? "bg-blush-light/50 text-ocean font-medium shadow-sm"
                    : "text-ocean/45 hover:text-ocean hover:bg-ocean/[0.03]"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.title}
              </Link>
            );
          })}

          <div className="h-5 w-px bg-ocean/10 mx-2 shrink-0" />

          <Link
            href="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 shrink-0 ${
              isAdminKonsole
                ? "bg-ocean text-white font-medium shadow-sm"
                : "bg-ocean/[0.04] text-ocean/60 hover:bg-ocean/[0.08] hover:text-ocean border border-ocean/10"
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            Admin Konsole
          </Link>
        </nav>

        {/* Logout */}
        <button
          onClick={async () => {
            await supabaseBrowser.auth.signOut();
            router.push("/login");
            router.refresh();
          }}
          className="flex items-center gap-1.5 text-xs text-ocean/40 hover:text-ocean/70 transition-all btn-press shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
