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
      <div className="max-w-6xl mx-auto px-6 h-10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium">
          <Eye className="h-3.5 w-3.5" />
          <span>
            Du siehst den Bereich von <span className="font-semibold">{clientName}</span> als Admin
          </span>
        </div>
        <button
          onClick={exitImpersonation}
          disabled={exiting}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-60"
        >
          {exiting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          Zurück zum Admin-Bereich
        </button>
      </div>
    </div>
  );
}
