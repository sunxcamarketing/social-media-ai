"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Film, Settings2, User } from "lucide-react";
import type { Config, Creator, Video } from "@/lib/types";

const emptyForm = {
  configName: "",
  creatorsCategory: "",
  name: "",
  company: "",
  role: "",
  location: "",
  businessContext: "",
  professionalBackground: "",
  keyAchievements: "",
  website: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  linkedin: "",
  twitter: "",
};

type FormState = typeof emptyForm;

export default function ConfigsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Config | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadConfigs = () => {
    fetch("/api/configs").then((r) => r.json()).then(setConfigs);
  };

  useEffect(() => {
    loadConfigs();
    fetch("/api/creators").then((r) => r.json()).then(setCreators);
    fetch("/api/videos").then((r) => r.json()).then(setVideos);
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (e: React.MouseEvent, config: Config) => {
    e.stopPropagation();
    setEditing(config);
    setForm({
      configName: config.configName,
      creatorsCategory: config.creatorsCategory,
      name: config.name || "",
      company: config.company || "",
      role: config.role || "",
      location: config.location || "",
      businessContext: config.businessContext || "",
      professionalBackground: config.professionalBackground || "",
      keyAchievements: config.keyAchievements || "",
      website: config.website || "",
      instagram: config.instagram || "",
      tiktok: config.tiktok || "",
      youtube: config.youtube || "",
      linkedin: config.linkedin || "",
      twitter: config.twitter || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await fetch("/api/configs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...form }),
      });
    } else {
      await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setDialogOpen(false);
    loadConfigs();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this client?")) return;
    await fetch(`/api/configs?id=${id}`, { method: "DELETE" });
    loadConfigs();
  };

  const f = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage client configurations and AI prompts
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0 gap-1.5">
              <Plus className="h-4 w-4" />
              New Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-strong rounded-2xl border-white/[0.08]">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Client" : "New Client"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              {/* Pipeline */}
              <div className="space-y-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline</p>
                <div>
                  <Label className="text-xs text-muted-foreground">Client Name</Label>
                  <Input {...f("configName")} placeholder="e.g. Real Estate Videos for Anja" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Creators Category</Label>
                  <Input {...f("creatorsCategory")} placeholder="e.g. dubai-real-estate" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-4 border-t border-white/[0.06] pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Basic Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Full Name</Label>
                    <Input {...f("name")} placeholder="Anja Müller" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Company</Label>
                    <Input {...f("company")} placeholder="Anja Real Estate" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Role</Label>
                    <Input {...f("role")} placeholder="Founder & CEO" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <Input {...f("location")} placeholder="Dubai, UAE" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Business Context</Label>
                  <Textarea {...f("businessContext")} placeholder="What they do, their target market, unique value proposition…" rows={3} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm leading-relaxed" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Professional Background</Label>
                  <Textarea {...f("professionalBackground")} placeholder="Career history, expertise, credentials…" rows={3} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm leading-relaxed" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Key Achievements</Label>
                  <Textarea {...f("keyAchievements")} placeholder="Notable wins, press, milestones…" rows={3} className="mt-1.5 rounded-xl glass border-white/[0.08] text-sm leading-relaxed" />
                </div>
              </div>

              {/* Social & Web */}
              <div className="space-y-4 border-t border-white/[0.06] pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Social & Web</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Website</Label>
                    <Input {...f("website")} placeholder="https://anja.com" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Instagram</Label>
                    <Input {...f("instagram")} placeholder="@username or URL" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">TikTok</Label>
                    <Input {...f("tiktok")} placeholder="@username or URL" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">YouTube</Label>
                    <Input {...f("youtube")} placeholder="Channel URL" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                    <Input {...f("linkedin")} placeholder="Profile URL" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">X / Twitter</Label>
                    <Input {...f("twitter")} placeholder="@username or URL" className="mt-1.5 rounded-xl glass border-white/[0.08] h-11" />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSave}
                className="w-full rounded-xl h-11 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 border-0"
              >
                {editing ? "Save Changes" : "Create Client"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Client Cards */}
      <div className="grid gap-4">
        {configs.map((config) => {
          const creatorCount = creators.filter((c) => c.category === config.creatorsCategory).length;
          const videoCount = videos.filter((v) => v.configName === config.configName).length;

          return (
            <div
              key={config.id}
              onClick={() => router.push(`/configs/${config.id}`)}
              className="glass rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.1] cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/20">
                    <Settings2 className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{config.configName}</h3>
                    {(config.role || config.company) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[config.role, config.company].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-md text-[10px] bg-white/[0.05] border border-white/[0.06]">
                        {config.creatorsCategory}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {creatorCount}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Film className="h-3 w-3" />
                        {videoCount}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => openEdit(e, config)}
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(e, config.id)}
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {configs.length === 0 && (
          <div className="glass rounded-2xl p-12 text-center">
            <User className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <h3 className="mt-4 font-semibold">No clients yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
