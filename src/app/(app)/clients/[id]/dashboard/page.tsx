"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  BarChart2,
  Search,
  Video,
  Lightbulb,
  MessageSquare,
  Mic,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

interface MissingField {
  label: string;
  key: string;
}

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const [clientName, setClientName] = useState("");
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [stats, setStats] = useState({
    scripts: 0,
    ideas: 0,
    videos: 0,
    hasAudit: false,
    hasStrategy: false,
  });

  useEffect(() => {
    if (!id) return;

    fetch(`/api/configs/${id}`)
      .then((r) => r.json())
      .then((cfg) => {
        setClientName(cfg.configName || cfg.name || "");
        setStats((s) => ({ ...s, hasStrategy: Boolean(cfg.strategyPillars) }));

        // Check for important missing fields
        const missing: MissingField[] = [];
        if (!cfg.coreOffer?.trim()) missing.push({ label: "Core Offer (Was wird verkauft?)", key: "coreOffer" });
        if (!cfg.mainGoal?.trim()) missing.push({ label: "Konkretes Ziel", key: "mainGoal" });
        if (!cfg.brandProblem?.trim()) missing.push({ label: "Kernproblem der Zielgruppe", key: "brandProblem" });
        if (!cfg.dreamCustomer?.trim() || cfg.dreamCustomer === "{}") missing.push({ label: "Traumkunde", key: "dreamCustomer" });
        if (!cfg.businessContext?.trim()) missing.push({ label: "Business-Kontext", key: "businessContext" });
        setMissingFields(missing);
      })
      .catch(() => {});

    fetch(`/api/scripts?clientId=${id}`)
      .then((r) => r.json())
      .then((d) => setStats((s) => ({ ...s, scripts: Array.isArray(d) ? d.length : 0 })))
      .catch(() => {});

    fetch(`/api/ideas?clientId=${id}`)
      .then((r) => r.json())
      .then((d) => setStats((s) => ({ ...s, ideas: Array.isArray(d) ? d.length : 0 })))
      .catch(() => {});

    fetch(`/api/analyses?clientId=${id}`)
      .then((r) => r.json())
      .then((d) => setStats((s) => ({ ...s, hasAudit: Array.isArray(d) && d.length > 0 })))
      .catch(() => {});
  }, [id]);

  const cards = [
    {
      title: "Kontext",
      description: "Client-Profil, Branding & Positionierung",
      href: `/clients/${id}/information`,
      icon: BookOpen,
      color: "text-ocean",
    },
    {
      title: "Skripte",
      description: `${stats.scripts} Skripte erstellt`,
      href: `/clients/${id}/scripts`,
      icon: FileText,
      color: "text-blush-dark",
    },
    {
      title: "Strategie",
      description: stats.hasStrategy ? "Content-Strategie aktiv" : "Noch keine Strategie",
      href: `/clients/${id}/strategy`,
      icon: BarChart2,
      color: "text-ivory",
    },
    {
      title: "Ideen",
      description: `${stats.ideas} Content-Ideen`,
      href: `/clients/${id}/ideas`,
      icon: Lightbulb,
      color: "text-blush-dark",
    },
    {
      title: "Audit",
      description: stats.hasAudit ? "Audit verfügbar" : "Noch kein Audit",
      href: `/clients/${id}/analyse`,
      icon: Search,
      color: "text-ocean/60",
    },
    {
      title: "Videos",
      description: "Analysierte Videos",
      href: `/clients/${id}/videos`,
      icon: Video,
      color: "text-ivory",
    },
    {
      title: "Chat",
      description: "Content Agent für diesen Client",
      href: `/clients/${id}/chat`,
      icon: MessageSquare,
      color: "text-ocean",
    },
    {
      title: "Voice",
      description: "Voice-Interview starten",
      href: `/clients/${id}/voice`,
      icon: Mic,
      color: "text-blush-dark",
    },
  ];

  return (
    <div className="space-y-8 animate-in-up">
      <div>
        <h1 className="text-2xl font-light text-ocean">
          {clientName ? clientName : "Client-Dashboard"}
        </h1>
        <p className="text-sm text-ocean/50 mt-1">Übersicht & Schnellzugriff</p>
      </div>

      {missingFields.length > 0 && (
        <Link
          href={`/clients/${id}/information`}
          className="block rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 hover:bg-amber-50/80 transition-colors group"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ocean">
                Profil unvollständig — {missingFields.length} {missingFields.length === 1 ? "Feld fehlt" : "Felder fehlen"}
              </p>
              <p className="text-xs text-ocean/60 mt-1 leading-relaxed">
                Für bessere Strategien und Skripte brauchen wir: {missingFields.map((f) => f.label).join(", ")}.
              </p>
              <span className="inline-block mt-2 text-xs font-medium text-amber-600 group-hover:text-amber-700 transition-colors">
                Jetzt im Profil ergänzen →
              </span>
            </div>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="glass rounded-2xl p-6 card-hover group">
            <div className="h-10 w-10 rounded-xl bg-ocean/[0.04] flex items-center justify-center mb-3 group-hover:bg-ocean/[0.07] transition-colors">
              <card.icon className={`h-5 w-5 ${card.color} group-hover:scale-110 transition-transform`} />
            </div>
            <h3 className="text-sm font-medium text-ocean">{card.title}</h3>
            <p className="text-xs text-ocean/50 mt-1">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
