import { createSupabaseServer } from "./supabase-server";
import { supabase } from "./supabase";

type UserRole = "admin" | "client";

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  clientId: string | null;
}

const NO_ROWS_FOUND = "PGRST116";

/**
 * Get the current authenticated user with role and client mapping.
 * Returns null if not authenticated or no client_users entry exists.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const serverSupabase = await createSupabaseServer();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();

  if (!user) return null;

  const { data: clientUser, error } = await supabase
    .from("client_users")
    .select("role, client_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  // Table missing or unexpected error — treat as admin (setup mode)
  if (!clientUser && error?.code !== NO_ROWS_FOUND) {
    return buildAppUser(user.id, user.email, "admin", null);
  }

  // No entry found — no access
  if (!clientUser) return null;

  const role = clientUser.role as UserRole;

  return buildAppUser(user.id, user.email, role, clientUser.client_id);
}

function buildAppUser(
  id: string,
  email: string | undefined,
  role: UserRole,
  clientId: string | null,
): AppUser {
  return { id, email: email || "", role, clientId };
}

/**
 * Get the effective client ID for the current user.
 * For clients: their own client_id.
 * For admins: null (has access to all).
 */
export function getEffectiveClientId(user: AppUser): string | null {
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
