"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalSidebar } from "@/components/portal-sidebar";
import { PortalTopbar } from "@/components/portal-topbar";
import { ImpersonateBanner } from "@/components/impersonate-banner";
import { NavProgress } from "@/components/nav-progress";
import { MobileNavProvider } from "@/components/mobile-nav-context";
import { useI18n, type Lang } from "@/lib/i18n";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setClientLang, t } = useI18n();
  const [clientName, setClientName] = useState("");
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [invitedAt, setInvitedAt] = useState<string | null>(null);
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

        setEmail(data.email);
        setInvitedAt(data.invitedAt ?? null);

        if (data.impersonating) {
          setImpersonating({ clientName: data.impersonating.clientName });
        }

        fetch(`/api/configs/${clientId}`)
          .then(r => r.json())
          .then(cfg => {
            setClientName(cfg.configName || cfg.name || "Client");
            if (cfg.language === "en" || cfg.language === "de") {
              setClientLang(cfg.language as Lang);
            }
            setReady(true);
          })
          .catch(() => setReady(true));
      })
      .catch(() => router.push("/login"));
  }, [router, setClientLang]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="text-ocean/40 text-sm">{t("portal.loading")}</div>
      </div>
    );
  }

  return (
    <MobileNavProvider>
      <div className="min-h-screen bg-warm-white flex">
        <NavProgress />
        <PortalSidebar clientName={clientName} />
        <div className="flex-1 min-w-0 flex flex-col">
          {impersonating && <ImpersonateBanner clientName={impersonating.clientName} />}
          <PortalTopbar clientName={clientName} email={email} invitedAt={invitedAt} />
          <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 md:px-8 py-6 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
