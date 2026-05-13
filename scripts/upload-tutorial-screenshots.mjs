// One-shot: upload the carousel-tutorial screenshots from the local cache
// to Supabase Storage and print the public URLs. Use the URLs in the
// preview script's `screenshotUrl` slots.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET = "images";
const FOLDER = "tutorial/carousel";
const SOURCE = "/Users/aysuncaliskan/.claude/image-cache/6ed85332-0485-4b99-82ea-3817ccb4c778";

// Step → cache file. Step 6 (chat anpassen) has no screenshot yet — left
// as a placeholder in the email.
const FILES = [
  { step: 1, name: "step-1-sidebar.png", file: "36.png" },
  { step: 2, name: "step-2-thema.png", file: "37.png" },
  { step: 3, name: "step-3-picker.png", file: "38.png" },
  { step: 4, name: "step-4-styleguide.png", file: "39.png" },
  { step: 5, name: "step-5-starten.png", file: "40.png" },
  { step: 6, name: "step-6-chat.png", file: "44.png" },
  { step: 7, name: "step-7-export.png", file: "42.png" },
];

const results = [];
for (const { step, name, file } of FILES) {
  const buf = readFileSync(`${SOURCE}/${file}`);
  const path = `${FOLDER}/${name}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: "image/png", upsert: true });
  if (error) {
    console.error(`Step ${step} upload failed:`, error.message);
    continue;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  results.push({ step, url: data.publicUrl });
}

console.log("\nUploaded URLs:");
for (const r of results) console.log(`  Step ${r.step}: ${r.url}`);
console.log(`\n${results.length} / ${FILES.length} uploaded.`);
