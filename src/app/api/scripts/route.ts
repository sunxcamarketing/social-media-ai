import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readScripts, writeScripts } from "@/lib/csv";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const scripts = await readScripts();
  return NextResponse.json(clientId ? scripts.filter(s => s.clientId === clientId) : scripts);
}

export async function POST(request: Request) {
  const body = await request.json();
  const scripts = await readScripts();
  const newScript = {
    id: uuid(),
    clientId: body.clientId || "",
    title: body.title || "",
    pillar: body.pillar || "",
    contentType: body.contentType || "",
    format: body.format || "",
    hook: body.hook || "",
    body: body.body || "",
    cta: body.cta || "",
    status: body.status || "entwurf",
    createdAt: new Date().toISOString().split("T")[0],
  };
  scripts.push(newScript);
  await writeScripts(scripts);
  return NextResponse.json(newScript, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const scripts = await readScripts();
  const index = scripts.findIndex(s => s.id === body.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  scripts[index] = { ...scripts[index], ...body };
  await writeScripts(scripts);
  return NextResponse.json(scripts[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const scripts = await readScripts();
  await writeScripts(scripts.filter(s => s.id !== id));
  return NextResponse.json({ success: true });
}
