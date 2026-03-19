import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import type { PipelineParams } from "@/lib/types";

export async function POST(request: Request) {
  const params: PipelineParams = await request.json();

  const { ids } = await inngest.send({
    name: "pipeline/run",
    data: params,
  });

  return NextResponse.json({ eventId: ids[0], status: "started" });
}
