"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { motion } from "motion/react";

interface PageHeaderProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Rendered full-width below the title row. Optional tab bar, filters, etc. */
  footer?: ReactNode;
  tone?: "default" | "hero";
}

/**
 * Consistent page hero — Pillar of the portal + admin style system.
 * Use tone="hero" for the main landing / dashboard (dark gradient),
 * default for content pages (light background, accent border).
 */
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  actions,
  footer,
  tone = "default",
}: PageHeaderProps) {
  const isHero = tone === "hero";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative overflow-hidden rounded-2xl ${
        isHero
          ? "bg-gradient-to-br from-ocean via-ocean to-ocean-light text-white p-6 sm:p-8"
          : "bg-white border border-ocean/[0.06] p-5 sm:p-6"
      }`}
    >
      {isHero && (
        <>
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/[0.04]" />
          <div className="absolute -right-4 bottom-0 h-20 w-20 rounded-full bg-white/[0.03]" />
        </>
      )}

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {Icon && (
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                isHero ? "bg-white/[0.08]" : "bg-blush-light/60"
              }`}
            >
              <Icon className={`h-5 w-5 ${isHero ? "text-white" : "text-blush-dark"}`} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className={`text-[10px] uppercase tracking-[0.2em] mb-1 font-medium ${isHero ? "text-white/50" : "text-ocean/45"}`}>
                {eyebrow}
              </p>
            )}
            <h1 className={`text-xl sm:text-2xl font-light leading-tight break-words ${isHero ? "text-white" : "text-ocean"}`}>
              {title}
            </h1>
            {subtitle && (
              <p className={`text-sm mt-1.5 break-words ${isHero ? "text-white/65" : "text-ocean/55"}`}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
      </div>

      {footer && <div className="relative mt-4">{footer}</div>}
    </motion.div>
  );
}
