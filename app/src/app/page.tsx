import { redirect } from "next/navigation";
import { readConfigs } from "@/lib/csv";

export default function RootPage() {
  const configs = readConfigs();
  if (configs.length > 0) {
    redirect(`/clients/${configs[0].id}/information`);
  }
  // No clients yet — sidebar will prompt to create one
  redirect("/clients/new");
}
