"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";

interface StatTileProps {
  label: string;
  value: number | string;
  sublabel?: string;
  icon?: ReactNode;
  accent?: "ocean" | "blush" | "green" | "amber" | "ivory";
  href?: string;
  onClick?: () => void;
  loading?: boolean;
}

const ACCENTS: Record<NonNullable<StatTileProps["accent"]>, { bg: string; icon: string }> = {
  ocean:  { bg: "bg-ocean/[0.05]",    icon: "text-ocean" },
  blush:  { bg: "bg-blush-light/60",  icon: "text-blush-dark" },
  green:  { bg: "bg-green-50",        icon: "text-green-600" },
  amber:  { bg: "bg-amber-50",        icon: "text-amber-600" },
  ivory:  { bg: "bg-ivory/[0.08]",    icon: "text-ivory" },
};

export function StatTile({ label, value, sublabel, icon, accent = "ocean", href, onClick, loading }: StatTileProps) {
  const a = ACCENTS[accent];
  const numericValue = typeof value === "number" ? value : null;
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState<number | null>(numericValue === null ? null : 0);

  useEffect(() => {
    if (numericValue === null || !inView) return;
    const duration = 900;
    const start = performance.now();
    const from = 0;
    const to = numericValue;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numericValue, inView]);

  const content = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-2xl bg-white border border-ocean/[0.06] p-4 sm:p-5 shadow-[0_1px_8px_rgba(32,35,69,0.03)] transition-all duration-200 ${
        href || onClick ? "hover:shadow-[0_4px_20px_rgba(32,35,69,0.06)] hover:-translate-y-0.5 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[10px] font-medium text-ocean/50 uppercase tracking-wider truncate">{label}</span>
        {icon && (
          <div className={`h-7 w-7 rounded-lg ${a.bg} flex items-center justify-center shrink-0`}>
            <span className={a.icon}>{icon}</span>
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded-md bg-ocean/[0.06] animate-pulse" />
      ) : (
        <p className="text-2xl sm:text-3xl font-light text-ocean tabular-nums break-words">
          {numericValue === null ? value : (display ?? 0).toLocaleString()}
        </p>
      )}
      {sublabel && <p className="text-[11px] text-ocean/45 mt-1 truncate">{sublabel}</p>}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} type="button" className="block text-left w-full">
        {content}
      </button>
    );
  }
  return content;
}
