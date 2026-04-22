"use client";

import { useEffect, useState } from "react";
import { FileText, BarChart2, Search, Video } from "lucide-react";
import Link from "next/link";
import { usePortalClient } from "./use-portal-client";
import { useI18n } from "@/lib/i18n";

export default function PortalDashboard() {
  const { t } = useI18n();
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
    return <div className="text-center py-20 text-ocean/50">{t("portal.dash.loading")}</div>;
  }

  const cards = [
    { title: t("portal.dash.scripts"), description: t("portal.dash.scriptCount", { count: stats.scripts }), href: "/portal/scripts", icon: FileText, color: "text-ocean" },
    { title: t("portal.dash.strategy"), description: t("portal.dash.strategyDesc"), href: "/portal/strategy", icon: BarChart2, color: "text-blush-dark" },
    { title: t("portal.dash.audit"), description: stats.hasAudit ? t("portal.dash.auditAvailable") : t("portal.dash.noAudit"), href: "/portal/analyse", icon: Search, color: "text-ocean/60" },
    { title: t("portal.dash.videos"), description: t("portal.dash.videoCount"), href: "/portal/videos", icon: Video, color: "text-ivory" },
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
