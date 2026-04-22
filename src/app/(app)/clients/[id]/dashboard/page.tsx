"use client";

import { useParams } from "next/navigation";
import { ClientDashboardView } from "@/components/client-dashboard-view";

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <ClientDashboardView clientId={id} mode="admin" />;
}
