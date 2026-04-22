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
  LayoutDashboard,
  Users,
  Eye,
  Trash2,
  Grid3x3,
  X,
} from "lucide-react";
import { useClientsCache } from "@/hooks/use-clients-cache";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useI18n } from "@/lib/i18n";
import { useMobileNav } from "@/components/mobile-nav-context";

interface NavLink {
  titleKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** For client tabs: sub-path; for admin links: full href. */
  path: string;
  /** If true, only visible to admins. */
  adminOnly?: boolean;
}

const CLIENT_TABS: NavLink[] = [
  { titleKey: "sidebar.dashboard", path: "dashboard", icon: LayoutDashboard },
  { titleKey: "sidebar.profile", path: "information", icon: BookOpen },
  { titleKey: "sidebar.scripts", path: "scripts", icon: FileText },
  { titleKey: "sidebar.strategy", path: "strategy", icon: BarChart2 },
  { titleKey: "sidebar.ideas", path: "ideas", icon: Lightbulb },
  { titleKey: "sidebar.chat", path: "chat", icon: MessageSquare },
  { titleKey: "sidebar.voice", path: "voice", icon: Mic },
  { titleKey: "sidebar.carousel", path: "carousel", icon: Grid3x3, adminOnly: true },
  { titleKey: "sidebar.competitorAnalysis", path: "competitors", icon: Video },
];

const ADMIN_LINKS: NavLink[] = [
  { titleKey: "sidebar.dashboard", path: "/admin", icon: LayoutDashboard },
  { titleKey: "sidebar.contentAgent", path: "/chat", icon: MessageSquare },
  { titleKey: "sidebar.globalAudit", path: "/analyse", icon: Search },
  { titleKey: "sidebar.training", path: "/training", icon: BookOpen },
  { titleKey: "sidebar.transcribe", path: "/transcribe", icon: Mic },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { isAdmin } = useCurrentUser();
  const { isOpen, close } = useMobileNav();

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

  const createClient = () => {
    setSwitcherOpen(false);
    router.push("/clients/new");
  };

  const impersonate = async (clientId: string) => {
    const res = await fetch("/api/auth/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) { alert(t("sidebar.impersonateFailed")); return; }
    router.push("/portal");
    router.refresh();
  };

  const deleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(t("sidebar.confirmDelete", { name: clientName }))) return;
    await fetch(`/api/configs?id=${clientId}`, { method: "DELETE" });
    if (activeClientId === clientId) router.push("/admin");
    router.refresh();
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={close}
        className={`md:hidden fixed inset-0 z-40 bg-ocean/40 backdrop-blur-sm transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      />
    <aside
      className={`w-64 md:w-60 shrink-0 border-r border-ocean/[0.06] bg-white flex flex-col h-screen z-50
        fixed inset-y-0 left-0 transition-transform duration-200 ease-out
        md:sticky md:top-0 md:translate-x-0 md:bg-white/50
        ${isOpen ? "translate-x-0 shadow-[0_8px_32px_rgba(32,35,69,0.15)]" : "-translate-x-full md:translate-x-0"}`}
    >
      {/* Mobile close button */}
      <button
        onClick={close}
        className="md:hidden absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full text-ocean/50 hover:text-ocean hover:bg-ocean/[0.04] transition-colors"
        aria-label="Close menu"
      >
        <X className="h-4 w-4" />
      </button>

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
              {activeClientName || t("sidebar.selectClient")}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
          </button>

          {switcherOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50">
              <div className="p-2 max-h-72 overflow-y-auto">
                {clients.map((c) => {
                  const isActive = c.id === activeClientId;
                  const name = c.configName || c.name || t("sidebar.unnamed");
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
                          title={t("sidebar.impersonate", { name })}
                          className="h-6 w-6 flex items-center justify-center rounded-md bg-blush-light/60 text-blush-dark hover:bg-blush-dark hover:text-white transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteClient(c.id, name); }}
                          title={t("sidebar.delete")}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {clients.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-ocean/40">{t("sidebar.noClients")}</p>
                )}
              </div>
              <button
                onClick={createClient}
                className="w-full flex items-center gap-2 border-t border-ocean/[0.06] px-4 py-2.5 text-xs text-ocean/60 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("sidebar.createNewClient")}
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
              {t("sidebar.sectionClient")}
            </p>
            <nav className="space-y-0.5">
              {CLIENT_TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => {
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
                    <span>{t(tab.titleKey)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <div>
          <p className="px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-ocean/35">
            {t("sidebar.adminConsole")}
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
                  <span>{t(link.titleKey)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
    </>
  );
}
