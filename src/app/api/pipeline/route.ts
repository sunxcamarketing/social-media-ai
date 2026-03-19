import { runPipeline } from "@/lib/pipeline";
import type { PipelineParams } from "@/lib/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  const params: PipelineParams = await request.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runPipeline(params, (progress) => {
          const data = `data: ${JSON.stringify(progress)}\n\n`;
          controller.enqueue(encoder.encode(data));
        });
      } catch (err) {
        const errorData = `data: ${JSON.stringify({
          status: "error",
          errors: [err instanceof Error ? err.message : "Unknown error"],
          log: [],
          currentCreator: "",
          currentStep: "",
          creatorsCompleted: 0,
          creatorsTotal: 0,
          videosAnalyzed: 0,
          videosTotal: 0,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
