"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Mic,
  Sparkles,
  Search,
  BookOpen,
  Users,
  BarChart2,
  MessageSquare,
  FileText,
  Video,
  Lightbulb,
} from "lucide-react";

interface Tool {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const TOOLS: Tool[] = [
  {
    title: "Content Agent (Global)",
    description: "Chat über alle Clients — Listen, Skripte, Recherche",
    href: "/chat",
    icon: MessageSquare,
    color: "text-ivory",
  },
  {
    title: "Transkribieren",
    description: "Audio- & Video-Transkription für Voice-Profile",
    href: "/transcribe",
    icon: Mic,
    color: "text-blush-dark",
  },
  {
    title: "Viral Script",
    description: "Psychologie-basierte Skript-Adaption aus Viral-Videos",
    href: "/viral-script",
    icon: Sparkles,
    color: "text-ivory",
  },
  {
    title: "Viral Builder",
    description: "Virality-Checkliste für bestehende Skripte",
    href: "/viral-builder",
    icon: Sparkles,
    color: "text-ocean",
  },
  {
    title: "Globales Audit",
    description: "Audit für beliebigen Instagram-Account",
    href: "/analyse",
    icon: Search,
    color: "text-ocean/70",
  },
  {
    title: "Training Scripts",
    description: "Client-Trainingsskripte verwalten & syncen",
    href: "/training",
    icon: BookOpen,
    color: "text-blush-dark",
  },
  {
    title: "Strategie-Übersicht",
    description: "Globale Strategie-Einstellungen",
    href: "/strategy",
    icon: BarChart2,
    color: "text-blush-dark",
  },
];

interface Stats {
  clients: number;
  scripts: number;
  videos: number;
  ideas: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/configs").then((r) => r.json()).catch(() => []),
      fetch("/api/scripts").then((r) => r.json()).catch(() => []),
      fetch("/api/videos").then((r) => r.json()).catch(() => []),
      fetch("/api/ideas").then((r) => r.json()).catch(() => []),
    ]).then(([configs, scripts, videos, ideas]) => {
      setStats({
        clients: Array.isArray(configs) ? configs.length : 0,
        scripts: Array.isArray(scripts) ? scripts.length : 0,
        videos: Array.isArray(videos) ? videos.length : 0,
        ideas: Array.isArray(ideas) ? ideas.length : 0,
      });
    });
  }, []);

  const statCards: Array<{ label: string; value: number | null; icon: React.ComponentType<{ className?: string }>; color: string }> = [
    { label: "Clients", value: stats?.clients ?? null, icon: Users, color: "text-ocean" },
    { label: "Skripte", value: stats?.scripts ?? null, icon: FileText, color: "text-blush-dark" },
    { label: "Videos analysiert", value: stats?.videos ?? null, icon: Video, color: "text-ivory" },
    { label: "Ideen gesammelt", value: stats?.ideas ?? null, icon: Lightbulb, color: "text-blush-dark" },
  ];

  return (
    <div className="space-y-10 animate-in-up">
      <div>
        <h1 className="text-2xl font-light text-ocean">Admin Dashboard</h1>
        <p className="text-sm text-ocean/50 mt-1">
          Überblick & Tools — alles was Kunden nicht sehen
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {statCards.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-xs text-ocean/50 uppercase tracking-wider">{s.label}</span>
            </div>
            {s.value === null ? (
              <div className="h-9 w-16 rounded-md bg-ocean/[0.06] animate-pulse" />
            ) : (
              <p className="text-3xl font-light text-ocean tabular-nums">{s.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Tools */}
      <div>
        <h2 className="text-xs font-medium text-ocean/50 uppercase tracking-wider mb-4">
          Tools & Verwaltung
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {TOOLS.map((tool) => (
            <Link key={tool.href} href={tool.href} className="glass rounded-2xl p-6 card-hover group">
              <div className="h-10 w-10 rounded-xl bg-ocean/[0.04] flex items-center justify-center mb-3 group-hover:bg-ocean/[0.07] transition-colors">
                <tool.icon className={`h-5 w-5 ${tool.color} group-hover:scale-110 transition-transform`} />
              </div>
              <h3 className="text-sm font-medium text-ocean">{tool.title}</h3>
              <p className="text-xs text-ocean/50 mt-1 leading-relaxed">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
