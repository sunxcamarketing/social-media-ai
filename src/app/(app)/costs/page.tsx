"use client";

import { useEffect, useMemo, useState } from "react";
import { DollarSign, User, Users, ArrowUpDown, ArrowDown, ArrowUp, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Section } from "@/components/ui/section";

interface CostRow {
  clientId: string;
  userId: string | null;
  provider: string;
  model: string;
  operation: string;
  initiator: "admin" | "client";
  costUsd: number;
  day: string; // YYYY-MM-DD
}

interface CostsResponse {
  days: number;
  entryCount: number;
  rows: CostRow[];
  clientLabels: Record<string, string>;
  userLabels: Record<string, string>;
}

const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
const fmtUsd4 = (n: number) => (n < 0.01 ? `<$0.01` : `$${n.toFixed(2)}`);

// ── Helpers ───────────────────────────────────────────────────────────────

function sumBy<T>(rows: T[], pick: (r: T) => number): number {
  let s = 0;
  for (const r of rows) s += pick(r);
  return s;
}

function groupBy<T, K extends string | number>(rows: T[], keyFn: (r: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  return map;
}

// ── Multi-select pill picker ─────────────────────────────────────────────

function MultiPicker({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const summary =
    selected.size === 0
      ? placeholder
      : selected.size === 1
      ? options.find(o => o.value === [...selected][0])?.label || placeholder
      : `${selected.size} ausgewählt`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 h-9 rounded-lg border border-ocean/10 bg-white px-3 text-xs text-ocean hover:border-ocean/20 transition-colors min-w-[140px] max-w-[220px]"
      >
        <span className="text-ocean/40 text-[10px] uppercase tracking-wider font-medium shrink-0">{label}</span>
        <span className="truncate">{summary}</span>
        {selected.size > 0 && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onChange(new Set()); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onChange(new Set());
              }
            }}
            className="text-ocean/40 hover:text-ocean ml-auto"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 top-full mt-1 left-0 min-w-[220px] max-h-[320px] overflow-y-auto rounded-lg border border-ocean/10 bg-white shadow-[0_8px_24px_rgba(32,35,69,0.10)] py-1">
            {options.length === 0 ? (
              <p className="text-xs text-ocean/40 px-3 py-2">Keine Optionen</p>
            ) : (
              options.map(o => {
                const checked = selected.has(o.value);
                return (
                  <button
                    key={o.value}
                    onClick={() => {
                      const next = new Set(selected);
                      if (checked) next.delete(o.value);
                      else next.add(o.value);
                      onChange(next);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-ocean/[0.03] transition-colors ${checked ? "bg-blush-light/40 text-ocean" : "text-ocean/70"}`}
                  >
                    <span className={`h-3 w-3 rounded border ${checked ? "bg-ocean border-ocean" : "border-ocean/20"} shrink-0 flex items-center justify-center`}>
                      {checked && <span className="h-1.5 w-1.5 rounded-sm bg-white" />}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sort indicator ────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (dir === "asc") return <ArrowUp className="h-3 w-3" />;
  if (dir === "desc") return <ArrowDown className="h-3 w-3" />;
  return <ArrowUpDown className="h-3 w-3 opacity-40" />;
}

// ── Time-series mini-chart (SVG) ─────────────────────────────────────────

function TimeSeriesChart({ rows, days }: { rows: CostRow[]; days: number }) {
  const dailyTotals = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days + 1);
    const buckets: { day: string; total: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets.push({ day: d.toISOString().slice(0, 10), total: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.day, i]));
    for (const r of rows) {
      const i = idx.get(r.day);
      if (i !== undefined) buckets[i].total += r.costUsd;
    }
    return buckets;
  }, [rows, days]);

  const max = Math.max(0.01, ...dailyTotals.map(d => d.total));
  const totalSpend = dailyTotals.reduce((s, d) => s + d.total, 0);
  const avgDay = totalSpend / Math.max(1, days);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ocean/40 font-medium">Ø pro Tag</p>
          <p className="text-2xl font-light text-ocean">{fmtUsd(avgDay)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-ocean/40 font-medium">Spitzentag</p>
          <p className="text-2xl font-light text-ocean">{fmtUsd(max)}</p>
        </div>
      </div>
      <div className="flex items-end gap-[2px] h-32 w-full">
        {dailyTotals.map((d, i) => {
          const h = Math.max(2, (d.total / max) * 100);
          const date = new Date(d.day);
          const label = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
          return (
            <div
              key={i}
              className="flex-1 group relative"
              title={`${label}: ${fmtUsd(d.total)}`}
            >
              <div
                style={{ height: `${h}%` }}
                className={`w-full rounded-t-sm transition-all ${
                  d.total >= max * 0.8
                    ? "bg-blush-dark"
                    : d.total >= max * 0.4
                    ? "bg-blush"
                    : "bg-ocean/15"
                } group-hover:opacity-80`}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-ocean text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {label} · {fmtUsd(d.total)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-ocean/40">
        <span>{dailyTotals[0]?.day.slice(5)}</span>
        <span>{dailyTotals[dailyTotals.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

// ── Cross-tab Client × Operation ─────────────────────────────────────────

interface CrossTabRow {
  clientId: string;
  label: string;
  total: number;
  byOp: Record<string, number>;
}

function CrossTab({
  rows,
  clientLabels,
  topOps,
}: {
  rows: CostRow[];
  clientLabels: Record<string, string>;
  topOps: string[];
}) {
  type SortKey = "label" | "total" | string;
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const data = useMemo<CrossTabRow[]>(() => {
    const byClient = groupBy(rows, r => r.clientId);
    const out: CrossTabRow[] = [];
    for (const [cid, rs] of byClient) {
      const byOp: Record<string, number> = {};
      let total = 0;
      for (const r of rs) {
        byOp[r.operation] = (byOp[r.operation] || 0) + r.costUsd;
        total += r.costUsd;
      }
      out.push({
        clientId: cid,
        label: cid === "__global__" ? "(ohne Client)" : clientLabels[cid] || cid.slice(0, 8),
        total,
        byOp,
      });
    }
    return out;
  }, [rows, clientLabels]);

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const va = sortKey === "label" ? a.label : sortKey === "total" ? a.total : (a.byOp[sortKey] || 0);
      const vb = sortKey === "label" ? b.label : sortKey === "total" ? b.total : (b.byOp[sortKey] || 0);
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const dir = (key: SortKey) => sortKey === key ? sortDir : null;
  const maxCellByOp = useMemo(() => {
    const m: Record<string, number> = {};
    for (const op of topOps) {
      let max = 0.01;
      for (const r of data) max = Math.max(max, r.byOp[op] || 0);
      m[op] = max;
    }
    return m;
  }, [data, topOps]);

  if (data.length === 0) {
    return <p className="text-sm text-ocean/50">Keine Daten im Zeitraum.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-ocean/10 text-ocean/55">
            <th
              className="py-2 px-2 font-medium cursor-pointer hover:text-ocean select-none"
              onClick={() => toggleSort("label")}
            >
              <span className="inline-flex items-center gap-1.5">
                Client <SortIcon dir={dir("label")} />
              </span>
            </th>
            {topOps.map(op => (
              <th
                key={op}
                className="text-right font-medium cursor-pointer hover:text-ocean select-none px-2 whitespace-nowrap"
                onClick={() => toggleSort(op)}
              >
                <span className="inline-flex items-center gap-1.5 justify-end">
                  {op} <SortIcon dir={dir(op)} />
                </span>
              </th>
            ))}
            <th
              className="text-right font-semibold cursor-pointer hover:text-ocean select-none px-2"
              onClick={() => toggleSort("total")}
            >
              <span className="inline-flex items-center gap-1.5 justify-end">
                Gesamt <SortIcon dir={dir("total")} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.clientId} className="border-b border-ocean/[0.04] last:border-0 hover:bg-ocean/[0.015]">
              <td className="py-2.5 px-2 text-ocean truncate max-w-[180px]">{r.label}</td>
              {topOps.map(op => {
                const v = r.byOp[op] || 0;
                const max = maxCellByOp[op];
                const w = v > 0 ? Math.max(4, (v / max) * 100) : 0;
                return (
                  <td key={op} className="text-right tabular-nums px-2 relative">
                    {v > 0 ? (
                      <div className="relative">
                        <div className="absolute inset-y-1 right-0 bg-blush/30 rounded-sm" style={{ width: `${w}%` }} />
                        <span className="relative text-ocean/75">{fmtUsd4(v)}</span>
                      </div>
                    ) : (
                      <span className="text-ocean/20">·</span>
                    )}
                  </td>
                );
              })}
              <td className="text-right tabular-nums px-2 font-semibold text-ocean">{fmtUsd(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sortable simple table (per operation, per model) ─────────────────────

function SortableSimpleTable({
  rows,
  columnLabel,
}: {
  rows: { key: string; cost: number; calls: number }[];
  columnLabel: string;
}) {
  const [sortKey, setSortKey] = useState<"key" | "cost" | "calls">("cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const toggle = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };
  const dir = (k: typeof sortKey) => (sortKey === k ? sortDir : null);

  if (rows.length === 0) return <p className="text-sm text-ocean/50">Keine Daten.</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left border-b border-ocean/10 text-ocean/55">
          <th className="py-2 font-medium cursor-pointer hover:text-ocean select-none" onClick={() => toggle("key")}>
            <span className="inline-flex items-center gap-1.5">{columnLabel} <SortIcon dir={dir("key")} /></span>
          </th>
          <th className="text-right font-medium cursor-pointer hover:text-ocean select-none px-2" onClick={() => toggle("calls")}>
            <span className="inline-flex items-center gap-1.5 justify-end">Calls <SortIcon dir={dir("calls")} /></span>
          </th>
          <th className="text-right font-medium cursor-pointer hover:text-ocean select-none" onClick={() => toggle("cost")}>
            <span className="inline-flex items-center gap-1.5 justify-end">Kosten <SortIcon dir={dir("cost")} /></span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map(r => (
          <tr key={r.key} className="border-b border-ocean/[0.04] last:border-0">
            <td className="py-2 text-ocean">{r.key || "(unbekannt)"}</td>
            <td className="text-right tabular-nums text-ocean/55 px-2">{r.calls}</td>
            <td className="text-right tabular-nums font-medium text-ocean">{fmtUsd(r.cost)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CostsPage() {
  const [data, setData] = useState<CostsResponse | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [initiator, setInitiator] = useState<"all" | "admin" | "client">("all");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/costs?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [days]);

  const allRows = data?.rows || [];
  const clientLabels = data?.clientLabels || {};

  // Filter applied to the dataset before any aggregation.
  const filtered = useMemo(() => {
    return allRows.filter(r => {
      if (selectedClients.size > 0 && !selectedClients.has(r.clientId)) return false;
      if (selectedOps.size > 0 && !selectedOps.has(r.operation)) return false;
      if (selectedModels.size > 0 && !selectedModels.has(r.model || "(unknown)")) return false;
      if (initiator !== "all" && r.initiator !== initiator) return false;
      return true;
    });
  }, [allRows, selectedClients, selectedOps, selectedModels, initiator]);

  // Filter-options come from the unfiltered set so users can find clients
  // even if the current filter would hide them.
  const clientOpts = useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) seen.add(r.clientId);
    return [...seen]
      .map(id => ({
        value: id,
        label: id === "__global__" ? "(ohne Client)" : clientLabels[id] || id.slice(0, 8),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows, clientLabels]);

  const opOpts = useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) seen.add(r.operation);
    return [...seen].map(o => ({ value: o, label: o })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  const modelOpts = useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) seen.add(r.model || "(unknown)");
    return [...seen].map(m => ({ value: m, label: m })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  // KPIs from the filtered dataset.
  const adminTotal = useMemo(() => sumBy(filtered.filter(r => r.initiator === "admin"), r => r.costUsd), [filtered]);
  const clientTotal = useMemo(() => sumBy(filtered.filter(r => r.initiator === "client"), r => r.costUsd), [filtered]);
  const grandTotal = adminTotal + clientTotal;

  // Top operations across the filtered set — used as the cross-tab columns.
  const topOps = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of filtered) totals.set(r.operation, (totals.get(r.operation) || 0) + r.costUsd);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([op]) => op);
  }, [filtered]);

  // Per-operation flat table (sortable).
  const perOpRows = useMemo(() => {
    const totals = new Map<string, { cost: number; calls: number }>();
    for (const r of filtered) {
      const e = totals.get(r.operation) || { cost: 0, calls: 0 };
      e.cost += r.costUsd;
      e.calls += 1;
      totals.set(r.operation, e);
    }
    return [...totals.entries()].map(([key, v]) => ({ key, cost: v.cost, calls: v.calls }));
  }, [filtered]);

  // Per-model flat table (sortable).
  const perModelRows = useMemo(() => {
    const totals = new Map<string, { cost: number; calls: number }>();
    for (const r of filtered) {
      const k = r.model || "(unknown)";
      const e = totals.get(k) || { cost: 0, calls: 0 };
      e.cost += r.costUsd;
      e.calls += 1;
      totals.set(k, e);
    }
    return [...totals.entries()].map(([key, v]) => ({ key, cost: v.cost, calls: v.calls }));
  }, [filtered]);

  // Per-admin-user flat table (sortable).
  const perUserRows = useMemo(() => {
    const totals = new Map<string, { cost: number; calls: number }>();
    for (const r of filtered) {
      if (r.initiator !== "admin") continue;
      const k = r.userId || "__unknown_admin__";
      const e = totals.get(k) || { cost: 0, calls: 0 };
      e.cost += r.costUsd;
      e.calls += 1;
      totals.set(k, e);
    }
    return [...totals.entries()].map(([key, v]) => ({
      key: key === "__unknown_admin__"
        ? "(Background-Job / kein User)"
        : data?.userLabels[key] || key.slice(0, 8),
      cost: v.cost,
      calls: v.calls,
    }));
  }, [filtered, data]);

  const anyFilterActive = selectedClients.size > 0 || selectedOps.size > 0 || selectedModels.size > 0 || initiator !== "all";

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={DollarSign}
        eyebrow="Admin"
        title="API-Kosten"
        subtitle={loading ? "Lädt…" : `${filtered.length} von ${data?.entryCount || 0} Calls (Filter aktiv)`}
        actions={periodSelector}
      />

      {/* Filter bar */}
      <div className="rounded-2xl border border-ocean/10 bg-white p-3 flex flex-wrap items-center gap-2">
        <MultiPicker
          label="Client"
          options={clientOpts}
          selected={selectedClients}
          onChange={setSelectedClients}
          placeholder="Alle Clients"
        />
        <MultiPicker
          label="Operation"
          options={opOpts}
          selected={selectedOps}
          onChange={setSelectedOps}
          placeholder="Alle Operationen"
        />
        <MultiPicker
          label="Modell"
          options={modelOpts}
          selected={selectedModels}
          onChange={setSelectedModels}
          placeholder="Alle Modelle"
        />
        <div className="flex items-center gap-1 h-9 rounded-lg border border-ocean/10 bg-white p-1">
          {(["all", "admin", "client"] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setInitiator(v)}
              className={`px-3 h-7 text-xs rounded-md transition-colors ${
                initiator === v ? "bg-ocean text-white" : "text-ocean/55 hover:text-ocean"
              }`}
            >
              {v === "all" ? "Alle" : v === "admin" ? "Admin" : "Client"}
            </button>
          ))}
        </div>
        {anyFilterActive && (
          <button
            type="button"
            onClick={() => {
              setSelectedClients(new Set());
              setSelectedOps(new Set());
              setSelectedModels(new Set());
              setInitiator("all");
            }}
            className="ml-auto text-[11px] text-ocean/55 hover:text-ocean inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Filter zurücksetzen
          </button>
        )}
      </div>

      {/* KPI Cards (filter-aware) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          label="Admin (ich)"
          value={loading ? "…" : fmtUsd(adminTotal)}
          sublabel="Von mir/Team getriggert"
          icon={<User className="h-4 w-4" />}
          accent="ocean"
        />
        <StatTile
          label="Client (Portal)"
          value={loading ? "…" : fmtUsd(clientTotal)}
          sublabel="Von Kunden im Portal"
          icon={<Users className="h-4 w-4" />}
          accent="blush"
        />
        <StatTile
          label="Gesamt"
          value={loading ? "…" : fmtUsd(grandTotal)}
          sublabel={anyFilterActive ? "Mit Filter" : `Letzte ${days} Tage`}
          icon={<DollarSign className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      {/* Time-series mini-chart */}
      <Section title="Tagesverlauf">
        {filtered.length > 0 ? <TimeSeriesChart rows={filtered} days={days} /> : <p className="text-sm text-ocean/50">Keine Daten.</p>}
      </Section>

      {/* Cross-Tab Client × Operation */}
      <Section title="Client × Operation">
        <CrossTab rows={filtered} clientLabels={clientLabels} topOps={topOps} />
        {topOps.length === 6 && (
          <p className="text-[11px] text-ocean/40 mt-2">Top-6 Operationen als Spalten · für komplette Liste den Operation-Filter setzen.</p>
        )}
      </Section>

      {/* Per operation + per model side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Pro Operation">
          <SortableSimpleTable rows={perOpRows} columnLabel="Operation" />
        </Section>
        <Section title="Pro Modell">
          <SortableSimpleTable rows={perModelRows} columnLabel="Modell" />
        </Section>
      </div>

      {/* Per admin user */}
      {perUserRows.length > 0 && (
        <Section title="Pro Admin-User">
          <SortableSimpleTable rows={perUserRows} columnLabel="Admin" />
        </Section>
      )}
    </div>
  );
}
