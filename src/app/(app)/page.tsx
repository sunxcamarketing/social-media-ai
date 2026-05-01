"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Admin lands on the agency-wide overview at /admin. The middleware
// already routes clients to /portal, so this only ever runs for admin.
export default function RootLanding() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-24 text-ocean/40">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
