"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  FileText,
  Film,
  MessageSquare,
  Mic,
  LayoutDashboard,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useMobileNav } from "@/components/mobile-nav-context";

type PortalTab = {
  titleKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  comingSoon?: boolean;
};

const PORTAL_TABS: PortalTab[] = [
  { titleKey: "portalNav.dashboard", href: "/portal", icon: LayoutDashboard, exact: true },
  { titleKey: "portalNav.strategy", href: "/portal/strategy", icon: BarChart2 },
  { titleKey: "portalNav.scripts", href: "/portal/scripts", icon: FileText },
  { titleKey: "portalNav.stories", href: "/portal/stories", icon: Film },
  { titleKey: "portalNav.chat", href: "/portal/chat", icon: MessageSquare, comingSoon: true },
  { titleKey: "portalNav.voice", href: "/portal/voice", icon: Mic, comingSoon: true },
];

export function PortalSidebar({ clientName }: { clientName?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { isOpen, close } = useMobileNav();

  return (
    <>
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
        <button
          onClick={close}
          className="md:hidden absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full text-ocean/50 hover:text-ocean hover:bg-ocean/[0.04] transition-colors"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Logo + Client name */}
        <div className="px-4 pt-5 pb-4 shrink-0">
          <h1 className="text-lg font-light tracking-[0.3em] uppercase text-ocean">
            Sun<span className="text-ivory">x</span>ca
          </h1>
          {clientName && (
            <p className="text-xs text-ocean/55 font-light mt-1 truncate">{clientName}</p>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <nav className="space-y-0.5">
            {PORTAL_TABS.map((tab) => {
              const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all ${
                    isActive
                      ? "bg-ocean text-white font-medium shadow-[0_2px_8px_rgba(32,35,69,0.15)]"
                      : tab.comingSoon
                        ? "text-ocean/40 hover:text-ocean/60 hover:bg-ocean/[0.03]"
                        : "text-ocean/60 hover:text-ocean hover:bg-ocean/[0.04]"
                  }`}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{t(tab.titleKey)}</span>
                  {tab.comingSoon && (
                    <span className={`text-[9px] uppercase tracking-wider font-medium rounded-full px-1.5 py-0.5 border ${
                      isActive
                        ? "bg-white/15 text-white/80 border-white/20"
                        : "bg-blush-light/40 text-blush-dark border-blush/20"
                    }`}>
                      {t("comingSoon.badge")}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
