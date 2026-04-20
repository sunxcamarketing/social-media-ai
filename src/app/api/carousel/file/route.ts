import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { requireAdmin } from "@/lib/auth";

/**
 * Serves files from output/carousels/<runId>/<path> to the admin UI.
 * Admin-only. Strips path traversal attempts.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const url = new URL(request.url);
  const runId = url.searchParams.get("run");
  const file = url.searchParams.get("file");

  if (!runId || !file) {
    return new Response("Missing run or file param", { status: 400 });
  }

  // Sanitize: no path traversal, no absolute paths
  if (
    runId.includes("..") ||
    runId.includes("/") ||
    runId.includes("\\") ||
    file.includes("..") ||
    file.startsWith("/") ||
    file.startsWith("\\")
  ) {
    return new Response("Invalid path", { status: 400 });
  }

  const filePath = join(process.cwd(), "output", "carousels", runId, file);
  if (!existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const data = readFileSync(filePath);
  const ext = extname(file).toLowerCase();
  const mime =
    ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".webp" ? "image/webp"
    : ext === ".html" ? "text/html; charset=utf-8"
    : "application/octet-stream";

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
