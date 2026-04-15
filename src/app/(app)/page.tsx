"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootLanding() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/configs")
      .then((r) => r.json())
      .then((clients) => {
        if (Array.isArray(clients) && clients.length > 0) {
          router.replace(`/clients/${clients[0].id}/dashboard`);
        } else {
          router.replace("/admin");
        }
      })
      .catch(() => router.replace("/admin"));
  }, [router]);

  return (
    <div className="flex items-center justify-center py-24 text-ocean/40">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
