"use client";

import { useEffect, useState } from "react";
import { Check, Film, BookOpen, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DailyPost {
  clientId: string;
  date: string;
  postedReel: boolean;
  postedStories: boolean;
  postedReelAt: string | null;
  postedStoriesAt: string | null;
  note: string;
  updatedAt: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

interface DailyPostCheckProps {
  clientId: string;
  /** Optional — override the date. Defaults to today (Europe local). */
  date?: string;
}

export function DailyPostCheck({ clientId, date }: DailyPostCheckProps) {
  const activeDate = date || todayIso();
  const [state, setState] = useState<DailyPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"reel" | "stories" | null>(null);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    fetch(`/api/daily-posts?clientId=${clientId}&date=${activeDate}`)
      .then((r) => r.json())
      .then((data) => setState(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId, activeDate]);

  const toggle = async (key: "reel" | "stories") => {
    if (!state) return;
    setSaving(key);
    const optimistic: DailyPost = {
      ...state,
      postedReel: key === "reel" ? !state.postedReel : state.postedReel,
      postedStories: key === "stories" ? !state.postedStories : state.postedStories,
    };
    setState(optimistic);
    try {
      const res = await fetch("/api/daily-posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          date: activeDate,
          postedReel: optimistic.postedReel,
          postedStories: optimistic.postedStories,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      setState(saved);
    } catch {
      // revert
      setState(state);
    } finally {
      setSaving(null);
    }
  };

  const isToday = activeDate === todayIso();
  const readableDate = isToday
    ? "Heute"
    : new Date(activeDate).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });

  if (loading || !state) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-ocean/[0.04] animate-pulse" />
        <div className="h-24 rounded-2xl bg-ocean/[0.04] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Toggle
        label="Reel / Post"
        description={isToday ? "Heute schon veröffentlicht?" : `${readableDate} veröffentlicht?`}
        icon={Film}
        active={state.postedReel}
        timestamp={state.postedReelAt}
        saving={saving === "reel"}
        onClick={() => toggle("reel")}
      />
      <Toggle
        label="Story"
        description={isToday ? "Heute schon Stories gepostet?" : `${readableDate} Stories?`}
        icon={BookOpen}
        active={state.postedStories}
        timestamp={state.postedStoriesAt}
        saving={saving === "stories"}
        onClick={() => toggle("stories")}
      />
    </div>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  timestamp: string | null;
  saving: boolean;
  onClick: () => void;
}

function Toggle({ label, description, icon: Icon, active, timestamp, saving, onClick }: ToggleProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={saving}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={`group relative rounded-2xl border p-4 sm:p-5 text-left transition-all overflow-hidden ${
        active
          ? "bg-gradient-to-br from-green-50 to-green-100/50 border-green-300/60 shadow-[0_4px_20px_rgba(34,197,94,0.08)]"
          : "bg-white border-ocean/[0.08] hover:border-ocean/[0.15] shadow-[0_1px_8px_rgba(32,35,69,0.03)]"
      }`}
    >
      {active && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="absolute top-3 right-3 h-7 w-7 rounded-full bg-green-500 flex items-center justify-center shadow-md"
        >
          <Check className="h-4 w-4 text-white" strokeWidth={3} />
        </motion.div>
      )}

      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            active ? "bg-green-500/15" : "bg-ocean/[0.04] group-hover:bg-ocean/[0.07]"
          }`}
        >
          <Icon className={`h-5 w-5 ${active ? "text-green-600" : "text-ocean/55"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${active ? "text-green-800" : "text-ocean"}`}>{label}</p>
          <p className={`text-xs mt-0.5 leading-snug ${active ? "text-green-700/80" : "text-ocean/55"}`}>
            {description}
          </p>
          <AnimatePresence>
            {active && timestamp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1 mt-2 text-[11px] text-green-700/70"
              >
                <Clock className="h-3 w-3" />
                <span>um {formatTime(timestamp)}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.button>
  );
}
