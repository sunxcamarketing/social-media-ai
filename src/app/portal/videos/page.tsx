"use client";

import { useEffect, useState } from "react";
import { Video, ExternalLink } from "lucide-react";
import { usePortalClient } from "../use-portal-client";

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
  const [clientConfigName, setClientConfigName] = useState("");

  useEffect(() => {
    if (!effectiveClientId) return;

    // Get client config name for filtering videos
    fetch(`/api/configs/${effectiveClientId}`)
      .then(r => r.json())
      .then(data => {
        const name = data.configName || "";
        setClientConfigName(name);
        if (name) {
          return fetch(`/api/videos?configName=${encodeURIComponent(name)}`);
        }
        return null;
      })
      .then(r => r?.json())
      .then(data => { if (data) setVideos(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [effectiveClientId]);

  if (authLoading || loading) {
    return <div className="text-center py-20 text-ocean/50">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-light text-ocean flex items-center gap-2">
          <Video className="h-5 w-5" /> Videos
        </h1>
        <p className="text-xs text-ocean/50 mt-1">{videos.length} analysierte Videos</p>
      </div>

      {videos.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-ocean/50">Noch keine Videos analysiert.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {videos.map(video => (
            <div key={video.id} className="glass rounded-xl overflow-hidden group">
              {video.thumbnail && (
                <div className="relative aspect-[9/16] bg-ocean/5">
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
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
      )}
    </div>
  );
}
