"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientNav } from "@/components/client-nav";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          router.push("/login");
          return;
        }

        const effectiveClientId = data.role === "client"
          ? data.clientId
          : data.impersonatingClientId;

        // Client without clientId or admin without impersonate → redirect
        if (!effectiveClientId) {
          router.push("/");
          return;
        }

        setIsImpersonating(data.role === "admin" && !!data.impersonatingClientId);

        // Load client name
        fetch(`/api/configs/${effectiveClientId}`)
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
      <ClientNav clientName={clientName} isImpersonating={isImpersonating} />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
