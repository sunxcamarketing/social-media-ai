"use client";

import { useEffect, useState } from "react";
import { UserPlus, Trash2, Loader2, ShieldCheck, Mail, Pencil, Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminRow {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  isCurrent: boolean;
}

export default function TeamPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Initial load — keeps `loading` at its initial true while fetching, so we
  // never call setState synchronously inside the effect body.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/admins")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setAdmins(Array.isArray(data) ? data : []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Refresh after invite/edit/delete. Safe to call setState here since this
  // runs from a user interaction, not from a render.
  const reload = () => {
    setLoading(true);
    fetch("/api/auth/admins")
      .then((r) => r.json())
      .then((data) => setAdmins(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ ok: true, text: data.message || "Admin eingeladen" });
        setEmail("");
        setFirstName("");
        setLastName("");
        reload();
      } else {
        setMsg({ ok: false, text: data.error || "Einladung fehlgeschlagen" });
      }
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Einladung fehlgeschlagen" });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (row: AdminRow) => {
    const label = displayName(row) || row.email;
    if (!confirm(`Admin-Zugriff für ${label} wirklich entfernen?`)) return;
    const res = await fetch(`/api/auth/admins?id=${encodeURIComponent(row.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Entfernen fehlgeschlagen");
      return;
    }
    reload();
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Admin"
        title="Team"
        subtitle="Wer hat Vollzugriff auf die Agency-Konsole?"
      />

      <Section title="Admin einladen" icon={UserPlus}>
        <form onSubmit={handleInvite} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Vorname"
              className="h-10 rounded-xl bg-warm-white border-ocean/10 text-sm"
              disabled={inviting}
            />
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Nachname"
              className="h-10 rounded-xl bg-warm-white border-ocean/10 text-sm"
              disabled={inviting}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@beispiel.de"
              className="flex-1 h-10 rounded-xl bg-warm-white border-ocean/10 text-sm"
              disabled={inviting}
            />
            <Button
              type="submit"
              disabled={inviting || !email.trim()}
              className="h-10 rounded-xl bg-ocean hover:bg-ocean-light text-white border-0 px-5 text-sm"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Einladen"}
            </Button>
          </div>
        </form>
        <p className="mt-2 text-[11px] text-ocean/55 leading-relaxed">
          Vor- und Nachname sind optional aber empfohlen — werden zur Begrüßung im Dashboard genutzt. Falls die Email schon registriert ist, wird der Account zum Admin upgegradet.
        </p>
        {msg && (
          <p className={`mt-2 text-xs rounded-lg px-3 py-2 ${msg.ok ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
            {msg.text}
          </p>
        )}
      </Section>

      <Section
        title="Aktuelle Admins"
        icon={ShieldCheck}
        action={<span className="text-[11px] text-ocean/40 uppercase tracking-wider">{admins.length}</span>}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-ocean/40" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-ocean/50 py-4">Keine Admins gefunden.</p>
        ) : (
          <div className="rounded-2xl bg-white border border-ocean/[0.06] divide-y divide-ocean/[0.04] overflow-hidden">
            {admins.map((row) => (
              <AdminRowItem
                key={row.id}
                row={row}
                onRemove={() => handleRemove(row)}
                onSaved={reload}
                fmtDate={fmtDate}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function displayName(row: AdminRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
}

function AdminRowItem({
  row, onRemove, onSaved, fmtDate,
}: {
  row: AdminRow;
  onRemove: () => void;
  onSaved: () => void;
  fmtDate: (iso: string | null) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(row.firstName || "");
  const [last, setLast] = useState(row.lastName || "");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setFirst(row.firstName || "");
    setLast(row.lastName || "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auth/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, firstName: first, lastName: last }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Speichern fehlgeschlagen");
        return;
      }
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const name = displayName(row);

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-9 w-9 rounded-lg bg-ocean/[0.05] flex items-center justify-center shrink-0">
        <Mail className="h-4 w-4 text-ocean/60" />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="Vorname"
              className="h-7 text-xs rounded-md w-28"
              disabled={saving}
            />
            <Input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Nachname"
              className="h-7 text-xs rounded-md w-32"
              disabled={saving}
            />
            <span className="text-[11px] text-ocean/40 ml-1">{row.email}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-ocean truncate">
              {name || <span className="text-ocean/40 italic">Ohne Namen</span>}
            </p>
            <span className="text-[11px] text-ocean/50 truncate">{row.email}</span>
            {row.isCurrent && (
              <span className="text-[10px] text-ocean bg-ocean/[0.06] border border-ocean/[0.1] rounded px-1.5 py-0.5 font-medium">Du</span>
            )}
            {!row.acceptedAt && (
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 font-medium">Einladung offen</span>
            )}
          </div>
        )}
        {!editing && (
          <p className="text-[11px] text-ocean/50 mt-0.5">
            {row.acceptedAt
              ? `Aktiv seit ${fmtDate(row.acceptedAt)}`
              : `Eingeladen ${fmtDate(row.invitedAt)}`}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              title="Speichern"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-ocean/40 hover:text-green-600 hover:bg-green-50 transition-colors"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              title="Abbrechen"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-ocean/40 hover:text-ocean hover:bg-ocean/5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={startEdit}
              title="Namen bearbeiten"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-ocean/40 hover:text-ocean hover:bg-ocean/5 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRemove}
              disabled={row.isCurrent}
              title={row.isCurrent ? "Du kannst dich nicht selbst entfernen" : "Admin-Zugriff entfernen"}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-ocean/40 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ocean/40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
