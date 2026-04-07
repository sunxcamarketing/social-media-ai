import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import order matters: configs first (referenced by other tables)
const TABLES = [
  "configs",
  "creators",
  "videos",
  "scripts",
  "ideas",
  "training_scripts",
  "analyses",
  "strategy_config",
];

async function importAll() {
  let totalRows = 0;

  for (const table of TABLES) {
    const filePath = `data/export/${table}.json`;
    const data = JSON.parse(readFileSync(filePath, "utf-8"));

    if (data.length === 0) {
      console.log(`${table}: 0 rows (skipped)`);
      continue;
    }

    const { error } = await supabase.from(table).upsert(data);

    if (error) {
      console.log(`✗ ${table}: ${error.message}`);
    } else {
      totalRows += data.length;
      console.log(`✓ ${table}: ${data.length} rows imported`);
    }
  }

  console.log(`\nTotal: ${totalRows} rows imported`);
}

importAll();
