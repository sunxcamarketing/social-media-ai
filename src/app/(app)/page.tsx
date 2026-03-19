import { redirect } from "next/navigation";
import { readConfigs } from "@/lib/csv";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  let configs: { id: string }[] = [];
  try {
    configs = await readConfigs();
  } catch {
    // DB may not be set up yet
  }
  if (configs.length > 0) {
    redirect(`/clients/${configs[0].id}/information`);
  }
  redirect("/clients/new");
}
