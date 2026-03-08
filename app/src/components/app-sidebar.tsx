"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Film, Plus, BookOpen, BarChart2, FileText, Video, Users, ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
  { title: "Context",   href: "information", icon: BookOpen   },
  { title: "Strategie", href: "strategy",    icon: BarChart2  },
  { title: "Posts",     href: "scripts",     icon: FileText   },
  { title: "Videos",    href: "videos",      icon: Video      },
  { title: "Creators",  href: "creators",    icon: Users      },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [clients, setClients] = useState<Config[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Determine active client id from URL /clients/[id]/...
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch?.[1] ?? null;

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
        <SidebarHeader className="px-5 py-5">
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

        <SidebarContent className="px-3">
          {/* New Client Button */}
          <div className="px-2 mb-3">
            <button
              onClick={() => setNewOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/[0.12] px-3 py-2 text-[12px] text-muted-foreground hover:border-white/20 hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Neuer Client
            </button>
          </div>

          {/* Client List */}
          <SidebarMenu className="gap-1">
            {clients.map((client) => {
              const isActive = activeClientId === client.id;
              const activeTab = pathname.split("/")[3] ?? "information";

              return (
                <SidebarMenuItem key={client.id}>
                  {/* Client Row */}
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="h-9 rounded-xl px-3 transition-all duration-200"
                  >
                    <Link href={`/clients/${client.id}/information`}>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isActive ? "rotate-90" : ""}`} />
                      <span className="text-[13px] font-medium truncate">
                        {client.configName || client.name || "Unnamed"}
                      </span>
                    </Link>
                  </SidebarMenuButton>

                  {/* Per-client tabs — only shown for active client */}
                  {isActive && (
                    <div className="mt-1 mb-1 ml-4 flex flex-col gap-0.5 border-l border-white/[0.06] pl-3">
                      {clientTabs.map((tab) => {
                        const tabActive = activeTab === tab.href;
                        return (
                          <Link
                            key={tab.href}
                            href={`/clients/${client.id}/${tab.href}`}
                            className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors ${
                              tabActive
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
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>

          {clients.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-muted-foreground/60">
              Noch keine Clients.<br />Erstelle deinen ersten.
            </p>
          )}
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
