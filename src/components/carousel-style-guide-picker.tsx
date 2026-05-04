"use client";

import { useEffect, useState } from "react";
import {
  Palette,
  ChevronDown,
  Check,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Globe,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CarouselStyleGuide } from "@/lib/types";

interface Props {
  /** Currently active client (so guides can be scoped). */
  clientId: string;
  /** Selected guide id, or null for "no guide". */
  value: string | null;
  /** Disable interaction (e.g. while a generation is running). */
  disabled?: boolean;
  onChange: (id: string | null) => void;
}

export function CarouselStyleGuidePicker({ clientId, value, disabled, onChange }: Props) {
  const [guides, setGuides] = useState<CarouselStyleGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editing, setEditing] = useState<CarouselStyleGuide | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/carousel/style-guides?clientId=${encodeURIComponent(clientId)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as CarouselStyleGuide[];
      setGuides(data);
    } catch {
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const selected = value ? guides.find((g) => g.id === value) : null;

  // Sectioned: globals first, then this client's guides
  const globals = guides.filter((g) => g.clientId === null);
  const clientGuides = guides.filter((g) => g.clientId === clientId);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ocean/10 bg-white px-2.5 py-1.5 text-xs text-ocean/75 hover:text-ocean hover:bg-ocean/[0.03] transition-colors disabled:opacity-50 disabled:cursor-not-allowed max-w-[180px]"
          title={selected ? `Style Guide: ${selected.name}` : "Style Guide auswählen"}
        >
          <Palette className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium">
            {selected ? selected.name : "Kein Style Guide"}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 ml-auto text-ocean/40" />
        </button>

        {open && !disabled && (
          <Dropdown
            globals={globals}
            clientGuides={clientGuides}
            value={value}
            loading={loading}
            onPick={(id) => {
              onChange(id);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
            onCreate={() => {
              setCreating(true);
              setEditing(null);
              setManageOpen(true);
              setOpen(false);
            }}
            onManage={() => {
              setManageOpen(true);
              setEditing(null);
              setCreating(false);
              setOpen(false);
            }}
          />
        )}
      </div>

      <ManageDialog
        open={manageOpen}
        onClose={() => {
          setManageOpen(false);
          setEditing(null);
          setCreating(false);
        }}
        clientId={clientId}
        guides={guides}
        editing={editing}
        startInCreate={creating}
        onEdit={(g) => {
          setEditing(g);
          setCreating(false);
        }}
        onChanged={async () => {
          await refresh();
        }}
        onDeleted={(id) => {
          if (value === id) onChange(null);
          refresh();
        }}
      />
    </>
  );
}

// ── Dropdown panel ────────────────────────────────────────────────────────

interface DropdownProps {
  globals: CarouselStyleGuide[];
  clientGuides: CarouselStyleGuide[];
  value: string | null;
  loading: boolean;
  onPick: (id: string | null) => void;
  onClose: () => void;
  onCreate: () => void;
  onManage: () => void;
}

function Dropdown({
  globals,
  clientGuides,
  value,
  loading,
  onPick,
  onClose,
  onCreate,
  onManage,
}: DropdownProps) {
  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-style-dropdown]")) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      data-style-dropdown
      className="absolute left-0 top-full mt-1 w-72 rounded-xl bg-white border border-ocean/10 shadow-lg z-30 overflow-hidden flex flex-col max-h-[480px]"
    >
      <div className="flex-1 overflow-y-auto p-1.5">
        {/* "None" option */}
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
            value === null
              ? "bg-ocean/[0.05] text-ocean"
              : "hover:bg-ocean/[0.03] text-ocean/70"
          }`}
        >
          <span className="flex-1">Kein Style Guide</span>
          {value === null && <Check className="h-3 w-3 text-ocean" />}
        </button>

        {loading ? (
          <p className="text-xs text-ocean/40 px-2.5 py-3">Lade…</p>
        ) : (
          <>
            <Section
              label="Global"
              icon={<Globe className="h-3 w-3" />}
              items={globals}
              value={value}
              onPick={onPick}
            />
            <Section
              label="Für diesen Client"
              icon={<User className="h-3 w-3" />}
              items={clientGuides}
              value={value}
              onPick={onPick}
            />
            {globals.length === 0 && clientGuides.length === 0 && (
              <p className="text-xs text-ocean/40 px-2.5 py-2">
                Noch keine Style Guides angelegt.
              </p>
            )}
          </>
        )}
      </div>

      <div className="border-t border-ocean/[0.06] p-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={onCreate}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-blush hover:bg-blush-dark text-white transition-colors"
        >
          <Plus className="h-3 w-3" />
          Neu
        </button>
        <button
          type="button"
          onClick={onManage}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-ocean/70 hover:text-ocean hover:bg-ocean/[0.04] border border-ocean/10 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Verwalten
        </button>
      </div>
    </div>
  );
}

function Section({
  label,
  icon,
  items,
  value,
  onPick,
}: {
  label: string;
  icon: React.ReactNode;
  items: CarouselStyleGuide[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-wider text-ocean/45">
        {icon}
        {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onPick(g.id)}
              className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                value === g.id
                  ? "bg-blush-light/40 text-ocean"
                  : "hover:bg-ocean/[0.03] text-ocean/80"
              }`}
            >
              <span className="flex-1 truncate">{g.name}</span>
              {value === g.id && <Check className="h-3 w-3 text-blush-dark shrink-0" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Manage dialog: list + create + edit + delete ──────────────────────────

interface ManageDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  guides: CarouselStyleGuide[];
  editing: CarouselStyleGuide | null;
  startInCreate: boolean;
  onEdit: (g: CarouselStyleGuide) => void;
  onChanged: () => void | Promise<void>;
  onDeleted: (id: string) => void;
}

