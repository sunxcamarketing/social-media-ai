"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, X, Loader2 } from "lucide-react";

export function ImpersonateBanner({ clientName }: { clientName: string }) {
  const router = useRouter();
  const [exiting, setExiting] = useState(false);

  const exitImpersonation = async () => {
    setExiting(true);
    try {
      await fetch("/api/auth/impersonate", { method: "DELETE" });
      router.push("/");
      router.refresh();
    } finally {
      setExiting(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-blush-dark to-ocean text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-10 py-1.5 sm:py-0 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-medium min-w-0">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            <span className="hidden sm:inline">Du siehst den Bereich von </span>
            <span className="font-semibold">{clientName}</span>
            <span className="hidden sm:inline"> als Admin</span>
          </span>
        </div>
        <button
          onClick={exitImpersonation}
          disabled={exiting}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-60 shrink-0 whitespace-nowrap"
        >
          {exiting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          <span className="hidden sm:inline">Zurück zum Admin-Bereich</span>
          <span className="sm:hidden">Exit</span>
        </button>
      </div>
    </div>
  );
}
