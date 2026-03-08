"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Globe,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  MapPin,
  Briefcase,
  User,
  Pencil,
  Sparkles,
  Loader2,
  Heart,
  Users,
  MessageSquare,
  Plus,
  CheckCircle2,
} from "lucide-react";
import type { Config } from "@/lib/types";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.75a4.85 4.85 0 0 1-1.02-.06z" />
    </svg>
  );
}

function SocialLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-white/[0.08] text-sm text-muted-foreground hover:text-foreground hover:border-white/[0.15] transition-all">
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  iconColor,
  title,
  onEdit,
  children,
  empty,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} /> {title}
        </h2>
        <Button variant="ghost" size="sm" onClick={onEdit}
          className="h-7 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground">
          <Pencil className="h-3 w-3" /> Edit
        </Button>
      </div>
      {empty ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">No information added yet.</p>
          <Button variant="ghost" size="sm" onClick={onEdit}
            className="mt-2 rounded-xl text-xs text-muted-foreground hover:text-foreground gap-1">
            <Pencil className="h-3 w-3" /> Add information
          </Button>
        </div>
      ) : children}
    </div>
  );
}

interface DreamCustomer {
  tonality: string;
  age: string;
  gender: string;
  income: string;
  country: string;
  profession: string;
  values: string;
  description: string;
}

interface CustomerProblems {
  mental: string;
  physical: string;
  financial: string;
  social: string;
  aesthetic: string;
}

function parseDreamCustomer(val: string): DreamCustomer {
  try { return JSON.parse(val); } catch { return { tonality: "", age: "", gender: "", income: "", country: "", profession: "", values: "", description: "" }; }
}

function parseCustomerProblems(val: string): CustomerProblems {
  try { return JSON.parse(val); } catch { return { mental: "", physical: "", financial: "", social: "", aesthetic: "" }; }
}