function ManageDialog({
  open,
  onClose,
  clientId,
  guides,
  editing,
  startInCreate,
  onEdit,
  onChanged,
  onDeleted,
}: ManageDialogProps) {
  const [mode, setMode] = useState<"list" | "form">("list");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync incoming editing/create state when dialog opens
  useEffect(() => {
    if (!open) return;
    if (startInCreate) {
      setMode("form");
      setName("");
      setPrompt("");
      setIsGlobal(false);
      setError(null);
    } else if (editing) {
      setMode("form");
      setName(editing.name);
      setPrompt(editing.prompt);
      setIsGlobal(editing.clientId === null);
      setError(null);
    } else {
      setMode("list");
    }
  }, [open, editing, startInCreate]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        prompt: prompt.trim(),
        clientId: isGlobal ? null : clientId,
      };
      const res = editing
        ? await fetch(`/api/carousel/style-guides/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/carousel/style-guides`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Fehler" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await onChanged();
      setMode("list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function remove(g: CarouselStyleGuide) {
    if (!confirm(`Style Guide "${g.name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/carousel/style-guides/${g.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Fehler" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onDeleted(g.id);
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Löschen fehlgeschlagen");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-blush-dark" />
            {mode === "list"
              ? "Style Guides verwalten"
              : editing
              ? "Style Guide bearbeiten"
              : "Neuen Style Guide anlegen"}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <p className="text-xs text-ocean/55 leading-relaxed">
              Style Guides sind reine Prompt-Bausteine — sie werden zusätzlich zum Brand-Kontext
              an Claude übergeben wenn du ein Karussell generierst oder iterierst. Globale Guides
              kannst du bei jedem Client wählen, client-spezifische gehören nur diesem Brand.
            </p>
            {guides.length === 0 ? (
              <p className="text-sm text-ocean/55 py-6 text-center">
                Noch keine Style Guides.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {guides.map((g) => (
                  <li
                    key={g.id}
                    className="group flex items-start gap-3 rounded-xl border border-ocean/[0.08] px-3 py-2.5 hover:bg-ocean/[0.02] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-ocean truncate">{g.name}</p>
                        {g.clientId === null ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-ocean/[0.05] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-ocean/60">
                            <Globe className="h-2.5 w-2.5" /> Global
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-blush-light/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-blush-dark">
                            <User className="h-2.5 w-2.5" /> Client
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ocean/55 line-clamp-2 mt-0.5">
                        {g.prompt}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEdit(g)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-ocean/40 hover:text-ocean hover:bg-ocean/5 transition-colors"
                        title="Bearbeiten"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(g)}
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-ocean/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => {
                  setMode("form");
                  setName("");
                  setPrompt("");
                  setIsGlobal(false);
                  setError(null);
                }}
                size="sm"
                className="bg-blush hover:bg-blush-dark text-white"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Neuer Style Guide
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="sg-name" className="text-xs">
                Name
              </Label>
              <Input
                id="sg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Bold & Loud"
                className="mt-1 text-sm"
                disabled={saving}
              />
            </div>

            <div>
              <Label htmlFor="sg-prompt" className="text-xs">
                Prompt
              </Label>
              <Textarea
                id="sg-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Beschreibe den Look-and-Feel: Farben, Fonts, Tonalität, was die Slides erreichen sollen, welche visuellen Patterns…"
                rows={10}
                className="mt-1 text-sm font-mono"
                disabled={saving}
              />
              <p className="text-[10px] text-ocean/45 mt-1 leading-relaxed">
                Wird wörtlich an Claude übergeben — schreib als wäre es eine Anweisung an einen
                Designer.
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-ocean/10 px-3 py-2">
              <input
                type="checkbox"
                id="sg-global"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                disabled={saving}
                className="h-3.5 w-3.5 rounded border-ocean/20 accent-blush"
              />
              <Label htmlFor="sg-global" className="text-xs flex-1 cursor-pointer">
                <span className="font-medium">Global</span>
                <span className="text-ocean/50 ml-1">— bei allen Clients verfügbar</span>
              </Label>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMode("list")}
                className="text-xs text-ocean/55 hover:text-ocean px-3 py-2"
                disabled={saving}
              >
                Abbrechen
              </button>
              <Button
                type="button"
                onClick={save}
                disabled={!name.trim() || !prompt.trim() || saving}
                size="sm"
                className="bg-blush hover:bg-blush-dark text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    Speichere…
                  </>
                ) : editing ? (
                  "Aktualisieren"
                ) : (
                  "Anlegen"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
