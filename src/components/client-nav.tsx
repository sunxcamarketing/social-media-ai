"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, BarChart2, Search, Video, MessageSquare, Mic, LogOut, Lightbulb } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const tabs = [
  { title: "Dashboard", href: "/portal", icon: BarChart2, exact: true },
  { title: "Skripte", href: "/portal/scripts", icon: FileText },
  { title: "Strategie", href: "/portal/strategy", icon: BarChart2 },
  { title: "Ideen", href: "/portal/ideas", icon: Lightbulb },
  { title: "Audit", href: "/portal/analyse", icon: Search },
  { title: "Videos", href: "/portal/videos", icon: Video },
  { title: "Chat", href: "/portal/chat", icon: MessageSquare },
  { title: "Voice", href: "/portal/voice", icon: Mic },
];

export function ClientNav({ clientName }: { clientName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="border-b border-ocean/[0.06] bg-white/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Logo + Client Name */}
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-light tracking-[0.3em] uppercase text-ocean">
            Sun<span className="text-ivory">x</span>ca
          </h1>
          {clientName && (
            <>
              <div className="h-5 w-px bg-ocean/10" />
              <span className="text-sm text-ocean/60 font-light">{clientName}</span>
            </>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-0.5">
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

        {/* Logout */}
        <button
          onClick={async () => {
            await supabaseBrowser.auth.signOut();
            router.push("/login");
            router.refresh();
          }}
          className="flex items-center gap-1.5 text-xs text-ocean/40 hover:text-ocean/70 transition-all duration-200 btn-press"
        >
          <LogOut className="h-3.5 w-3.5" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
