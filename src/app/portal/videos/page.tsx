"use client";

import { useEffect, useState } from "react";
import { Video, ExternalLink } from "lucide-react";
import { usePortalClient } from "../use-portal-client";
import { PortalShell } from "@/components/portal-shell";

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
  const { effectiveClientId, loading: authLoading } = usePortalClient();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom 2-step fetch: config → name → videos by configName
  useEffect(() => {
    if (!effectiveClientId) return;
    (async () => {
      try {
        const cfg = await fetch(`/api/configs/${effectiveClientId}`).then(r => r.json());
        const name = cfg?.configName || "";
        if (name) {
          const data = await fetch(`/api/videos?configName=${encodeURIComponent(name)}`).then(r => r.json());
          setVideos(Array.isArray(data) ? data : []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [effectiveClientId]);

  return (
    <PortalShell
      icon={Video}
      title="Videos"
      subtitle={`${videos.length} analysierte Videos`}
      loading={authLoading || loading}
      isEmpty={videos.length === 0}
      emptyMessage="Noch keine Videos analysiert."
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
