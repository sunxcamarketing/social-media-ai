import { requireAdmin } from "@/lib/auth";
import { listAvailableStyles } from "@/lib/carousel/pipeline";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }
  return Response.json({ styles: listAvailableStyles() });
}
