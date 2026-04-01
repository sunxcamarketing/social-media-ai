import { v4 as uuid } from "uuid";
import { supabase } from "./supabase";

const IMAGE_BUCKET = "images";
let bucketEnsured = false;

async function ensureBucket() {
  if (bucketEnsured) return;
  const { error } = await supabase.storage.createBucket(IMAGE_BUCKET, { public: true });
  if (error && !error.message.includes("already exists")) {
    console.warn("Image bucket creation failed:", error.message);
  }
  bucketEnsured = true;
}

/**
 * Download an image from an external URL (e.g. Instagram CDN) and upload to
 * Supabase Storage. Returns the permanent public URL.
 * Falls back to the original URL on any failure.
 *
 * @param originalUrl  The external image URL
 * @param folder       Storage folder prefix (e.g. "thumbnails", "profiles", "creators")
 * @param fileId       Optional unique ID for the file — defaults to a new UUID
 */
export async function persistImage(
  originalUrl: string,
  folder: string,
  fileId?: string,
): Promise<string> {
  if (!originalUrl) return "";
  try {
    await ensureBucket();

    const res = await fetch(originalUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)",
        Referer: "https://www.instagram.com/",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return originalUrl;

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const id = fileId || uuid();
    const path = `${folder}/${id}.${ext}`;

    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (error) {
      console.warn(`Image upload failed (${folder}/${id}):`, error.message);
      return originalUrl;
    }

    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn(`Image persist failed (${folder}):`, e);
    return originalUrl;
  }
}
