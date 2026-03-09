import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readTrainingScripts, writeTrainingScripts } from "@/lib/csv";
import type { TrainingScript } from "@/lib/types";

export async function GET() {
  const scripts = readTrainingScripts();
  return NextResponse.json(scripts);
}

export async function POST(request: Request) {
  const body: Omit<TrainingScript, "id" | "createdAt"> = await request.json();
  const scripts = readTrainingScripts();
  const newScript: TrainingScript = {
    ...body,
    id: uuid(),
    createdAt: new Date().toISOString(),
  };
  scripts.push(newScript);
  writeTrainingScripts(scripts);
  return NextResponse.json(newScript, { status: 201 });
}

export async function PUT(request: Request) {
  const body: TrainingScript = await request.json();
  const scripts = readTrainingScripts();
  const idx = scripts.findIndex((s) => s.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  scripts[idx] = body;
  writeTrainingScripts(scripts);
  return NextResponse.json(body);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const scripts = readTrainingScripts();
  const filtered = scripts.filter((s) => s.id !== id);
  writeTrainingScripts(filtered);
  return NextResponse.json({ success: true });
}
