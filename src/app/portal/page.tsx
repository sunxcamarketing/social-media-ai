"use client";

import { useEffect, useState } from "react";
import { FileText, BarChart2, Search, Video } from "lucide-react";
import Link from "next/link";
import { usePortalClient } from "./use-portal-client";

export default function PortalDashboard() {
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [stats, setStats] = useState({ scripts: 0, hasStrategy: false, hasAudit: false, videos: 0 });
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!effectiveClientId) return;

    // Load client name
    fetch(`/api/configs/${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setClientName(data.configName || data.name || ""))
      .catch(() => {});

    // Load stats
    fetch(`/api/scripts?clientId=${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setStats(s => ({ ...s, scripts: Array.isArray(data) ? data.length : 0 })))
      .catch(() => {});

    fetch(`/api/analyses?clientId=${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setStats(s => ({ ...s, hasAudit: Array.isArray(data) && data.length > 0 })))
      .catch(() => {});
  }, [effectiveClientId]);

  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  const cards = [
    { title: "Skripte", description: `${stats.scripts} Skripte erstellt`, href: "/portal/scripts", icon: FileText, color: "text-ocean" },
    { title: "Strategie", description: "Content-Strategie & Wochenplan", href: "/portal/strategy", icon: BarChart2, color: "text-blush-dark" },
    { title: "Audit", description: stats.hasAudit ? "Audit verfügbar" : "Noch kein Audit", href: "/portal/analyse", icon: Search, color: "text-ocean/60" },
    { title: "Videos", description: "Analysierte Videos", href: "/portal/videos", icon: Video, color: "text-ivory" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light text-ocean">
          Willkommen{clientName ? `, ${clientName}` : ""}
        </h1>
        <p className="text-sm text-ocean/50 mt-1">Dein Content-Dashboard</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {cards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="glass rounded-2xl p-6 hover:shadow-md transition-all group"
          >
            <card.icon className={`h-8 w-8 ${card.color} mb-3 group-hover:scale-110 transition-transform`} />
            <h3 className="text-sm font-medium text-ocean">{card.title}</h3>
            <p className="text-xs text-ocean/50 mt-1">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
