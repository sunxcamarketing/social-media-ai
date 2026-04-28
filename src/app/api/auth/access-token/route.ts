import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

// Returns the current user's Supabase access_token.
// Used by client components (e.g. Voice Agent) that need to authenticate
// against external services like the Voice WS server. The browser client's
// getSession() can be unreliable when auth cookies are httpOnly — this
// server-side route reads the session through the SSR cookie helper.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ access_token: session.access_token });
}
