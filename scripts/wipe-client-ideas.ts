import { supabase } from "../src/lib/supabase";

const clientId = process.argv[2];
if (!clientId) {
  console.error("Usage: wipe-client-ideas.ts <clientId>");
  process.exit(1);
}

async function main() {
  const { data: cfg } = await supabase
    .from("configs")
    .select("configName, name")
    .eq("id", clientId)
    .single();
  console.log(`Client: ${cfg?.configName || cfg?.name || clientId}`);

  const { count: before } = await supabase
    .from("ideas")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId);
  console.log(`Before: ${before ?? 0} ideas`);

  if (!before) return;

  const { error } = await supabase.from("ideas").delete().eq("client_id", clientId);
  if (error) {
    console.error("ERROR:", error.message);
    process.exit(1);
  }
  console.log(`Deleted ${before} ideas`);
}

main();
