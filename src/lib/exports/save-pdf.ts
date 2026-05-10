// Saves a PDF buffer to Supabase Storage and returns a public URL.
// Reuses the existing "images" bucket under a dedicated `script-exports/`
// prefix so the storage layer stays a single source of truth.

import { v4 as uuid } from "uuid";
import { supabase } from "@/lib/supabase";

const BUCKET = "images";
const FOLDER = "script-exports";

export async function uploadScriptExportPdf(
  clientId: string,
  filename: string,
  buffer: Buffer,
): Promise<{ url: string; path: string }> {
  const safeName = filename.replace(/[^a-zA-Z0-9._\-äöüÄÖÜß]/g, "_");
  const path = `${FOLDER}/${clientId}/${uuid()}_${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
