import { NextResponse } from "next/server";
import { readConfigLight } from "@/lib/csv";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Clients can only access their own config
  if (user.role === "client" && user.clientId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await readConfigLight(id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(config);
}
