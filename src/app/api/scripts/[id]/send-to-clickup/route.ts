import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { syncScriptToClickUp } from "@/lib/clickup-sync";

/** Manual ClickUp push from the admin scripts page. Identical machinery
 *  as the auto-trigger on client approval, but: (a) admin-only, (b) result
 *  is awaited and surfaced so the UI can show success/error. Used for
 *  owner brands (no client portal loop) and as override for normal clients. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { id } = await params;
  const result = await syncScriptToClickUp(id);

  if (!result.ok) {
    const status = result.reason === "no-script" ? 404 : result.reason === "no-list" ? 400 : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
