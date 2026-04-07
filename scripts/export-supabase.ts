import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLES = [
  "configs",
  "creators",
  "videos",
  "scripts",
  "ideas",
  "training_scripts",
  "analyses",
  "strategy_config",
  "client_users",
];

async function exportAll() {
  const exportDir = "data/export";
  mkdirSync(exportDir, { recursive: true });

  let totalRows = 0;

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");

    if (error) {
      console.log(`⚠ ${table}: ${error.message}`);
      writeFileSync(`${exportDir}/${table}.json`, "[]");
      continue;
    }

    const rows = data || [];
    totalRows += rows.length;
    writeFileSync(`${exportDir}/${table}.json`, JSON.stringify(rows, null, 2));
    console.log(`${table}: ${rows.length} rows`);
  }

  console.log(`\nTotal: ${totalRows} rows exported to ${exportDir}/`);
}

exportAll();
