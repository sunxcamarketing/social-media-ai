import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import type { ContentType, ContentFormat } from "@/lib/strategy";

export interface TrainingExample {
  id: string;
  url: string;
  contentType: string;
  format: string;
  note: string;
  addedAt: string;
}

const FILE = path.join(process.cwd(), "..", "data", "strategy.json");

interface StrategyConfig {
  customContentTypes: ContentType[];
  customFormats: ContentFormat[];
  trainingExamples: TrainingExample[];
}

function read(): StrategyConfig {
  if (!existsSync(FILE)) return { customContentTypes: [], customFormats: [], trainingExamples: [] };
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf-8"));
    return { customContentTypes: [], customFormats: [], trainingExamples: [], ...parsed };
  } catch {
    return { customContentTypes: [], customFormats: [], trainingExamples: [] };
  }
}

function write(data: StrategyConfig) {
  writeFileSync(FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json(read());
}

export async function POST(request: Request) {
  const body = await request.json();
  const data = read();

  if (body.kind === "contentType") {
    const entry: ContentType = { id: uuid(), name: body.name, goal: body.goal, bestFor: body.bestFor, custom: true };
    data.customContentTypes.push(entry);
  } else if (body.kind === "format") {
    const entry: ContentFormat = { id: uuid(), name: body.name, description: body.description, bestContentType: body.bestContentType, platform: body.platform, custom: true };
    data.customFormats.push(entry);
  } else if (body.kind === "trainingExample") {
    const entry: TrainingExample = {
      id: uuid(),
      url: body.url,
      contentType: body.contentType,
      format: body.format,
      note: body.note || "",
      addedAt: new Date().toISOString().split("T")[0],
    };
    data.trainingExamples.push(entry);
  }

  write(data);
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const data = read();

  if (body.kind === "contentType") {
    data.customContentTypes = data.customContentTypes.map((t) =>
      t.id === body.id ? { ...t, name: body.name, goal: body.goal, bestFor: body.bestFor } : t
    );
  } else if (body.kind === "format") {
    data.customFormats = data.customFormats.map((f) =>
      f.id === body.id ? { ...f, name: body.name, description: body.description, bestContentType: body.bestContentType, platform: body.platform } : f
    );
  }

  write(data);
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const kind = searchParams.get("kind");
  const data = read();
  if (kind === "contentType") data.customContentTypes = data.customContentTypes.filter(t => t.id !== id);
  if (kind === "format") data.customFormats = data.customFormats.filter(f => f.id !== id);
  if (kind === "trainingExample") data.trainingExamples = data.trainingExamples.filter(e => e.id !== id);
  write(data);
  return NextResponse.json(data);
}
