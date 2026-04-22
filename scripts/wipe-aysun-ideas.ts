import { supabase } from "../src/lib/supabase";

async function main() {
  // Find Aysun's config in Supabase (match by name or company)
  const { data: configs } = await supabase
    .from("configs")
    .select("id, configName, name, company");

  const candidates = (configs || []).filter((c) => {
    const blob = `${c.configName ?? ""} ${c.name ?? ""} ${c.company ?? ""}`.toLowerCase();
    return blob.includes("aysun") || blob.includes("sun x ca") || blob.includes("sunxca");
  });

  console.log("Candidates:", candidates);
  if (candidates.length === 0) {
    console.log("No Aysun config found.");
    return;
  }

  for (const c of candidates) {
    const { count: before } = await supabase
      .from("ideas")
      .select("*", { count: "exact", head: true })
      .eq("client_id", c.id);
    console.log(`${c.configName || c.name} (${c.id}): ${before ?? 0} ideas`);

    if (before && before > 0) {
      const { error } = await supabase.from("ideas").delete().eq("client_id", c.id);
      if (error) {
        console.error("ERROR:", error.message);
        continue;
      }
      console.log(`  → deleted ${before} ideas`);
    }
  }
}

main();
