import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cookies } from "next/headers";

// Set impersonate cookie
export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { clientId } = await request.json();

  if (!clientId) {
    return Response.json({ error: "clientId required" }, { status: 400 });
  }

  // Verify client exists
  const { data } = await supabase.from("configs").select("id").eq("id", clientId).single();
  if (!data) {
    return Response.json({ error: "Client nicht gefunden" }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set("impersonate_client_id", clientId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24h
  });

  return Response.json({ success: true });
}

// Clear impersonate cookie
export async function DELETE() {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const cookieStore = await cookies();
  cookieStore.set("impersonate_client_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return Response.json({ success: true });
}
