"use client";

import Link from "next/link";
import {
  Mic,
  Sparkles,
  Search,
  BookOpen,
  Play,
  Users,
  Settings,
  BarChart2,
  MessageSquare,
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
    title: "Pipeline Run",
    description: "Video-Analyse-Pipeline manuell starten",
    href: "/run",
    icon: Play,
    color: "text-ivory",
  },
  {
    title: "Creators",
    description: "Konkurrenz-Creator verwalten",
    href: "/creators",
    icon: Users,
    color: "text-ocean",
  },
  {
    title: "Configs",
    description: "Alle Client-Configs im Überblick",
    href: "/configs",
    icon: Settings,
    color: "text-ocean/70",
  },
  {
    title: "Strategie-Übersicht",
    description: "Globale Strategie-Einstellungen",
    href: "/strategy",
    icon: BarChart2,
    color: "text-blush-dark",
  },
];

export default function AdminKonsolePage() {
  return (
    <div className="space-y-8 animate-in-up">
      <div>
        <h1 className="text-2xl font-light text-ocean">Admin Konsole</h1>
        <p className="text-sm text-ocean/50 mt-1">
          Tools & Verwaltung — alles was Kunden nicht sehen
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="glass rounded-2xl p-6 card-hover group"
          >
            <div className="h-10 w-10 rounded-xl bg-ocean/[0.04] flex items-center justify-center mb-3 group-hover:bg-ocean/[0.07] transition-colors">
              <tool.icon className={`h-5 w-5 ${tool.color} group-hover:scale-110 transition-transform`} />
            </div>
            <h3 className="text-sm font-medium text-ocean">{tool.title}</h3>
            <p className="text-xs text-ocean/50 mt-1 leading-relaxed">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
