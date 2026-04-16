"use client";

import { useState } from "react";
import { Users, Video, Play } from "lucide-react";
import dynamic from "next/dynamic";

const CreatorsContent = dynamic(
  () => import("../creators/page").then((mod) => ({ default: mod.default })),
  { ssr: false, loading: () => <TabLoading /> },
);

const VideosContent = dynamic(
  () => import("../videos/page").then((mod) => ({ default: mod.default })),
  { ssr: false, loading: () => <TabLoading /> },
);

function TabLoading() {
  return <div className="py-12 text-center text-sm text-ocean/40">Laden...</div>;
}

type Tab = "creators" | "videos";

const TABS: Array<{ key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "creators", label: "Creator-Liste", icon: Users },
  { key: "videos", label: "Analysierte Videos", icon: Video },
];

export default function CompetitorsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("creators");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light text-ocean">Konkurrenz-Analyse</h1>
        <p className="text-sm text-ocean/50 mt-1">
          Creators verwalten, Videos scrapen & analysieren
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-ocean/[0.04] w-fit">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                isActive
                  ? "bg-white text-ocean font-medium shadow-sm"
                  : "text-ocean/55 hover:text-ocean"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div>
        {activeTab === "creators" && <CreatorsContent />}
        {activeTab === "videos" && <VideosContent />}
      </div>
    </div>
  );
}
