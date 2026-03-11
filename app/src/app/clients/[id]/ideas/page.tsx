"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Lightbulb } from "lucide-react";
import type { Idea } from "@/lib/types";

const CONTENT_TYPES = [
  "Face-to-camera",
  "Voiceover + B-Roll",
  "Storytelling",
  "Short-form video",
  "Carousel",
  "Screenshot post",
  "Blind reaction",
];

const STATUS_OPTIONS = [
  { value: "idea", label: "Idea", color: "bg-wind/20 text-ocean/60 border-ocean/[0.06]" },
  { value: "in-progress", label: "In Progress", color: "bg-amber-500/10 text-ivory border-amber-500/20" },
  { value: "done", label: "Done", color: "bg-green-50 text-green-600 border-green-200" },
];

function statusColor(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.color || "bg-ocean/[0.02] text-ocean/60 border-ocean/[0.06]";
}
function statusLabel(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
}

const emptyForm = { title: "", description: "", contentType: "", status: "idea" };

export default function ClientIdeasPage() {
  const { id } = useParams<{ id: string }>();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Idea | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("all");

  const loadIdeas = () => {
    fetch(`/api/ideas?clientId=${id}`).then((r) => r.json()).then(setIdeas);
  };

  useEffect(() => { loadIdeas(); }, [id]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (idea: Idea) => {
    setEditing(idea);
    setForm({ title: idea.title, description: idea.description, contentType: idea.contentType, status: idea.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await fetch("/api/ideas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...form }),
      });
    } else {
      await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: id, ...form }),
      });
    }
    setDialogOpen(false);
    loadIdeas();
  };

  const handleDelete = async (ideaId: string) => {
    if (!confirm("Delete this idea?")) return;
    await fetch(`/api/ideas?id=${ideaId}`, { method: "DELETE" });
    loadIdeas();
  };

  const filtered = filterStatus === "all" ? ideas : ideas.filter((i) => i.status === filterStatus);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ideas</h1>
          <p className="mt-1 text-sm text-ocean/60">Video concepts and content ideas for this client</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="rounded-xl bg-ocean hover:bg-ocean-light border-0 gap-1.5">
              <Plus className="h-4 w-4" />
              Add Idea
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg glass-strong rounded-2xl border-ocean/[0.06]">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Idea" : "New Idea"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs text-ocean/60">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. How I closed my first 1M deal"
                  className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11"
                />
              </div>
              <div>
                <Label className="text-xs text-ocean/60">Description / Concept</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the video concept, hook idea, key message…"
                  rows={4}
                  className="mt-1.5 rounded-xl glass border-ocean/[0.06] text-sm leading-relaxed"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-ocean/60">Content Type</Label>
                  <Select value={form.contentType} onValueChange={(v) => setForm({ ...form, contentType: v })}>
                    <SelectTrigger className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-ocean/60">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="mt-1.5 rounded-xl glass border-ocean/[0.06] h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleSave}
                disabled={!form.title}
                className="w-full rounded-xl h-11 bg-ocean hover:bg-ocean-light border-0"
              >
                {editing ? "Save Changes" : "Add Idea"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        {[{ value: "all", label: "All" }, ...STATUS_OPTIONS].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={`rounded-xl px-4 py-1.5 text-xs font-medium transition-all ${
              filterStatus === s.value
                ? "bg-blush/20 text-blush-dark border border-blush/40"
                : "glass border-ocean/[0.06] text-ocean/60 hover:text-ocean"
            }`}
          >
            {s.label}
          </button>
        ))}
        <Badge variant="secondary" className="ml-2 rounded-lg px-3 py-1.5 text-xs bg-ocean/[0.02] border border-ocean/[0.06]">
          {filtered.length} ideas
        </Badge>
      </div>

      {/* Ideas grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((idea) => (
          <div key={idea.id} className="group glass rounded-2xl p-5 space-y-3 transition-all duration-300 hover:bg-warm-white hover:border-ocean/5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug">{idea.title}</p>
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={() => openEdit(idea)}
                  className="h-7 w-7 p-0 rounded-lg text-ocean/60 hover:text-ocean">
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(idea.id)}
                  className="h-7 w-7 p-0 rounded-lg text-ocean/60 hover:text-red-500">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {idea.description && (
              <p className="text-xs text-ocean/60 leading-relaxed line-clamp-3">{idea.description}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`rounded-md text-[10px] border ${statusColor(idea.status)}`}>
                {statusLabel(idea.status)}
              </Badge>
              {idea.contentType && (
                <Badge variant="secondary" className="rounded-md text-[10px] bg-ocean/[0.02] border border-ocean/[0.06] text-ocean/60">
                  {idea.contentType}
                </Badge>
              )}
            </div>

            {idea.createdAt && (
              <p className="text-[10px] text-ocean/70">{idea.createdAt}</p>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-12 text-center">
            <Lightbulb className="mx-auto h-10 w-10 text-ocean/60" />
            <h3 className="mt-4 font-semibold">No ideas yet</h3>
            <p className="mt-1 text-sm text-ocean/60">Add your first video concept to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
