"use client";

import { useEffect, useState } from "react";
import { DollarSign, User, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Section } from "@/components/ui/section";

interface CostsResponse {
  days: number;
  entryCount: number;
  adminTotal: number;
  clientTotal: number;
  grandTotal: number;
  byClient: Record<string, { admin: number; client: number; total: number }>;
  byOperation: Record<string, number>;
  byProvider: Record<string, number>;
  byAdminUser: Record<string, { total: number; calls: number }>;
  userLabels: Record<string, string>;
}

interface Config { id: string; configName?: string; name?: string }

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

export default function CostsPage() {
  const [data, setData] = useState<CostsResponse | null>(null);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/costs?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    fetch("/api/configs")
      .then(r => r.json())
      .then((configs: Config[]) => {
        const names: Record<string, string> = {};
        for (const c of configs) names[c.id] = c.configName || c.name || c.id;
        setClientNames(names);
      })
      .catch(() => {});
  }, []);

  const clientRows = data
    ? Object.entries(data.byClient).sort((a, b) => b[1].total - a[1].total)
    : [];
  const operationRows = data
    ? Object.entries(data.byOperation).sort((a, b) => b[1] - a[1])
    : [];
  const providerRows = data
    ? Object.entries(data.byProvider).sort((a, b) => b[1] - a[1])
    : [];
  const adminUserRows = data
    ? Object.entries(data.byAdminUser).sort((a, b) => b[1].total - a[1].total)
    : [];

  const periodSelector = (
    <select
      value={days}
      onChange={e => setDays(Number(e.target.value))}
      className="text-sm rounded-lg border border-ocean/10 bg-white px-3 py-1.5 text-ocean focus:outline-none focus:ring-2 focus:ring-ocean/20"
    >
      <option value={7}>Letzte 7 Tage</option>
      <option value={30}>Letzte 30 Tage</option>
      <option value={90}>Letzte 90 Tage</option>
    </select>
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        icon={DollarSign}
        eyebrow="Admin"
        title="API-Kosten"
        subtitle={data ? `${data.entryCount} getrackte Calls im Zeitraum` : "Lädt…"}
        actions={periodSelector}
      />

      {/* Totals — admin vs client */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Admin (ich)"
          value={loading ? "…" : fmtUsd(data?.adminTotal || 0)}
          sublabel="Von mir getriggert"
          icon={<User className="h-4 w-4" />}
          accent="ocean"
        />
        <StatTile
          label="Client (Portal)"
          value={loading ? "…" : fmtUsd(data?.clientTotal || 0)}
          sublabel="Von Kunden im Portal verbrannt"
          icon={<Users className="h-4 w-4" />}
          accent="blush"
        />
        <StatTile
          label="Gesamt"
          value={loading ? "…" : fmtUsd(data?.grandTotal || 0)}
          sublabel={`Letzte ${days} Tage`}
          icon={<DollarSign className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      {/* Per admin user — only meaningful once there's >1 admin or >0 admin calls */}
      {adminUserRows.length > 0 && (
        <Section title="Pro Admin-User">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-ocean/10 text-ocean/55">
                  <th className="py-2 font-medium">Admin</th>
                  <th className="text-right font-medium">Calls</th>
                  <th className="text-right font-medium">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {adminUserRows.map(([uid, stats]) => (
                  <tr key={uid} className="border-b border-ocean/[0.04] last:border-0">
                    <td className="py-2.5 text-ocean">
                      {uid === "__unknown_admin__"
                        ? <span className="text-ocean/50">(Background-Job / kein User)</span>
                        : data?.userLabels[uid] || uid.slice(0, 8)}
                    </td>
                    <td className="text-right tabular-nums text-ocean/70">{stats.calls}</td>
                    <td className="text-right tabular-nums font-medium text-ocean">{fmtUsd(stats.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Per client */}
      <Section title="Pro Client">
        {clientRows.length === 0 ? (
          <p className="text-sm text-ocean/50">Keine Daten im Zeitraum.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-ocean/10 text-ocean/55">
                  <th className="py-2 font-medium">Client</th>
                  <th className="text-right font-medium">Admin</th>
                  <th className="text-right font-medium">Client</th>
                  <th className="text-right font-medium">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map(([cid, amt]) => (
                  <tr key={cid} className="border-b border-ocean/[0.04] last:border-0">
                    <td className="py-2.5 text-ocean">
                      {cid === "__global__" ? <span className="text-ocean/50">(ohne Client)</span> : clientNames[cid] || cid}
                    </td>
                    <td className="text-right tabular-nums text-ocean/70">{fmtUsd(amt.admin)}</td>
                    <td className="text-right tabular-nums text-ocean/70">{fmtUsd(amt.client)}</td>
                    <td className="text-right tabular-nums font-medium text-ocean">{fmtUsd(amt.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Per operation + per provider side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Pro Operation">
          {operationRows.length === 0 ? (
            <p className="text-sm text-ocean/50">Keine Daten.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {operationRows.map(([op, cost]) => (
                  <tr key={op} className="border-b border-ocean/[0.04] last:border-0">
                    <td className="py-2 text-ocean">{op}</td>
                    <td className="text-right tabular-nums text-ocean/70">{fmtUsd(cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Pro Provider">
          {providerRows.length === 0 ? (
            <p className="text-sm text-ocean/50">Keine Daten.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {providerRows.map(([prov, cost]) => (
                  <tr key={prov} className="border-b border-ocean/[0.04] last:border-0">
                    <td className="py-2 text-ocean capitalize">{prov}</td>
                    <td className="text-right tabular-nums text-ocean/70">{fmtUsd(cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}
