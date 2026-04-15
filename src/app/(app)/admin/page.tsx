"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  FileText,
  Video,
  Lightbulb,
  ArrowRight,
  Sparkles,
  Mic,
  Search,
  BookOpen,
  MessageSquare,
} from "lucide-react";

interface Stats {
  clients: number;
  scripts: number;
  videos: number;
  ideas: number;
}

interface RecentScript {
  id: string;
  title: string;
  clientId: string;
  createdAt: string;
  pillar?: string;
}

interface Config {
  id: string;
  configName?: string;
  name?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentScripts, setRecentScripts] = useState<RecentScript[]>([]);
  const [clients, setClients] = useState<Config[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/configs").then((r) => r.json()).catch(() => []),
      fetch("/api/scripts").then((r) => r.json()).catch(() => []),
      fetch("/api/videos").then((r) => r.json()).catch(() => []),
      fetch("/api/ideas").then((r) => r.json()).catch(() => []),
    ]).then(([configs, scripts, videos, ideas]) => {
      setClients(Array.isArray(configs) ? configs : []);
      setStats({
        clients: Array.isArray(configs) ? configs.length : 0,
        scripts: Array.isArray(scripts) ? scripts.length : 0,
        videos: Array.isArray(videos) ? videos.length : 0,
        ideas: Array.isArray(ideas) ? ideas.length : 0,
      });
      if (Array.isArray(scripts)) {
        const sorted = [...scripts]
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
          .slice(0, 6);
        setRecentScripts(sorted);
      }
    });
  }, []);

  const clientName = (id: string) => {
    const c = clients.find((cl) => cl.id === id);
    return c?.configName || c?.name || "Client";
  };

  const statCards: Array<{ label: string; value: number | null; icon: React.ComponentType<{ className?: string }>; accent: string }> = [
    { label: "Clients", value: stats?.clients ?? null, icon: Users, accent: "text-ocean" },
    { label: "Skripte", value: stats?.scripts ?? null, icon: FileText, accent: "text-blush-dark" },
    { label: "Videos analysiert", value: stats?.videos ?? null, icon: Video, accent: "text-ivory" },
    { label: "Ideen gesammelt", value: stats?.ideas ?? null, icon: Lightbulb, accent: "text-blush-dark" },
  ];

  const quickActions = [
    { title: "Content Agent", description: "Chat mit Zugriff auf alle Clients", href: "/chat", icon: MessageSquare },
    { title: "Viral Script", description: "Skript aus Viral-Video adaptieren", href: "/viral-script", icon: Sparkles },
    { title: "Audit", description: "Instagram-Profil analysieren", href: "/analyse", icon: Search },
    { title: "Transkribieren", description: "Audio/Video zu Text", href: "/transcribe", icon: Mic },
    { title: "Training", description: "Voice-Profile & Training Scripts", href: "/training", icon: BookOpen },
  ];

  return (
    <div className="space-y-10 animate-in-up">
      <div>
        <h1 className="text-2xl font-light text-ocean">Hallo Aysun</h1>
        <p className="text-sm text-ocean/50 mt-1">
          Überblick über deine Agentur
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white border border-ocean/[0.06] p-5 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
            <div className="flex items-center gap-2 mb-3">
              <s.icon className={`h-4 w-4 ${s.accent}`} />
              <span className="text-[11px] text-ocean/50 uppercase tracking-wider">{s.label}</span>
            </div>
            {s.value === null ? (
              <div className="h-9 w-16 rounded-md bg-ocean/[0.06] animate-pulse" />
            ) : (
              <p className="text-3xl font-light text-ocean tabular-nums">{s.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Two-column: Recent scripts + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent activity (2/3 width) */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-ocean/[0.06] p-6 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-ocean">Neueste Skripte</h2>
            <span className="text-[11px] text-ocean/40 uppercase tracking-wider">
              {recentScripts.length > 0 ? `${recentScripts.length} von ${stats?.scripts ?? 0}` : ""}
            </span>
          </div>

          {recentScripts.length === 0 ? (
            <div className="py-8 text-center text-sm text-ocean/40">
              Noch keine Skripte erstellt.
            </div>
          ) : (
            <div className="divide-y divide-ocean/[0.05] -mx-2">
              {recentScripts.map((s) => (
                <Link
                  key={s.id}
                  href={`/clients/${s.clientId}/scripts`}
                  className="group flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-ocean/[0.02] transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-blush-light/40 flex items-center justify-center shrink-0">
                    <FileText className="h-3.5 w-3.5 text-blush-dark" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ocean font-medium truncate">{s.title || "Unbenannt"}</p>
                    <p className="text-xs text-ocean/45 mt-0.5">
                      {clientName(s.clientId)}
                      {s.pillar && ` · ${s.pillar}`}
                      {s.createdAt && ` · ${s.createdAt}`}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-ocean/20 group-hover:text-ocean/60 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions (1/3 width) */}
        <div className="rounded-2xl bg-white border border-ocean/[0.06] p-6 shadow-[0_1px_8px_rgba(32,35,69,0.03)]">
          <h2 className="text-sm font-medium text-ocean mb-5">Schnellzugriff</h2>
          <div className="space-y-1">
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-ocean/[0.03] transition-colors"
              >
                <a.icon className="h-4 w-4 text-ocean/50 shrink-0 group-hover:text-ocean transition-colors" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ocean font-medium">{a.title}</p>
                  <p className="text-[11px] text-ocean/45 truncate">{a.description}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-ocean/[0.06]">
            <p className="text-[11px] text-ocean/40 leading-relaxed">
              Tipp: Drück <kbd className="font-mono bg-ocean/[0.04] rounded px-1 py-0.5 border border-ocean/[0.08]">⌘K</kbd> für die schnelle Suche durch alle Clients &amp; Tools.
            </p>
          </div>
        </div>
      </div>

      {/* Clients grid */}
      {clients.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-ocean mb-4">Deine Clients</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.map((c) => {
              const name = c.configName || c.name || "Unbenannt";
              return (
                <Link
                  key={c.id}
                  href={`/clients/${c.id}/dashboard`}
                  className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-ocean/[0.06] hover:border-ocean/[0.15] hover:shadow-[0_2px_12px_rgba(32,35,69,0.05)] transition-all"
                >
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blush-light to-blush-light/40 flex items-center justify-center shrink-0 text-xs font-medium text-blush-dark">
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-ocean font-medium truncate flex-1">{name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-ocean/20 group-hover:text-ocean/60 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
