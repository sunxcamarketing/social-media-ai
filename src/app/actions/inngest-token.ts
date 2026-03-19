"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken } from "@inngest/realtime";

export async function fetchPipelineToken(eventId: string) {
  const token = await getSubscriptionToken(inngest, {
    channel: `pipeline:${eventId}`,
    topics: ["progress"],
  });
  return token;
}
