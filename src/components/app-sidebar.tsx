"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, BookOpen, BarChart2, FileText, Video, Users, Globe, Instagram, Youtube, Loader2, Mic, Search, Trash2, LogOut } from "lucide-react";
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
import { useGeneration } from "@/context/generation-context";
import { usePipeline } from "@/context/pipeline-context";
import { useI18n } from "@/lib/i18n";
import { supabaseBrowser } from "@/lib/supabase-browser";

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
  const { t } = useI18n();
  const [clients, setClients] = useState<Config[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    instagram: "",
    website: "",
    tiktok: "",
    youtube: "",
    linkedin: "",
    twitter: "",
  });

  const clientTabs = [
    { title: t("nav.context"),   href: "information", icon: BookOpen  },
    { title: t("nav.strategy"),  href: "strategy",    icon: BarChart2 },
    { title: "Analyse",          href: "analyse",     icon: Search    },
    { title: t("nav.posts"),     href: "scripts",     icon: FileText  },
    { title: t("nav.videos"),    href: "videos",      icon: Video     },
    { title: t("nav.creators"),  href: "creators",    icon: Users     },
  ];

  const { generations, strategyGen, analysisGen, enrichGen, creatorResearchGen } = useGeneration();
  const { running: pipelineRunning, progress: pipelineProgress } = usePipeline();
  const clientMatch = pathname.match(/^\/clients\/([^/]+)/);
  const activeClientId = clientMatch?.[1] ?? null;
  const activeTab = pathname.split("/")[3] ?? "information";

  useEffect(() => {
    fetch("/api/configs").then((r) => r.json()).then(setClients).catch(() => {});
  }, []);

  function resetForm() {
    setForm({ name: "", instagram: "", website: "", tiktok: "", youtube: "", linkedin: "", twitter: "" });
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
          youtube: form.youtube.trim(),
          linkedin: form.linkedin.trim(),
          twitter: form.twitter.trim(),
        }),
      });
      const created: Config = await res.json();
      setClients((prev) => [...prev, created]);
      setNewOpen(false);
      resetForm();
      router.push(`/clients/${created.id}/information?setup=1`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteClient(clientId: string, clientName: string) {
    if (!confirm(`"${clientName}" wirklich löschen?`)) return;
    await fetch(`/api/configs?id=${clientId}`, { method: "DELETE" });
    setClients((prev) => prev.filter((c) => c.id !== clientId));
    if (activeClientId === clientId) {
      router.push("/");
    }
  }

  const hasLinks = form.instagram || form.website || form.tiktok || form.youtube || form.linkedin || form.twitter;

  return (
    <>
      <Sidebar className="border-r border-ocean/[0.06]">
        {/* Logo */}
        <SidebarHeader className="px-5 py-5 shrink-0">
          <h1 className="text-xl font-light tracking-[0.3em] uppercase text-ocean">
            SUN<span className="text-ivory">X</span>CA
          </h1>
        </SidebarHeader>

        <SidebarContent className="flex flex-col overflow-hidden">

          {/* Client List */}
          <div className="flex flex-col px-3 pt-1 pb-3">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-medium uppercase tracking-widest text-ocean/60">{t("nav.clients")}</span>
              <button
                onClick={() => setNewOpen(true)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ocean/65 hover:text-ocean hover:bg-blush-light/50 transition-colors"
              >
                <Plus className="h-3 w-3" /> {t("nav.new")}
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-0.5">
              {clients.map((client) => {
                const isActive = activeClientId === client.id;
                const displayName = client.configName || client.name || "Unnamed";
                return (
                  <div key={client.id} className="group relative">
                    <Link
                      href={`/clients/${client.id}/information`}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                        isActive
                          ? "bg-blush-light/60 text-ocean font-medium"
                          : "text-ocean/70 hover:text-ocean hover:bg-warm-white"
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-ivory" : "bg-ocean/15"}`} />
                      <span className="truncate">{displayName}</span>
                    </Link>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteClient(client.id, displayName); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-lg text-ocean/30 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      title="Löschen"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}

              {clients.length === 0 && (
                <p className="px-3 py-4 text-center text-[12px] text-ocean/60">
                  {t("nav.noClients")}
                </p>
              )}
            </div>
          </div>

          {/* Tools */}
          <div className="px-3 pb-3 shrink-0">
            <span className="block px-2 mb-2 text-[10px] font-medium uppercase tracking-widest text-ocean/60">{t("nav.tools")}</span>
            <div className="space-y-0.5">
              <Link
                href="/training"
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                  pathname.startsWith("/training")
                    ? "bg-blush-light/60 text-ocean font-medium"
                    : "text-ocean/70 hover:text-ocean hover:bg-warm-white"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span>{t("nav.training")}</span>
              </Link>
              <Link
                href="/transcribe"
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                  pathname.startsWith("/transcribe")
                    ? "bg-blush-light/60 text-ocean font-medium"
                    : "text-ocean/70 hover:text-ocean hover:bg-warm-white"
                }`}
              >
                <Mic className="h-3.5 w-3.5 shrink-0" />
                <span>{t("nav.transcribe")}</span>
              </Link>
              <Link
                href="/analyse"
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${
                  pathname.startsWith("/analyse")
                    ? "bg-blush-light/60 text-ocean font-medium"
                    : "text-ocean/70 hover:text-ocean hover:bg-warm-white"
                }`}
              >
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span>Analyse</span>
              </Link>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-ocean/[0.06] shrink-0" />

          {/* Tabs for active client */}
          <div className="px-3 py-4 shrink-0">
            {activeClientId ? (
              <>
                <span className="block px-2 mb-2 text-[10px] font-medium uppercase tracking-widest text-ocean/60">
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
                            ? "bg-blush-light/60 text-ocean font-medium"
                            : "text-ocean/70 hover:text-ocean hover:bg-warm-white"
                        }`}
                      >
                        <tab.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{tab.title}</span>
                        {tab.href === "scripts" && activeClientId && generations.get(activeClientId)?.status === "generating" && (
                          <Loader2 className="h-3 w-3 animate-spin text-ivory shrink-0" />
                        )}
                        {tab.href === "scripts" && activeClientId && generations.get(activeClientId)?.status === "done" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                        )}
                        {tab.href === "videos" && pipelineRunning && (
                          <Loader2 className="h-3 w-3 animate-spin text-ocean/70 shrink-0" />
                        )}
                        {tab.href === "videos" && !pipelineRunning && pipelineProgress?.status === "completed" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                        )}
                        {tab.href === "strategy" && activeClientId && (strategyGen.get(activeClientId)?.status === "running" || analysisGen.get(activeClientId)?.status === "running") && (
                          <Loader2 className="h-3 w-3 animate-spin text-ocean/70 shrink-0" />
                        )}
                        {tab.href === "strategy" && activeClientId && strategyGen.get(activeClientId)?.status === "done" && analysisGen.get(activeClientId)?.status !== "running" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                        )}
                        {tab.href === "information" && activeClientId && enrichGen.get(activeClientId)?.status === "running" && (
                          <Loader2 className="h-3 w-3 animate-spin text-ocean/70 shrink-0" />
                        )}
                        {tab.href === "creators" && activeClientId && creatorResearchGen.get(activeClientId)?.status === "running" && (
                          <Loader2 className="h-3 w-3 animate-spin text-ocean/70 shrink-0" />
                        )}
                        {tab.href === "creators" && activeClientId && creatorResearchGen.get(activeClientId)?.status === "done" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="px-2 text-[12px] text-ocean/60">
                {t("nav.selectClient")}
              </p>
            )}
          </div>

          {/* Logout */}
          <div className="mt-auto px-3 pb-4 shrink-0">
            <button
              onClick={async () => {
                await supabaseBrowser.auth.signOut();
                router.push("/login");
                router.refresh();
              }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-ocean/50 hover:text-ocean hover:bg-warm-white transition-colors w-full"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Abmelden</span>
            </button>
          </div>

        </SidebarContent>
      </Sidebar>

      {/* New Client Dialog */}
      <Dialog open={newOpen} onOpenChange={(v) => { if (!v) { setNewOpen(false); resetForm(); } else setNewOpen(true); }}>
        <DialogContent className="sm:max-w-md bg-white border border-ocean/8 shadow-xl">
          <DialogTitle className="text-base font-medium text-ocean">{t("newClient.title")}</DialogTitle>
          <p className="text-xs text-ocean/70 -mt-1">
            {t("newClient.subtitle")}
          </p>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/70">Name *</Label>
              <Input
                autoFocus
                placeholder={t("newClient.namePlaceholder")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-10 rounded-xl bg-warm-white border-ocean/10 text-ocean placeholder:text-ocean/25 focus:border-blush"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/70">Instagram</Label>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60" />
                <Input
                  placeholder={t("newClient.igPlaceholder")}
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  className="h-10 rounded-xl bg-warm-white border-ocean/10 pl-9 text-ocean placeholder:text-ocean/25 focus:border-blush"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-ocean/70">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60" />
                <Input
                  placeholder="www.example.com"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="h-10 rounded-xl bg-warm-white border-ocean/10 pl-9 text-ocean placeholder:text-ocean/25 focus:border-blush"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-ocean/70">TikTok</Label>
                <div className="relative">
                  <TikTokIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60" />
                  <Input
                    placeholder="@handle"
                    value={form.tiktok}
                    onChange={(e) => setForm({ ...form, tiktok: e.target.value })}
                    className="h-10 rounded-xl bg-warm-white border-ocean/10 pl-9 text-ocean placeholder:text-ocean/25 focus:border-blush"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-ocean/70">YouTube</Label>
                <div className="relative">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60" />
                  <Input
                    placeholder="@channel"
                    value={form.youtube}
                    onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                    className="h-10 rounded-xl bg-warm-white border-ocean/10 pl-9 text-ocean placeholder:text-ocean/25 focus:border-blush"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-ocean/70">LinkedIn</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ocean/60" />
                  <Input
                    placeholder="linkedin.com/in/..."
                    value={form.linkedin}
                    onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                    className="h-10 rounded-xl bg-warm-white border-ocean/10 pl-9 text-ocean placeholder:text-ocean/25 focus:border-blush"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-ocean/70">X / Twitter</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-ocean/60">&#x1D54F;</span>
                  <Input
                    placeholder="@handle"
                    value={form.twitter}
                    onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                    className="h-10 rounded-xl bg-warm-white border-ocean/10 pl-9 text-ocean placeholder:text-ocean/25 focus:border-blush"
                  />
                </div>
              </div>
            </div>

            {!hasLinks && form.name && (
              <p className="text-[11px] text-ocean/65">
                {t("newClient.linkHint")}
              </p>
            )}

            <Button
              onClick={createClient}
              disabled={!form.name.trim() || creating}
              className="w-full rounded-full h-10 bg-ocean hover:bg-ocean-light text-white font-medium tracking-wide border-0 mt-1 transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20"
            >
              {creating ? t("newClient.creating") : hasLinks ? t("newClient.createAndAnalyze") : t("newClient.create")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
