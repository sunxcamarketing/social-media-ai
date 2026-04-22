"use client";

import { useEffect, useState } from "react";
import { Video, ExternalLink } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { PortalShell } from "@/components/portal-shell";
import { useI18n } from "@/lib/i18n";

interface VideoItem {
  id: string;
  link: string;
  thumbnail: string;
  creator: string;
  views: number;
  likes: number;
  comments: number;
  datePosted: string;
  configName: string;
}

export default function PortalVideos() {
  const { t } = useI18n();
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveClientId) return;
    fetch(`/api/videos?clientId=${effectiveClientId}`)
      .then((r) => r.json())
      .then((d) => setVideos(Array.isArray(d) ? d : []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));
  }, [effectiveClientId]);

  return (
    <PortalShell
      icon={Video}
      title="Videos"
      subtitle={`${videos.length} analysierte Videos`}
      loading={authLoading || loading}
      isEmpty={videos.length === 0}
      emptyMessage={t("portal.videos.empty")}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {videos.map(video => (
          <div key={video.id} className="glass rounded-xl overflow-hidden group">
            {video.thumbnail && (
              <div className="relative aspect-[9/16] bg-ocean/5">
                <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
                {video.link && (
                  <a
                    href={video.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors"
                  >
                    <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                )}
              </div>
            )}
            <div className="p-3">
              <p className="text-xs font-medium text-ocean truncate">@{video.creator}</p>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-ocean/50">
                <span>{video.views?.toLocaleString()} Views</span>
                <span>{video.likes?.toLocaleString()} Likes</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PortalShell>
  );
}
