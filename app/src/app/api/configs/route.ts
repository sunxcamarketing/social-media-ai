import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readConfigs, writeConfigs } from "@/lib/csv";
import type { Config } from "@/lib/types";

export async function GET() {
  const configs = readConfigs();
  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const body = await request.json();
  const configs = readConfigs();
  const newConfig: Config = {
    id: uuid(),
    configName: body.configName,
    creatorsCategory: body.creatorsCategory,
    analysisInstruction: body.analysisInstruction,
    newConceptsInstruction: body.newConceptsInstruction,
  };
  configs.push(newConfig);
  writeConfigs(configs);
  return NextResponse.json(newConfig, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const configs = readConfigs();
  const index = configs.findIndex((c) => c.id === body.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  configs[index] = { ...configs[index], ...body };
  writeConfigs(configs);
  return NextResponse.json(configs[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const configs = readConfigs();
  const filtered = configs.filter((c) => c.id !== id);
  writeConfigs(filtered);
  return NextResponse.json({ success: true });
}