export default function ClientInformationPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Config | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [addInfoOpen, setAddInfoOpen] = useState(false);
  const [addInfoText, setAddInfoText] = useState("");
  const [addInfoLoading, setAddInfoLoading] = useState(false);
  const [addInfoResult, setAddInfoResult] = useState<string | null>(null);

  // Edit dialog state
  const [basicOpen, setBasicOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Forms
  const [basicForm, setBasicForm] = useState({
    name: "", company: "", role: "", location: "",
    businessContext: "", professionalBackground: "", keyAchievements: "",
    website: "", instagram: "", tiktok: "", youtube: "", linkedin: "", twitter: "",
  });
  const [brandForm, setBrandForm] = useState({
    brandFeeling: "",
    brandProblem: "",
    dreamCustomer: { tonality: "", age: "", gender: "", income: "", country: "", profession: "", values: "", description: "" },
  });
  const [customerForm, setCustomerForm] = useState({
    customerProblems: { mental: "", physical: "", financial: "", social: "", aesthetic: "" },
    providerRole: "",
    providerBeliefs: "",
    providerStrengths: "",
    authenticityZone: "",
  });
  const [messageForm, setMessageForm] = useState({
    brandingStatement: "",
    humanDifferentiation: "",
  });

  const loadClient = () =>
    fetch(`/api/configs/${id}`).then((r) => r.json() as Promise<Config>);

  useEffect(() => { loadClient().then(setClient); }, [id]);

  const handleAutoFill = async () => {
    setEnriching(true);
    setEnrichError(null);
    try {
      const res = await fetch(`/api/configs/${id}/enrich`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Auto-fill failed");
      }
      await loadClient().then(setClient);
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Auto-fill failed");
    } finally {
      setEnriching(false);
    }
  };

  const handleAddInfo = async () => {
    if (!addInfoText.trim()) return;
    setAddInfoLoading(true);
    setAddInfoResult(null);
    try {
      const res = await fetch(`/api/configs/${id}/add-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: addInfoText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const count = Object.keys(data.updated || {}).length;
      setAddInfoResult(data.message || `Updated ${count} field${count !== 1 ? "s" : ""}.`);
      setAddInfoText("");
      await loadClient().then(setClient);
    } catch (e) {
      setAddInfoResult(e instanceof Error ? e.message : "Failed to add information.");
    } finally {
      setAddInfoLoading(false);
    }
  };

  const savePartial = async (partial: Partial<Config>) => {
    if (!client) return;
    setSaving(true);
    await fetch("/api/configs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...client, ...partial }),
    });
    setSaving(false);
    await loadClient().then(setClient);
  };

  const openBasic = () => {
    if (!client) return;
    setBasicForm({
      name: client.name || "", company: client.company || "",
      role: client.role || "", location: client.location || "",
      businessContext: client.businessContext || "",
      professionalBackground: client.professionalBackground || "",
      keyAchievements: client.keyAchievements || "",
      website: client.website || "", instagram: client.instagram || "",
      tiktok: client.tiktok || "", youtube: client.youtube || "",
      linkedin: client.linkedin || "", twitter: client.twitter || "",
    });
    setBasicOpen(true);
  };

  const openBrand = () => {
    if (!client) return;
    setBrandForm({
      brandFeeling: client.brandFeeling || "",
      brandProblem: client.brandProblem || "",
      dreamCustomer: parseDreamCustomer(client.dreamCustomer || ""),
    });
    setBrandOpen(true);
  };

  const openCustomer = () => {
    if (!client) return;
    setCustomerForm({
      customerProblems: parseCustomerProblems(client.customerProblems || ""),
      providerRole: client.providerRole || "",
      providerBeliefs: client.providerBeliefs || "",
      providerStrengths: client.providerStrengths || "",
      authenticityZone: client.authenticityZone || "",
    });
    setCustomerOpen(true);
  };

  const openMessage = () => {
    if (!client) return;
    setMessageForm({
      brandingStatement: client.brandingStatement || "",
      humanDifferentiation: client.humanDifferentiation || "",
    });
    setMessageOpen(true);
  };

  if (!client) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading…</div>;
  }

  const hasSocials = client.instagram || client.tiktok || client.youtube || client.linkedin || client.twitter || client.website;
  const dc = parseDreamCustomer(client.dreamCustomer || "");
  const cp = parseCustomerProblems(client.customerProblems || "");

  const dcRows = [
    { label: "Tonality", value: dc.tonality },
    { label: "Age", value: dc.age },
    { label: "Gender", value: dc.gender },
    { label: "Income", value: dc.income },
    { label: "Country", value: dc.country },
    { label: "Profession", value: dc.profession },
    { label: "Values", value: dc.values },
  ].filter((r) => r.value);

  const cpRows = [
    { label: "Mental", value: cp.mental },
    { label: "Physical", value: cp.physical },
    { label: "Financial", value: cp.financial },
    { label: "Social", value: cp.social },
    { label: "Aesthetic", value: cp.aesthetic },
  ].filter((r) => r.value);

  const basicEmpty = !client.name && !client.company && !client.role && !client.businessContext;
  const brandEmpty = !client.brandFeeling && !client.brandProblem && !client.dreamCustomer;
  const customerEmpty = !client.customerProblems && !client.providerRole && !client.providerBeliefs && !client.providerStrengths && !client.authenticityZone;
  const messageEmpty = !client.brandingStatement && !client.humanDifferentiation;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-red-500/20 border border-rose-500/20">
            <User className="h-6 w-6 text-rose-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name || client.configName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {client.role && <span className="text-sm text-muted-foreground">{client.role}</span>}
              {client.role && client.company && <span className="text-muted-foreground/40">·</span>}
              {client.company && <span className="text-sm text-muted-foreground">{client.company}</span>}
              {client.location && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />{client.location}
                  </span>
                </>
              )}
            </div>
            <div className="mt-2">
              <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                {client.creatorsCategory}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setAddInfoOpen(true); setAddInfoResult(null); }}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add info
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAutoFill}
            disabled={enriching || (!client.instagram && !client.website && !client.linkedin && !client.tiktok && !client.youtube)}
            className="h-8 gap-1.5 rounded-lg px-3 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
          >
            {enriching ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Filling…</>
            ) : (
              <><Sparkles className="h-3 w-3" /> Auto-fill</>
            )}
          </Button>
        </div>
      </div>

      {enrichError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {enrichError}
        </div>
      )}
      {enriching && (
        <div className="rounded-xl glass border border-rose-500/20 px-4 py-3 text-sm text-muted-foreground">
          Scraping profiles and extracting information with AI… this takes 15–30 seconds.
        </div>
      )}

      {/* Social Links */}
      {hasSocials && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Links</h2>
          <div className="flex flex-wrap gap-2">
            <SocialLink href={client.website} icon={Globe} label={client.website} />
            <SocialLink href={client.instagram} icon={Instagram} label={`@${client.instagram.replace(/^@/, "")}`} />
            <SocialLink href={client.tiktok} icon={TikTokIcon} label={`@${client.tiktok.replace(/^@/, "")}`} />
            <SocialLink href={client.youtube} icon={Youtube} label={client.youtube} />
            <SocialLink href={client.linkedin} icon={Linkedin} label={client.linkedin} />
            <SocialLink href={client.twitter} icon={Twitter} label={`@${client.twitter.replace(/^@/, "")}`} />
          </div>
        </div>
      )}

      {/* Basic Info */}
      <SectionCard icon={Briefcase} iconColor="text-rose-400" title="Basic Information" onEdit={openBasic} empty={basicEmpty}>
        <div className="space-y-5">
          {(client.name || client.company || client.role || client.location) && (
            <div className="grid gap-5 md:grid-cols-2">
              <InfoRow label="Name" value={client.name} />
              <InfoRow label="Company" value={client.company} />
              <InfoRow label="Role" value={client.role} />
              <InfoRow label="Location" value={client.location} />
            </div>
          )}
          {(client.businessContext || client.professionalBackground || client.keyAchievements) && (
            <div className="border-t border-white/[0.06] pt-5 space-y-5">
              <InfoRow label="Business Context" value={client.businessContext} />
              <InfoRow label="Professional Background" value={client.professionalBackground} />
              <InfoRow label="Key Achievements" value={client.keyAchievements} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Brand Identity */}
      <SectionCard icon={Heart} iconColor="text-rose-400" title="Brand Identity" onEdit={openBrand} empty={brandEmpty}>
        <div className="space-y-5">
          <InfoRow label="Feeling you sell" value={client.brandFeeling} />
          <InfoRow label="Core problem you solve" value={client.brandProblem} />
          {dcRows.length > 0 && (
            <div className="border-t border-white/[0.06] pt-5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Dream Customer Profile</p>
              <div className="grid gap-3 md:grid-cols-2">
                {dcRows.map((r) => (
                  <InfoRow key={r.label} label={r.label} value={r.value} />
                ))}
              </div>
              {dc.description && (
                <div className="mt-4">
                  <InfoRow label="Description" value={dc.description} />
                </div>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Customer & Problem */}
      <SectionCard icon={Users} iconColor="text-sky-400" title="Customer & Problem" onEdit={openCustomer} empty={customerEmpty}>
        <div className="space-y-5">
          {cpRows.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Customer Problems</p>
              <div className="grid gap-3 md:grid-cols-2">
                {cpRows.map((r) => (
                  <InfoRow key={r.label} label={r.label} value={r.value} />
                ))}
              </div>
            </div>
          )}
          {(client.providerRole || client.providerBeliefs || client.providerStrengths || client.authenticityZone) && (
            <div className="border-t border-white/[0.06] pt-5 space-y-5">
              <InfoRow label="Your role as provider" value={client.providerRole} />
              <InfoRow label="Your beliefs" value={client.providerBeliefs} />
              <InfoRow label="Your strengths" value={client.providerStrengths} />
              <InfoRow label="Authenticity zone" value={client.authenticityZone} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Brand Message */}
      <SectionCard icon={MessageSquare} iconColor="text-amber-400" title="Brand Message" onEdit={openMessage} empty={messageEmpty}>
        <div className="space-y-5">
          {client.brandingStatement && (
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Branding Statement</p>
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 px-4 py-3">
                <p className="text-sm leading-relaxed italic">{client.brandingStatement}</p>
              </div>
            </div>
          )}
          <InfoRow label="Human differentiation (your AND factor)" value={client.humanDifferentiation} />
        </div>
      </SectionCard>

      {/* Add Info Dialog */}
      <Dialog open={addInfoOpen} onOpenChange={(v) => { if (!v) setAddInfoOpen(false); }}>
        <DialogContent className="max-w-lg glass-strong rounded-2xl border-white/[0.08]">
          <DialogHeader><DialogTitle>Add Information</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Paste any text about this client — interview notes, bio, facts, achievements. AI will place it into the right fields and skip anything already captured.
            </p>
            <Textarea
              value={addInfoText}
              onChange={(e) => setAddInfoText(e.target.value)}
              rows={6}
              placeholder="e.g. She won the Forbes 30 Under 30 award in 2023. Her target clients are female entrepreneurs aged 30–45 in Germany who struggle with visibility..."
              className="rounded-xl glass border-white/[0.08] text-sm"
            />
            {addInfoResult && (
              <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${addInfoResult.includes("already") ? "bg-white/[0.04] text-muted-foreground" : "bg-green-500/10 border border-green-500/20 text-green-400"}`}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{addInfoResult}</span>
              </div>
            )}
            <Button
              onClick={handleAddInfo}
              disabled={addInfoLoading || !addInfoText.trim()}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0"
            >
              {addInfoLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing…</> : "Add to Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOGS ── */}

      {/* Basic Info Dialog */}
      <Dialog open={basicOpen} onOpenChange={(v) => { if (!v) setBasicOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-white/[0.08]">
          <DialogHeader><DialogTitle>Edit Basic Information</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-3">
              {(["name", "company", "role", "location"] as const).map((key) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground capitalize">{key === "name" ? "Full Name" : key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                  <Input value={basicForm[key]} onChange={(e) => setBasicForm({ ...basicForm, [key]: e.target.value })} className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                </div>
              ))}
            </div>
            {(["businessContext", "professionalBackground", "keyAchievements"] as const).map((key) => (
              <div key={key}>
                <Label className="text-xs text-muted-foreground">{key === "businessContext" ? "Business Context" : key === "professionalBackground" ? "Professional Background" : "Key Achievements"}</Label>
                <Textarea value={basicForm[key]} onChange={(e) => setBasicForm({ ...basicForm, [key]: e.target.value })} rows={3} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
              </div>
            ))}
            <div className="border-t border-white/[0.06] pt-4 grid grid-cols-2 gap-3">
              {(["website", "instagram", "tiktok", "youtube", "linkedin", "twitter"] as const).map((key) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground capitalize">{key === "twitter" ? "X / Twitter" : key.charAt(0).toUpperCase() + key.slice(1)}</Label>
                  <Input value={basicForm[key]} onChange={(e) => setBasicForm({ ...basicForm, [key]: e.target.value })} className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                </div>
              ))}
            </div>
            <Button onClick={async () => { await savePartial(basicForm); setBasicOpen(false); }} disabled={saving}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brand Identity Dialog */}
      <Dialog open={brandOpen} onOpenChange={(v) => { if (!v) setBrandOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-white/[0.08]">
          <DialogHeader><DialogTitle>Brand Identity</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Feeling you sell (e.g. security, clarity, confidence)</Label>
              <Textarea value={brandForm.brandFeeling} onChange={(e) => setBrandForm({ ...brandForm, brandFeeling: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Core problem you solve</Label>
              <Textarea value={brandForm.brandProblem} onChange={(e) => setBrandForm({ ...brandForm, brandProblem: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Dream Customer Profile</p>
              <div className="grid grid-cols-2 gap-3">
                {(["tonality", "age", "gender", "income", "country", "profession", "values"] as const).map((key) => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground capitalize">{key}</Label>
                    <Input value={brandForm.dreamCustomer[key]} onChange={(e) => setBrandForm({ ...brandForm, dreamCustomer: { ...brandForm.dreamCustomer, [key]: e.target.value } })} className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Label className="text-xs text-muted-foreground">Concrete person description</Label>
                <Textarea value={brandForm.dreamCustomer.description} onChange={(e) => setBrandForm({ ...brandForm, dreamCustomer: { ...brandForm.dreamCustomer, description: e.target.value } })} rows={3} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
              </div>
            </div>
            <Button onClick={async () => {
              await savePartial({
                brandFeeling: brandForm.brandFeeling,
                brandProblem: brandForm.brandProblem,
                dreamCustomer: JSON.stringify(brandForm.dreamCustomer),
              });
              setBrandOpen(false);
            }} disabled={saving}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer & Problem Dialog */}
      <Dialog open={customerOpen} onOpenChange={(v) => { if (!v) setCustomerOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-white/[0.08]">
          <DialogHeader><DialogTitle>Customer & Problem</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-3">Customer Problems</p>
              <div className="space-y-3">
                {(["mental", "physical", "financial", "social", "aesthetic"] as const).map((key) => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground capitalize">{key} problems</Label>
                    <Textarea value={customerForm.customerProblems[key]} onChange={(e) => setCustomerForm({ ...customerForm, customerProblems: { ...customerForm.customerProblems, [key]: e.target.value } })} rows={2} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Your role as provider (Mentor? Strategist? Sparring partner?)</Label>
                <Textarea value={customerForm.providerRole} onChange={(e) => setCustomerForm({ ...customerForm, providerRole: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Your beliefs (what you&apos;d do differently in your industry)</Label>
                <Textarea value={customerForm.providerBeliefs} onChange={(e) => setCustomerForm({ ...customerForm, providerBeliefs: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Your strengths & skills (what clients appreciate most)</Label>
                <Textarea value={customerForm.providerStrengths} onChange={(e) => setCustomerForm({ ...customerForm, providerStrengths: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Authenticity zone (overlap of customer problem + your strength)</Label>
                <Textarea value={customerForm.authenticityZone} onChange={(e) => setCustomerForm({ ...customerForm, authenticityZone: e.target.value })} rows={2} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
              </div>
            </div>
            <Button onClick={async () => {
              await savePartial({
                customerProblems: JSON.stringify(customerForm.customerProblems),
                providerRole: customerForm.providerRole,
                providerBeliefs: customerForm.providerBeliefs,
                providerStrengths: customerForm.providerStrengths,
                authenticityZone: customerForm.authenticityZone,
              });
              setCustomerOpen(false);
            }} disabled={saving}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Brand Message Dialog */}
      <Dialog open={messageOpen} onOpenChange={(v) => { if (!v) setMessageOpen(false); }}>
        <DialogContent className="max-w-2xl glass-strong rounded-2xl border-white/[0.08]">
          <DialogHeader><DialogTitle>Brand Message</DialogTitle></DialogHeader>
          <div className="space-y-5 pt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Branding Statement</Label>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 mb-1.5">Formula: I help [target group], from [transformation], so that [result].</p>
              <Textarea value={messageForm.brandingStatement} onChange={(e) => setMessageForm({ ...messageForm, brandingStatement: e.target.value })} rows={3} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" placeholder="I help freelancers bring structure to their visibility and attract the right dream clients." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Human differentiation — your AND factor</Label>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 mb-1.5">You are a [provider] AND...? How do you stand out as a human being?</p>
              <Textarea value={messageForm.humanDifferentiation} onChange={(e) => setMessageForm({ ...messageForm, humanDifferentiation: e.target.value })} rows={3} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm" />
            </div>
            <Button onClick={async () => { await savePartial(messageForm); setMessageOpen(false); }} disabled={saving}
              className="w-full rounded-xl h-11 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 border-0">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
