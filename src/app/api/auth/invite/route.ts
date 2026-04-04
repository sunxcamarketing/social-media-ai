import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// supabase (from lib/supabase) already uses SUPABASE_SERVICE_ROLE_KEY — reuse it
// for both DB queries and auth admin operations.

function buildCallbackUrl(request: Request): string {
  const host = request.headers.get("host") || "localhost:4000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/api/auth/callback?next=/portal`;
}

function isUserAlreadyExistsError(message: string): boolean {
  return (
    message.includes("already been registered") ||
    message.includes("already exists")
  );
}

async function createClientUserMapping(
  userId: string,
  clientId: string,
  options?: { accepted: boolean }
): Promise<Response | null> {
  const { error } = await supabase.from("client_users").insert({
    user_id: userId,
    client_id: clientId,
    role: "client",
    ...(options?.accepted && { accepted_at: new Date().toISOString() }),
  });

  if (error) {
    return Response.json(
      { error: "Fehler beim Erstellen des Zugriffs" },
      { status: 500 }
    );
  }
  return null;
}

async function grantAccessToExistingUser(
  email: string,
  clientId: string
): Promise<Response> {
  const {
    data: { users },
  } = await supabase.auth.admin.listUsers();
  const existingUser = users?.find((u) => u.email === email);

  if (!existingUser) {
    return Response.json(
      { error: "User existiert aber konnte nicht gefunden werden" },
      { status: 500 }
    );
  }

  const { data: existingMapping } = await supabase
    .from("client_users")
    .select("id")
    .eq("user_id", existingUser.id)
    .eq("client_id", clientId)
    .single();

  if (existingMapping) {
    return Response.json(
      { error: "Dieser User hat bereits Zugriff auf diesen Client" },
      { status: 409 }
    );
  }

  const errorResponse = await createClientUserMapping(
    existingUser.id,
    clientId,
    { accepted: true }
  );
  if (errorResponse) return errorResponse;

  return Response.json({
    success: true,
    message: "Zugriff gewährt (User existierte bereits)",
  });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { email, clientId } = await request.json();

  if (!email || !clientId) {
    return Response.json(
      { error: "Email und Client-ID erforderlich" },
      { status: 400 }
    );
  }

  const { data: config } = await supabase
    .from("configs")
    .select("id")
    .eq("id", clientId)
    .single();

  if (!config) {
    return Response.json({ error: "Client nicht gefunden" }, { status: 404 });
  }

  const redirectTo = buildCallbackUrl(request);
  const { data: inviteData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });

  if (inviteError) {
    if (isUserAlreadyExistsError(inviteError.message)) {
      return grantAccessToExistingUser(email, clientId);
    }
    return Response.json(
      { error: "Einladung konnte nicht gesendet werden" },
      { status: 500 }
    );
  }

  if (inviteData.user) {
    const errorResponse = await createClientUserMapping(
      inviteData.user.id,
      clientId
    );
    if (errorResponse) return errorResponse;
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

  const { data: clientUsers, error } = await supabase
    .from("client_users")
    .select("*")
    .eq("client_id", clientId)
    .eq("role", "client");

  if (error) {
    return Response.json({ error: "Fehler beim Laden der User" }, { status: 500 });
  }

  const enriched = await Promise.all(
    (clientUsers || []).map(async (cu) => {
      const {
        data: { user },
      } = await supabase.auth.admin.getUserById(cu.user_id);
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
    return Response.json({ error: "Fehler beim Entfernen des Zugriffs" }, { status: 500 });
  }

  return Response.json({ success: true });
}
