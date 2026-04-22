"use client";

import { useEffect, useState } from "react";
import { FileText, BarChart2, BookOpen, Lightbulb } from "lucide-react";
import Link from "next/link";
import { usePortalClient } from "./use-portal-client";
import { useI18n } from "@/lib/i18n";

export default function PortalDashboard() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [stats, setStats] = useState({ scripts: 0, ideas: 0 });
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!effectiveClientId) return;

    fetch(`/api/configs/${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setClientName(data.configName || data.name || ""))
      .catch(() => {});

    fetch(`/api/scripts?clientId=${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setStats(s => ({ ...s, scripts: Array.isArray(data) ? data.length : 0 })))
      .catch(() => {});

    fetch(`/api/ideas?clientId=${effectiveClientId}`)
      .then(r => r.json())
      .then(data => setStats(s => ({ ...s, ideas: Array.isArray(data) ? data.length : 0 })))
      .catch(() => {});
  }, [effectiveClientId]);

  if (authLoading) {
    return <div className="text-center py-20 text-ocean/50">{t("portal.dash.loading")}</div>;
  }

  const cards = [
    { title: t("portal.dash.profile") || "Profil", description: "Dein Business, Zielgruppe, Marke", href: "/portal/profil", icon: BookOpen, color: "text-ocean" },
    { title: t("portal.dash.strategy"), description: "Audit, Performance, Pillars, Wochenplan", href: "/portal/strategy", icon: BarChart2, color: "text-blush-dark" },
    { title: t("portal.dash.scripts"), description: `${stats.scripts} Skripte · Feedback abgeben`, href: "/portal/scripts", icon: FileText, color: "text-ocean/70" },
    { title: "Ideen", description: `${stats.ideas} gespeichert · Neue hinzufügen`, href: "/portal/scripts", icon: Lightbulb, color: "text-blush-dark" },
  ];

  return (
    <div className="space-y-8 animate-in-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-light text-ocean">
          {t("portal.dash.welcome")}{clientName ? `, ${clientName}` : ""}
        </h1>
        <p className="text-sm text-ocean/50 mt-1">{t("portal.dash.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 stagger">
        {cards.map(card => (
          <Link
            key={card.href}
            href={card.href}
            className="glass rounded-2xl p-4 sm:p-6 card-hover group"
          >
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
