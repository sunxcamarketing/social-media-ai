import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAllLists } from "@/lib/clickup";

/** Admin-only: returns every ClickUp list the agency token has access to,
 *  flattened with "Space › Folder › List" paths so the admin UI can show
 *  a searchable dropdown instead of asking for raw list IDs. */
export async function GET() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }
  const result = await listAllLists();
  return NextResponse.json(result);
}
