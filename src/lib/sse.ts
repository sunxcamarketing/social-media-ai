/**
 * Server-Sent Events helpers — used by all SSE API routes.
 * Replaces 4+ duplicated sendEvent functions.
 */

const encoder = new TextEncoder();

/** Enqueue a single SSE data frame. */
export function sendEvent(controller: ReadableStreamDefaultController, data: Record<string, unknown>) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

/** Standard SSE Response with correct headers. */
export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
