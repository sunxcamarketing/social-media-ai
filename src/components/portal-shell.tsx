"use client";

import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { motion } from "motion/react";

interface PortalShellProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  loading?: boolean;
  emptyMessage?: string;
  isEmpty?: boolean;
  /** Optional extra UI rendered between the title block and the content
   *  (e.g. a tab switcher). Always visible, even in empty state. */
  header?: ReactNode;
  /** Buttons / links rendered in the page header action slot. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Common wrapper for read-only portal pages: premium hero header with
 * icon + title + optional actions, loading skeleton, empty state.
 */
export function PortalShell({
  icon,
  title,
  subtitle,
  loading,
  emptyMessage,
  isEmpty,
  header,
  actions,
  children,
}: PortalShellProps) {
  const { t } = useI18n();
  const resolvedEmpty = emptyMessage ?? t("portal.shell.noData");

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-ocean/[0.04] animate-pulse" />
        <div className="h-48 rounded-2xl bg-ocean/[0.04] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        actions={actions}
        footer={header}
      />

      {isEmpty ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-dashed border-ocean/[0.1] bg-warm-white/50 p-8 sm:p-12 text-center"
        >
          <p className="text-sm text-ocean/50">{resolvedEmpty}</p>
        </motion.div>
      ) : (
        children
      )}
    </div>
  );
}
