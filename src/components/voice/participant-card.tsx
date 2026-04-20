"use client";

import { motion } from "motion/react";

export interface ParticipantCardProps {
  name: string;
  role: string;
  icon: React.ReactNode;
  level: number;
  speaking: boolean;
  active: boolean;
  primary?: boolean;
}

export function ParticipantCard({ name, role, icon, level, speaking, active, primary }: ParticipantCardProps) {
  return (
    <div
      className={`relative rounded-3xl p-6 flex flex-col items-center transition-all duration-300 ${
        primary
          ? "bg-white border border-ocean/[0.08] shadow-[0_2px_20px_rgba(32,35,69,0.06)]"
          : "bg-ocean/[0.02] border border-ocean/[0.05]"
      } ${speaking ? "ring-2 ring-offset-2 ring-green-400/60" : ""}`}
    >
      <motion.div
        animate={speaking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }}
        className={`h-20 w-20 rounded-full flex items-center justify-center mb-4 ${
          primary ? "bg-ocean/[0.06]" : "bg-white border border-ocean/[0.06]"
        }`}
      >
        {icon}
      </motion.div>

      <p className="text-base font-semibold text-ocean mb-0.5">{name}</p>
      <p className="text-xs text-ocean/45 mb-5">{role}</p>

      <div className="flex items-center gap-[3px] h-6">
        {[...Array(16)].map((_, i) => {
          const centerDistance = Math.abs(i - 7.5) / 7.5;
          const peak = 1 - centerDistance * 0.6;
          const height = active
            ? Math.max(3, level * 22 * peak * (0.6 + Math.random() * 0.4))
            : 3;
          return (
            <motion.div
              key={i}
              className={`w-[3px] rounded-full ${primary ? "bg-ocean/50" : "bg-ocean/30"}`}
              animate={{
                height: speaking ? height : 3,
                opacity: speaking ? 0.7 + peak * 0.3 : 0.35,
              }}
              transition={{ duration: 0.12 }}
            />
          );
        })}
      </div>
    </div>
  );
}
