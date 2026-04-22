"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, BarChart2, Search, Video, MessageSquare, Mic, LogOut, Lightbulb } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/lib/i18n";

export function ClientNav({ clientName }: { clientName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, toggleLang, t } = useI18n();

  const tabs = [
    { title: t("portalNav.dashboard"), href: "/portal", icon: BarChart2, exact: true },
    { title: t("portalNav.scripts"), href: "/portal/scripts", icon: FileText },
    { title: t("portalNav.strategy"), href: "/portal/strategy", icon: BarChart2 },
    { title: t("portalNav.ideas"), href: "/portal/ideas", icon: Lightbulb },
    { title: t("portalNav.audit"), href: "/portal/analyse", icon: Search },
    { title: t("portalNav.videos"), href: "/portal/videos", icon: Video },
    { title: t("portalNav.chat"), href: "/portal/chat", icon: MessageSquare },
    { title: t("portalNav.voice"), href: "/portal/voice", icon: Mic },
  ];

  return (
    <div className="border-b border-ocean/[0.06] bg-white/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Top row: logo + name + actions */}
        <div className="flex items-center justify-between gap-3 h-14">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-base sm:text-lg font-light tracking-[0.2em] sm:tracking-[0.3em] uppercase text-ocean shrink-0">
              Sun<span className="text-ivory">x</span>ca
            </h1>
            {clientName && (
              <>
                <div className="hidden sm:block h-5 w-px bg-ocean/10" />
                <span className="text-xs sm:text-sm text-ocean/60 font-light truncate">{clientName}</span>
              </>
            )}
          </div>

          {/* Desktop tabs (inline) */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {tabs.map((tab) => {
              const isActive = tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                    isActive
                      ? "bg-blush-light/50 text-ocean font-medium shadow-sm"
                      : "text-ocean/45 hover:text-ocean hover:bg-ocean/[0.03]"
                  }`}
                >
                  <tab.icon className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-105"}`} />
                  {tab.title}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 rounded-full border border-ocean/8 px-2 sm:px-2.5 py-1 text-[11px] font-medium text-ocean/60 hover:text-ocean hover:border-ocean/15 transition-all duration-200"
            >
              <span>{lang === "de" ? "DE" : "EN"}</span>
              <span className="text-ocean/30">|</span>
              <span className="text-ocean/30">{lang === "de" ? "EN" : "DE"}</span>
            </button>

            {/* Logout */}
            <button
              onClick={async () => {
                await supabaseBrowser.auth.signOut();
                router.push("/login");
                router.refresh();
              }}
              className="flex items-center gap-1.5 text-xs text-ocean/40 hover:text-ocean/70 transition-all duration-200 btn-press"
              title={t("portalNav.logout")}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("portalNav.logout")}</span>
            </button>
          </div>
        </div>

        {/* Mobile/tablet tabs (horizontal scroll) */}
        <nav className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 flex items-center gap-1 overflow-x-auto border-t border-ocean/[0.04] py-2 no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all duration-200 shrink-0 ${
                  isActive
                    ? "bg-blush-light/50 text-ocean font-medium shadow-sm"
                    : "text-ocean/45 hover:text-ocean hover:bg-ocean/[0.03]"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
