"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LogOut,
  Menu,
  CalendarDays,
  Mail,
  Check,
  BookOpen,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useI18n } from "@/lib/i18n";
import { useMobileNav } from "@/components/mobile-nav-context";

const SECTION_LABELS: Record<string, { de: string; en: string }> = {
  profil: { de: "Profil", en: "Profile" },
  strategy: { de: "Strategie", en: "Strategy" },
  scripts: { de: "Skripte", en: "Scripts" },
  chat: { de: "Chat", en: "Chat" },
  voice: { de: "Voice", en: "Voice" },
};

type PortalTopbarProps = {
  clientName?: string;
  email?: string;
  invitedAt?: string | null;
};

export function PortalTopbar({ clientName, email, invitedAt }: PortalTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang, t } = useI18n();
  const { toggle: toggleMobileNav } = useMobileNav();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const signOut = async () => {
    setMenuOpen(false);
    await supabaseBrowser.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const section = pathname.split("/")[2] || "";
  const sectionLabel = SECTION_LABELS[section]?.[lang];

  const memberSince = invitedAt ? formatDate(invitedAt, lang) : null;
  const membershipDuration = invitedAt ? formatDuration(invitedAt, lang) : null;

  return (
    <header className="h-14 shrink-0 border-b border-ocean/[0.06] bg-white/75 backdrop-blur-xl sticky top-0 z-40">
      <div className="h-0.5 bg-gradient-to-r from-blush-light via-blush to-ocean/60" />
      <div className="h-full flex items-center gap-2 sm:gap-4 px-3 sm:px-6">
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobileNav}
          className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg text-ocean/70 hover:text-ocean hover:bg-ocean/[0.04] transition-colors shrink-0"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 min-w-0 flex-1 text-sm">
          {clientName && (
            <span className="text-ocean/50 truncate hidden sm:inline">{clientName}</span>
          )}
          {clientName && sectionLabel && <span className="text-ocean/25 hidden sm:inline">/</span>}
          {sectionLabel && <span className="text-ocean font-medium truncate">{sectionLabel}</span>}
          {!sectionLabel && clientName && (
            <span className="text-ocean font-medium truncate sm:hidden">{clientName}</span>
          )}
        </nav>

        {/* Profile menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`flex items-center gap-2 px-2 sm:px-3 h-9 rounded-full transition-all ${
              menuOpen
                ? "bg-ocean/[0.06] text-ocean"
                : "text-ocean/60 hover:text-ocean hover:bg-ocean/[0.04]"
            }`}
          >
            <div className="h-7 w-7 rounded-full bg-blush-light/60 flex items-center justify-center text-[11px] font-medium text-blush-dark shrink-0">
              {(clientName || email || "?").slice(0, 2).toUpperCase()}
            </div>
            <span className="hidden sm:inline text-sm font-medium truncate max-w-[120px]">
              {clientName || email || ""}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl bg-white border border-ocean/[0.06] shadow-[0_8px_32px_rgba(32,35,69,0.08)] overflow-hidden z-50">
              {/* Profile header */}
              <div className="px-4 pt-4 pb-3 border-b border-ocean/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blush-light/60 flex items-center justify-center text-sm font-medium text-blush-dark shrink-0">
                    {(clientName || email || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ocean truncate">{clientName || "—"}</p>
                    {email && (
                      <p className="text-[11px] text-ocean/50 truncate flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        {email}
                      </p>
                    )}
                  </div>
                </div>

                {memberSince && (
                  <div className="mt-3 flex items-start gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-ocean/45 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-ocean/45">
                        {lang === "de" ? "Kunde seit" : "Member since"}
                      </p>
                      <p className="text-xs text-ocean mt-0.5">
                        {memberSince}
                        {membershipDuration && (
                          <span className="text-ocean/45"> · {membershipDuration}</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Language section */}
              <div className="px-4 py-3 border-b border-ocean/[0.05]">
                <p className="text-[10px] uppercase tracking-wider text-ocean/45 mb-2">
                  {lang === "de" ? "Sprache" : "Language"}
                </p>
                <div className="flex gap-1">
                  {(["de", "en"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        lang === l
                          ? "bg-ocean text-white"
                          : "bg-ocean/[0.03] text-ocean/55 hover:bg-ocean/[0.06] hover:text-ocean"
                      }`}
                    >
                      {lang === l && <Check className="h-3 w-3" />}
                      {l === "de" ? "Deutsch" : "English"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="p-1.5">
                <Link
                  href="/portal/profil"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ocean/70 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
                >
                  <BookOpen className="h-4 w-4 text-ocean/45" />
                  {lang === "de" ? "Mein Profil" : "My profile"}
                </Link>
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ocean/70 hover:bg-ocean/[0.03] hover:text-ocean transition-colors"
                >
                  <LogOut className="h-4 w-4 text-ocean/45" />
                  {t("portalNav.logout")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function formatDate(iso: string, lang: "de" | "en"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDuration(iso: string, lang: "de" | "en"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const months = Math.max(
    0,
    (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth()),
  );
  if (months === 0) {
    const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
    if (days === 0) return lang === "de" ? "heute" : "today";
    return lang === "de" ? `seit ${days} Tagen` : `${days} days`;
  }
  if (months < 12) return lang === "de" ? `seit ${months} Monaten` : `${months} months`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (remMonths === 0) {
    return lang === "de"
      ? `seit ${years} Jahr${years === 1 ? "" : "en"}`
      : `${years} year${years === 1 ? "" : "s"}`;
  }
  return lang === "de"
    ? `seit ${years}J ${remMonths}M`
    : `${years}y ${remMonths}m`;
}
