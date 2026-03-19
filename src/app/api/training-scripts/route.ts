import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readTrainingScripts, writeTrainingScripts } from "@/lib/csv";
import type { TrainingScript } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  let scripts = await readTrainingScripts();
  if (clientId) {
    scripts = scripts.filter((s) => s.clientId === clientId);
  }
  return NextResponse.json(scripts);
}

export async function POST(request: Request) {
  const body: Omit<TrainingScript, "id" | "createdAt"> = await request.json();
  const scripts = await readTrainingScripts();
  const newScript: TrainingScript = {
    ...body,
    clientId: body.clientId || "",
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  scripts.push(newScript);
  await writeTrainingScripts(scripts);
  return NextResponse.json(newScript, { status: 201 });
}

export async function PUT(request: Request) {
  const body: TrainingScript = await request.json();
  const scripts = await readTrainingScripts();
  const idx = scripts.findIndex((s) => s.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  scripts[idx] = body;
  await writeTrainingScripts(scripts);
  return NextResponse.json(body);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const scripts = await readTrainingScripts();
  const filtered = scripts.filter((s) => s.id !== id);
  await writeTrainingScripts(filtered);
  return NextResponse.json({ success: true });
}
