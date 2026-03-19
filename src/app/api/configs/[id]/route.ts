import { NextResponse } from "next/server";
import { readConfigs } from "@/lib/csv";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const configs = await readConfigs();
  const config = configs.find((c) => c.id === id);
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(config);
}
