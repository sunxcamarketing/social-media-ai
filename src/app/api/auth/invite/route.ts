import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { email, clientId } = await request.json();

  if (!email || !clientId) {
    return Response.json({ error: "Email und Client-ID erforderlich" }, { status: 400 });
  }

  // Verify client exists
  const { data: config } = await supabase
    .from("configs")
    .select("id")
    .eq("id", clientId)
    .single();

  if (!config) {
    return Response.json({ error: "Client nicht gefunden" }, { status: 404 });
  }

  // Create admin client for user management
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Invite user via Supabase Auth (sends magic link email)
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    // If user already exists, just look up the user
    if (inviteError.message.includes("already been registered") || inviteError.message.includes("already exists")) {
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const existingUser = users?.find(u => u.email === email);
      if (!existingUser) {
        return Response.json({ error: "User existiert aber konnte nicht gefunden werden" }, { status: 500 });
      }

      // Check if mapping already exists
      const { data: existing } = await supabase
        .from("client_users")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("client_id", clientId)
        .single();

      if (existing) {
        return Response.json({ error: "Dieser User hat bereits Zugriff auf diesen Client" }, { status: 409 });
      }

      // Create mapping
      const { error: mapError } = await supabase
        .from("client_users")
        .insert({
          user_id: existingUser.id,
          client_id: clientId,
          role: "client",
          accepted_at: new Date().toISOString(),
        });

      if (mapError) {
        return Response.json({ error: mapError.message }, { status: 500 });
      }

      return Response.json({ success: true, message: "Zugriff gewährt (User existierte bereits)" });
    }

    return Response.json({ error: inviteError.message }, { status: 500 });
  }

  // Create client_users mapping
  if (inviteData.user) {
    const { error: mapError } = await supabase
      .from("client_users")
      .insert({
        user_id: inviteData.user.id,
        client_id: clientId,
        role: "client",
      });

    if (mapError) {
      return Response.json({ error: mapError.message }, { status: 500 });
    }
  }

  return Response.json({ success: true, message: "Einladung gesendet" });
}

// List invited users for a client
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return Response.json({ error: "clientId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("client_users")
    .select("*")
    .eq("client_id", clientId)
    .eq("role", "client");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Enrich with email from auth
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const enriched = await Promise.all(
    (data || []).map(async (cu) => {
      const { data: { user } } = await adminClient.auth.admin.getUserById(cu.user_id);
      return {
        id: cu.id,
        userId: cu.user_id,
        email: user?.email || "?",
        invitedAt: cu.invited_at,
        acceptedAt: cu.accepted_at,
      };
    })
  );

  return Response.json(enriched);
}

// Revoke access
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("client_users")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
