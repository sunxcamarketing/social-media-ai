"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, BarChart2, Search, Video, MessageSquare, LogOut } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const tabs = [
  { title: "Dashboard", href: "/portal", icon: BarChart2, exact: true },
  { title: "Skripte", href: "/portal/scripts", icon: FileText },
  { title: "Strategie", href: "/portal/strategy", icon: BarChart2 },
  { title: "Audit", href: "/portal/analyse", icon: Search },
  { title: "Videos", href: "/portal/videos", icon: Video },
  { title: "Chat", href: "/portal/chat", icon: MessageSquare },
];

export function ClientNav({ clientName }: { clientName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="border-b border-ocean/[0.06] bg-white">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
        {/* Logo + Client Name */}
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-light tracking-[0.3em] uppercase text-ocean">
            Sun<span className="text-ivory">x</span>ca
          </h1>
          {clientName && (
            <>
              <div className="h-5 w-px bg-ocean/10" />
              <span className="text-sm text-ocean/70 font-light">{clientName}</span>
            </>
          )}
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? "bg-blush-light/60 text-ocean font-medium"
                    : "text-ocean/50 hover:text-ocean hover:bg-warm-white"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
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
          className="flex items-center gap-1.5 text-xs text-ocean/50 hover:text-ocean transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
