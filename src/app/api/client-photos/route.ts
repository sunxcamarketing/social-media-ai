import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { supabase } from "@/lib/supabase";
import { getCurrentUser, getEffectiveClientId } from "@/lib/auth";

const BUCKET = "images";
const FOLDER = "client-photos";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB per file (after client-side compression most photos land well below)
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function ensureBucket(): Promise<{ ok: true } | { ok: false; error: string }> {
  // List existing buckets first — createBucket on an existing public bucket
  // can return "permission denied" instead of "already exists" depending on
  // the service-role policy, which would mask the real state.
  const list = await supabase.storage.listBuckets();
  if (list.error) {
    return { ok: false, error: `Storage list failed: ${list.error.message}` };
  }
  const exists = (list.data || []).some((b) => b.name === BUCKET);
  if (exists) return { ok: true };

  const create = await supabase.storage.createBucket(BUCKET, { public: true });
  if (create.error) {
    return { ok: false, error: `Storage bucket "${BUCKET}" missing and could not be created: ${create.error.message}` };
  }
  return { ok: true };
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

// ── POST: upload a photo for a client ─────────────────────────────────────

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file");
  const clientId = String(form.get("clientId") || "").trim();

  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  // Authorization: admins can upload for any client; clients only for themselves.
  if (user.role === "client") {
    const ownClientId = getEffectiveClientId(user);
    if (ownClientId !== clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 });
  }

  const bucketCheck = await ensureBucket();
  if (!bucketCheck.ok) {
    console.error("[client-photos]", bucketCheck.error);
    return NextResponse.json({ error: bucketCheck.error }, { status: 500 });
  }

  const id = uuid();
  const ext = extFromMime(file.type);
  const path = `${FOLDER}/${clientId}/${id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error("[client-photos] upload failed:", upErr.message);
    return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  const { data: row, error: rowErr } = await supabase
    .from("client_photos")
    .insert({
      id,
      client_id: clientId,
      url: publicUrl,
      filename: file.name || `${id}.${ext}`,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select("id, url, filename, mime_type, size_bytes, uploaded_at")
    .single();

  if (rowErr) {
    console.error("[client-photos] db insert failed:", rowErr.message);
    // Clean up orphaned storage object
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    const hint = rowErr.message.includes("does not exist") || rowErr.message.includes("relation")
      ? ` — Tabelle "client_photos" fehlt vermutlich. Migration ausführen: supabase-migrations/2026-04-23-client-photos.sql`
      : "";
    return NextResponse.json({ error: `DB insert failed: ${rowErr.message}${hint}` }, { status: 500 });
  }

  return NextResponse.json(row);
}

// ── GET: list photos for a client (future gallery uses this) ──────────────

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  if (user.role === "client" && getEffectiveClientId(user) !== clientId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("client_photos")
    .select("id, url, filename, mime_type, size_bytes, uploaded_at")
    .eq("client_id", clientId)
    .order("uploaded_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
