"use client";

import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PortalShellProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  loading?: boolean;
  emptyMessage?: string;
  isEmpty?: boolean;
  children: ReactNode;
}

/**
 * Common wrapper for read-only portal pages: header with icon + title,
 * loading state, empty state. Replaces the repeated h1 + subtitle + if/else
 * empty-card pattern across scripts, videos, analyses, strategy.
 */
export function PortalShell({
  icon: Icon,
  title,
  subtitle,
  loading,
  emptyMessage = "Noch keine Daten vorhanden.",
  isEmpty,
  children,
}: PortalShellProps) {
  if (loading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  return (
    <div className="space-y-6 animate-in-up">
      <div>
        <h1 className="text-xl font-light text-ocean flex items-center gap-2">
          <Icon className="h-5 w-5" /> {title}
        </h1>
        {subtitle && <p className="text-xs text-ocean/50 mt-1">{subtitle}</p>}
      </div>

      {isEmpty ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-ocean/50">{emptyMessage}</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
