import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readTrainingScripts, readTrainingScriptsByClient, writeTrainingScripts } from "@/lib/csv";
import type { TrainingScript } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let clientId = searchParams.get("clientId");

  if (user.role === "client") {
    clientId = user.clientId;
  }

  const scripts = clientId ? await readTrainingScriptsByClient(clientId) : await readTrainingScripts();
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
