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
  ChevronDown,
  Plus,
  Check,
  Sparkles,
  LayoutDashboard,
  Users,
  Eye,
  Trash2,
} from "lucide-react";
import { useClientsCache, addClientToCache } from "@/hooks/use-clients-cache";
import type { Config } from "@/lib/types";

interface NavLink {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** For client tabs: sub-path; for admin links: full href. */
  path: string;
}

const CLIENT_TABS: NavLink[] = [
  { title: "Dashboard", path: "dashboard", icon: LayoutDashboard },
  { title: "Profil", path: "information", icon: BookOpen },
  { title: "Skripte", path: "scripts", icon: FileText },
  { title: "Strategie", path: "strategy", icon: BarChart2 },
  { title: "Ideen", path: "ideas", icon: Lightbulb },
  { title: "Audit", path: "analyse", icon: Search },
  { title: "Chat", path: "chat", icon: MessageSquare },
  { title: "Konkurrenz-Analyse", path: "competitors", icon: Video },
];

const ADMIN_LINKS: NavLink[] = [
  { title: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { title: "Content Agent", path: "/chat", icon: MessageSquare },
  { title: "Viral Script", path: "/viral-script", icon: Sparkles },
  { title: "Globales Audit", path: "/analyse", icon: Search },
  { title: "Training", path: "/training", icon: BookOpen },
  { title: "Transkribieren", path: "/transcribe", icon: Mic },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const clients = useClientsCache();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const clientMatch = pathname.match(/^\/clients\/([^/]+)(?:\/([^/]+))?/);
  const activeClientId = clientMatch?.[1] ?? null;
  const activeTabKey = clientMatch?.[2] ?? (activeClientId ? "dashboard" : null);
  const activeClient = clients.find((c) => c.id === activeClientId);
  const activeClientName = activeClient?.configName || activeClient?.name || null;

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

  const impersonate = async (clientId: string) => {
    const res = await fetch("/api/auth/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) { alert("Impersonate fehlgeschlagen"); return; }
    router.push("/portal");
    router.refresh();
  };

  const deleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`"${clientName}" wirklich löschen?`)) return;
    await fetch(`/api/configs?id=${clientId}`, { method: "DELETE" });
    if (activeClientId === clientId) router.push("/admin");
    router.refresh();
  };

  return (
    <aside className="w-60 shrink-0 border-r border-ocean/[0.06] bg-white/50 flex flex-col h-screen sticky top-0">
      {/* Client switcher */}
      <div className="px-3 pt-5 shrink-0" ref={switcherRef}>
        <div className="relative">
          <button
            onClick={() => setSwitcherOpen((v) => !v)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${
              activeClientName
                ? "bg-blush-light/40 text-ocean"
                : "bg-ocean/[0.03] text-ocean/55 hover:text-ocean hover:bg-ocean/[0.05]"
            }`}
          >
            {activeClientName ? (
              <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center text-[11px] font-medium text-blush-dark shrink-0">
                {activeClientName.slice(0, 2).toUpperCase()}
              </div>
            ) : (
              <div className="h-7 w-7 rounded-lg bg-ocean/[0.06] flex items-center justify-center shrink-0">
                <Users className="h-3.5 w-3.5 text-ocean/50" />
              </div>
            )}
            <span className="flex-1 text-left text-sm font-medium truncate">
              {activeClientName || "Client wählen"}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
          </button>

          {switcherOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50">
              <div className="p-2 max-h-72 overflow-y-auto">
                {clients.map((c) => {
                  const isActive = c.id === activeClientId;
                  const name = c.configName || c.name || "Unbenannt";
                  return (
                    <div key={c.id} className="group relative">
                      <button
                        onClick={() => switchClient(c.id)}
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 pr-20 text-sm transition-colors ${
                          isActive
                            ? "bg-ocean text-white font-medium"
                            : "text-ocean/75 hover:bg-ocean/[0.03] hover:text-ocean"
                        }`}
                      >
                        <span className="truncate flex-1 text-left">{name}</span>
                        {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-white/80" />}
                      </button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); impersonate(c.id); }}
                          title={`Als ${name} ansehen`}
                          className="h-6 w-6 flex items-center justify-center rounded-md bg-blush-light/60 text-blush-dark hover:bg-blush-dark hover:text-white transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteClient(c.id, name); }}
                          title="Löschen"
                          className="h-6 w-6 flex items-center justify-center rounded-md text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
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
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto mt-5 px-3 pb-4 space-y-6">
        {activeClientId && (
          <div>
            <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-ocean/35">
              Client
            </p>
            <nav className="space-y-0.5">
              {CLIENT_TABS.map((tab) => {
                const isActive = activeTabKey === tab.path;
                return (
                  <Link
                    key={tab.path}
                    href={`/clients/${activeClientId}/${tab.path}`}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                      isActive
                        ? "bg-ocean text-white font-medium shadow-[0_2px_8px_rgba(32,35,69,0.15)]"
                        : "text-ocean/60 hover:text-ocean hover:bg-ocean/[0.04]"
                    }`}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    <span>{tab.title}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <div>
          <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-ocean/35">
            Admin Konsole
          </p>
          <nav className="space-y-0.5">
            {ADMIN_LINKS.map((link) => {
              const isActive = link.path === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.path) && !pathname.startsWith("/clients");
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                    isActive
                      ? "bg-ocean text-white font-medium shadow-[0_2px_8px_rgba(32,35,69,0.15)]"
                      : "text-ocean/55 hover:text-ocean hover:bg-ocean/[0.04]"
                  }`}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  <span>{link.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
