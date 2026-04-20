import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { requireAdmin } from "@/lib/auth";

/**
 * Serves the preview image for a carousel style.
 * Admin-only. Looks for preview.png|jpg|webp in data/carousel-styles/<styleId>/.
 * GET /api/carousel/style-preview?id=01-bold-punchy
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  if (id.includes("..") || id.includes("/") || id.includes("\\")) {
    return new Response("Invalid id", { status: 400 });
  }

  const dir = join(process.cwd(), "data", "carousel-styles", id);
  const candidates = ["preview.png", "preview.jpg", "preview.jpeg", "preview.webp"];
  let filePath: string | null = null;
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(p)) { filePath = p; break; }
  }
  if (!filePath) return new Response("No preview", { status: 404 });

  const data = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const mime =
    ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".webp" ? "image/webp"
    : "application/octet-stream";

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
