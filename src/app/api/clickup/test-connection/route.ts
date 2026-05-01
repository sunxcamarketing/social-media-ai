import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { testConnection } from "@/lib/clickup";

/** Quick "verify list id" check used by the admin UI before saving.
 *  Token is read from env (CLICKUP_API_TOKEN), only the list id comes
 *  from the request. Stays admin-only. */
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { listId } = (await request.json().catch(() => ({}))) as { listId?: string };
  if (!listId) {
    return NextResponse.json({ ok: false, error: "listId required" }, { status: 400 });
  }

  const result = await testConnection(listId);
  return NextResponse.json(result);
}
