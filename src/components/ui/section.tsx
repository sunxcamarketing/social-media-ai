"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { motion } from "motion/react";

interface SectionProps {
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** Consistent content section with animated reveal + uppercase header. */
export function Section({ title, icon: Icon, action, children, className = "", delay = 0 }: SectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`space-y-3 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-baseline justify-between gap-3 flex-wrap px-1">
          {title && (
            <h2 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-ocean/60 flex items-center gap-2">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {title}
            </h2>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </motion.section>
  );
}
