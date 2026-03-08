"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Film, Plus, BookOpen, BarChart2, FileText, Video, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Config } from "@/lib/types";

const clientTabs = [
  { title: "Context",   href: "information", icon: BookOpen  },
  { title: "Strategie", href: "strategy",    icon: BarChart2 },
  { title: "Posts",     href: "scripts",     icon: FileText  },
  { title: "Videos",    href: "videos",      icon: Video     },
  { title: "Creators",  href: "creators",    icon: Users     },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [clients, setClients] = useState<Config[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch?.[1] ?? null;
  const activeTab = pathname.split("/")[3] ?? "information";

  useEffect(() => {
    fetch("/api/configs").then((r) => r.json()).then(setClients).catch(() => {});
  }, []);

  async function createClient() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configName: newName.trim(), creatorsCategory: "" }),
      });
      const created: Config = await res.json();
      setClients((prev) => [...prev, created]);
      setNewOpen(false);
      setNewName("");
      router.push(`/clients/${created.id}/information`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Sidebar className="border-r border-white/[0.06]">
        {/* Logo */}
        <SidebarHeader className="px-5 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 glow-sm">
              <Film className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Virality AI</h1>
              <p className="text-[11px] text-muted-foreground">Instagram Reels AI</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="flex flex-col overflow-hidden">

          {/* ── Client List (top) ── */}
          <div className="flex flex-col px-3 pt-1 pb-3">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Clients</span>
              <button
                onClick={() => setNewOpen(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
              >
                <Plus className="h-3 w-3" /> Neu
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-0.5">
              {clients.map((client) => {
                const isActive = activeClientId === client.id;
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}/information`}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                      isActive
                        ? "bg-white/[0.07] text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-purple-400" : "bg-white/20"}`} />
                    <span className="truncate">{client.configName || client.name || "Unnamed"}</span>
                  </Link>
                );
              })}

              {clients.length === 0 && (
                <p className="px-3 py-4 text-center text-[12px] text-muted-foreground/50">
                  Noch keine Clients
                </p>
              )}
            </div>
          </div>

          {/* ── Divider ── */}
          <div className="mx-4 border-t border-white/[0.06] shrink-0" />

          {/* ── Tabs for active client (bottom) ── */}
          <div className="px-3 py-4 shrink-0">
            {activeClientId ? (
              <>
                <span className="block px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {clients.find((c) => c.id === activeClientId)?.configName ?? "Client"}
                </span>
                <div className="space-y-0.5">
                  {clientTabs.map((tab) => {
                    const isActive = activeTab === tab.href;
                    return (
                      <Link
                        key={tab.href}
                        href={`/clients/${activeClientId}/${tab.href}`}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                          isActive
                            ? "bg-white/[0.07] text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                        }`}
                      >
                        <tab.icon className="h-3.5 w-3.5 shrink-0" />
                        {tab.title}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="px-2 text-[12px] text-muted-foreground/50">
                Wähle einen Client aus
              </p>
            )}
          </div>

        </SidebarContent>
      </Sidebar>

      {/* New Client Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-sm glass border-white/[0.08]">
          <DialogTitle className="text-base font-semibold">Neuer Client</DialogTitle>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                autoFocus
                placeholder="z.B. Max Mustermann"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createClient()}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]"
              />
            </div>
            <Button
              onClick={createClient}
              disabled={!newName.trim() || creating}
              className="w-full rounded-xl h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0"
            >
              {creating ? "Erstelle…" : "Client erstellen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
