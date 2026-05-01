import { createSupabaseServer } from "./supabase-server";
import { supabase } from "./supabase";
import { cookies } from "next/headers";

type UserRole = "admin" | "client";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  clientId: string | null;
  invitedAt?: string | null;
  /** Stored in Supabase Auth user_metadata.first_name */
  firstName?: string | null;
  /** Stored in Supabase Auth user_metadata.last_name */
  lastName?: string | null;
  impersonating?: { clientId: string; clientName: string };
}

const NO_ROWS_FOUND = "PGRST116";

export async function getCurrentUser(): Promise<AppUser | null> {
  const serverSupabase = await createSupabaseServer();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const { data: clientUser, error } = await supabase
    .from("client_users")
    .select("role, client_id, invited_at")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const meta = (user.user_metadata || {}) as { first_name?: string; last_name?: string };

  if (!clientUser && error?.code !== NO_ROWS_FOUND) {
    return buildAppUser(user.id, user.email, "admin", null, null, meta.first_name, meta.last_name);
  }

  if (!clientUser) return null;

  const role = clientUser.role as UserRole;
  const base = buildAppUser(
    user.id,
    user.email,
    role,
    clientUser.client_id,
    clientUser.invited_at ?? null,
    meta.first_name,
    meta.last_name,
  );

  if (role === "admin") {
    const impersonating = await readImpersonation();
    if (impersonating) base.impersonating = impersonating;
  }

  return base;
}

async function readImpersonation(): Promise<{ clientId: string; clientName: string } | null> {
  const cookieStore = await cookies();
  const clientId = cookieStore.get("impersonate_client_id")?.value;
  if (!clientId) return null;

  const { data } = await supabase
    .from("configs")
    .select("id, configName, name")
    .eq("id", clientId)
    .single();

  if (!data) return null;
  return { clientId: data.id, clientName: data.configName || data.name || "Client" };
}

function buildAppUser(
  id: string,
  email: string | undefined,
  role: UserRole,
  clientId: string | null,
  invitedAt: string | null = null,
  firstName?: string,
  lastName?: string,
): AppUser {
  return {
    id,
    email: email || "",
    role,
    clientId,
    invitedAt,
    firstName: firstName || null,
    lastName: lastName || null,
  };
}

/**
 * Effective client ID: impersonated client for admin, own client_id for client user.
 */
export function getEffectiveClientId(user: AppUser): string | null {
  if (user.impersonating) return user.impersonating.clientId;
  if (user.role === "client") return user.clientId;
  return null;
}

/**
 * Require the current user to be an admin. Returns the user or throws a Response.
 */
export async function requireAdmin(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (user.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  return user;
}

/**
 * Require the current user to have access to a specific client.
 * Admins always have access. Clients only to their own.
 */
export async function requireClientAccess(clientId: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  if (user.role === "admin") return user;
  if (user.clientId !== clientId) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  return user;
}

/**
 * Get all client IDs the user has access to.
 * Admins: all configs. Clients: only their own.
 */
export async function getAccessibleClientIds(user: AppUser): Promise<string[]> {
  if (user.role === "admin") {
    const { data } = await supabase.from("configs").select("id");
    return (data || []).map((r: { id: string }) => r.id);
  }
  return user.clientId ? [user.clientId] : [];
}
