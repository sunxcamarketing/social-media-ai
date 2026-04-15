"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientNav } from "@/components/client-nav";
import { ImpersonateBanner } from "@/components/impersonate-banner";
import { NavProgress } from "@/components/nav-progress";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [impersonating, setImpersonating] = useState<{ clientName: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          router.push("/login");
          return;
        }

        const clientId = data.clientId;
        if (!clientId) {
          router.push("/");
          return;
        }

        if (data.impersonating) {
          setImpersonating({ clientName: data.impersonating.clientName });
        }

        fetch(`/api/configs/${clientId}`)
          .then(r => r.json())
          .then(cfg => {
            setClientName(cfg.configName || cfg.name || "Client");
            setReady(true);
          })
          .catch(() => setReady(true));
      })
      .catch(() => router.push("/login"));
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="text-ocean/40 text-sm">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-white">
      <NavProgress />
      {impersonating && <ImpersonateBanner clientName={impersonating.clientName} />}
      <ClientNav clientName={clientName} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
