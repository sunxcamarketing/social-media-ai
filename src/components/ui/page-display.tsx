"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface PageDisplayProps {
  /** Small uppercase label above the title (e.g. "UNIFIED CLIENT METRICS"). */
  eyebrow?: string;
  /** The huge display headline. Plain string or ReactNode for inline accents. */
  title: ReactNode;
  /** Smaller paragraph under the title. */
  subtitle?: string;
  /** Right side: an optional floating insight card, date pickers, or filters. */
  rightSlot?: ReactNode;
  /** Below the title row, full-width: secondary controls / tabs. */
  footer?: ReactNode;
}

/**
 * Display-scale page header — the visual anchor of every modernized page.
 * Pairs a tiny eyebrow with a 5xl-7xl headline (Kanto-style hierarchy)
 * and an optional floating insight card on the right.
 */
export function PageDisplay({ eyebrow, title, subtitle, rightSlot, footer }: PageDisplayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 lg:gap-6 items-end">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ocean/45 mb-2">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-light text-ocean leading-tight tracking-tight break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-ocean/55 mt-2 max-w-2xl break-words leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {rightSlot && (
          <div className="lg:max-w-xs w-full lg:w-auto">{rightSlot}</div>
        )}
      </div>

      {footer && <div className="mt-4">{footer}</div>}
    </motion.div>
  );
}
