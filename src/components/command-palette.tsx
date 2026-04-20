"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  ArrowRight,
  BarChart2,
  BookOpen,
  FileText,
  Lightbulb,
  Video,
  MessageSquare,
  Mic,
  LayoutDashboard,
  Settings,
  Film,
} from "lucide-react";
import { useClientsCache } from "@/hooks/use-clients-cache";
import { useI18n } from "@/lib/i18n";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string[];
  group: "client" | "nav" | "tool";
}

const CLIENT_TABS: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "dashboard", label: "Dashboard", icon: BarChart2 },
  { key: "information", label: "Profil", icon: BookOpen },
  { key: "scripts", label: "Skripte", icon: FileText },
  { key: "ideas", label: "Ideen", icon: Lightbulb },
  { key: "strategy", label: "Strategie", icon: BarChart2 },
  { key: "analyse", label: "Audit", icon: Search },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "competitors", label: "Konkurrenz-Analyse", icon: Video },
];

const ADMIN_TOOLS: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Content Agent", icon: MessageSquare },
  { href: "/analyse", label: "Globales Audit", icon: Search },
  { href: "/training", label: "Training", icon: BookOpen },
  { href: "/transcribe", label: "Transkribieren", icon: Mic },
];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const clients = useClientsCache();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeClientId = pathname.match(/^\/clients\/([^/]+)/)?.[1] ?? null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const result: CommandItem[] = [];

    for (const client of clients) {
      const name = client.configName || client.name || "Client";
      result.push({
        id: `client-${client.id}`,
        label: name,
        hint: t("cmdk.openDashboard"),
        icon: Film,
        group: "client",
        keywords: [name.toLowerCase(), client.instagram || ""].filter(Boolean),
        run: () => router.push(`/clients/${client.id}/dashboard`),
      });
    }

    if (activeClientId) {
      for (const tab of CLIENT_TABS) {
        const client = clients.find((c) => c.id === activeClientId);
        const clientName = client ? client.configName || client.name : "";
        result.push({
          id: `tab-${tab.key}`,
          label: tab.label,
          hint: clientName ? t("cmdk.forClient", { name: clientName }) : t("cmdk.groupCurrentClient"),
          icon: tab.icon,
          group: "nav",
          run: () => router.push(`/clients/${activeClientId}/${tab.key}`),
        });
      }
    }

    for (const tool of ADMIN_TOOLS) {
      result.push({
        id: `tool-${tool.href}`,
        label: tool.label,
        hint: t("cmdk.admin"),
        icon: tool.icon,
        group: "tool",
        run: () => router.push(tool.href),
      });
    }

    result.push({
      id: "settings-admin",
      label: t("cmdk.toAdminConsole"),
      icon: Settings,
      group: "tool",
      run: () => router.push("/admin"),
    });

    return result;
  }, [clients, activeClientId, router, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.label, item.hint, ...(item.keywords || [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  const runItem = (item: CommandItem) => {
    setOpen(false);
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) runItem(item);
    }
  };

  if (!open) return null;

  const groupLabels: Record<CommandItem["group"], string> = {
    client: t("cmdk.groupClients"),
    nav: t("cmdk.groupCurrentClient"),
    tool: t("cmdk.groupAdminTools"),
  };

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.group] ||= []).push(item);
    return acc;
  }, {});

  let runningIndex = -1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-ocean/20 backdrop-blur-sm animate-in fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-[0_20px_60px_rgba(32,35,69,0.25)] border border-ocean/[0.06] overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ocean/[0.06]">
          <Search className="h-4 w-4 text-ocean/40 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("cmdk.placeholder")}
            className="flex-1 bg-transparent text-sm text-ocean placeholder:text-ocean/30 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-ocean/35 bg-ocean/[0.04] rounded px-1.5 py-0.5 border border-ocean/[0.06]">ESC</kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ocean/35">{t("cmdk.noResults")}</p>
          )}

          {(["client", "nav", "tool"] as const).map((group) => {
            const groupItems = grouped[group] || [];
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-1">
                <p className="px-5 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-ocean/35">
                  {groupLabels[group]}
                </p>
                {groupItems.map((item) => {
                  runningIndex++;
                  const isActive = runningIndex === activeIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => runItem(item)}
                      onMouseEnter={() => setActiveIndex(runningIndex)}
                      className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left transition-colors ${
                        isActive ? "bg-blush-light/40 text-ocean" : "text-ocean/75 hover:bg-ocean/[0.02]"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blush-dark" : "text-ocean/45"}`} />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.hint && (
                        <span className="text-[11px] text-ocean/35">{item.hint}</span>
                      )}
                      {isActive && <ArrowRight className="h-3.5 w-3.5 text-ocean/40 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4 px-5 py-2.5 border-t border-ocean/[0.06] bg-ocean/[0.01]">
          <div className="flex items-center gap-3 text-[10px] text-ocean/40">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white border border-ocean/[0.08] rounded px-1 py-0.5">↑↓</kbd>
              {t("cmdk.select")}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-white border border-ocean/[0.08] rounded px-1 py-0.5">↵</kbd>
              {t("cmdk.open")}
            </span>
          </div>
          <span className="text-[10px] text-ocean/35">SUNXCA</span>
        </div>
      </div>
    </div>
  );
}
