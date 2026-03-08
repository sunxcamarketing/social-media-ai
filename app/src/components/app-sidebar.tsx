"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Film, Plus, BookOpen, BarChart2, FileText, Video, Users, Globe, Instagram } from "lucide-react";
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

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z" />
    </svg>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [clients, setClients] = useState<Config[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    instagram: "",
    website: "",
    tiktok: "",
    linkedin: "",
  });

  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch?.[1] ?? null;
  const activeTab = pathname.split("/")[3] ?? "information";

  useEffect(() => {
    fetch("/api/configs").then((r) => r.json()).then(setClients).catch(() => {});
  }, []);

  function resetForm() {
    setForm({ name: "", instagram: "", website: "", tiktok: "", linkedin: "" });
  }

  async function createClient() {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configName: form.name.trim(),
          creatorsCategory: "",
          instagram: form.instagram.trim(),
          website: form.website.trim(),
          tiktok: form.tiktok.trim(),
          linkedin: form.linkedin.trim(),
        }),
      });
      const created: Config = await res.json();
      setClients((prev) => [...prev, created]);
      setNewOpen(false);
      resetForm();
      // Navigate with ?setup=1 so the information page auto-runs enrich + follow-up
      router.push(`/clients/${created.id}/information?setup=1`);
    } finally {
      setCreating(false);
    }
  }

  const hasLinks = form.instagram || form.website || form.tiktok || form.linkedin;

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
      <Dialog open={newOpen} onOpenChange={(v) => { if (!v) { setNewOpen(false); resetForm(); } else setNewOpen(true); }}>
        <DialogContent className="sm:max-w-md glass border-white/[0.08]">
          <DialogTitle className="text-base font-semibold">Neuer Client</DialogTitle>
          <p className="text-xs text-muted-foreground -mt-1">
            Gib die Links an — die KI füllt das Profil automatisch aus.
          </p>

          <div className="space-y-3 pt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input
                autoFocus
                placeholder="Max Mustermann"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08]"
              />
            </div>

            {/* Links */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Instagram</Label>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="@handle oder instagram.com/..."
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08] pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                <Input
                  placeholder="www.example.com"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08] pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">TikTok</Label>
                <div className="relative">
                  <TikTokIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    placeholder="@handle"
                    value={form.tiktok}
                    onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
                    className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08] pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                  <Input
                    placeholder="linkedin.com/in/..."
                    value={form.linkedin}
                    onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                    className="h-10 rounded-xl bg-white/[0.04] border-white/[0.08] pl-9"
                  />
                </div>
              </div>
            </div>

            {!hasLinks && form.name && (
              <p className="text-[11px] text-muted-foreground/60">
                💡 Mindestens einen Link angeben damit die KI das Profil automatisch ausfüllen kann.
              </p>
            )}

            <Button
              onClick={createClient}
              disabled={!form.name.trim() || creating}
              className="w-full rounded-xl h-10 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 mt-1"
            >
              {creating ? "Erstelle…" : hasLinks ? "Anlegen & KI-Analyse starten" : "Client anlegen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
