import { createSupabaseServer } from "./supabase-server";
import { supabase } from "./supabase";
import { cookies } from "next/headers";

export interface AppUser {
  id: string;
  email: string;
  role: "admin" | "client";
  clientId: string | null; // null for admins
  impersonatingClientId: string | null; // set when admin views as client
}

/**
 * Get the current authenticated user with role and client mapping.
 * Returns null if not authenticated or no client_users entry exists.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const serverSupabase = await createSupabaseServer();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) return null;

  // Look up role in client_users (using service role for reliable access)
  let clientUser: { role: string; client_id: string | null } | null = null;
  try {
    const { data, error } = await supabase
      .from("client_users")
      .select("role, client_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (error || !data) {
      // No entry or table doesn't exist — treat as admin fallback for initial setup
      return {
        id: user.id,
        email: user.email || "",
        role: "admin" as const,
        clientId: null,
        impersonatingClientId: null,
      };
    }
    clientUser = data;
  } catch {
    // Table doesn't exist yet — fallback to admin
    return {
      id: user.id,
      email: user.email || "",
      role: "admin" as const,
      clientId: null,
      impersonatingClientId: null,
    };
  }

  const role = clientUser.role as "admin" | "client";
  const clientId = clientUser.client_id as string | null;

  // Check for admin impersonate cookie
  let impersonatingClientId: string | null = null;
  if (role === "admin") {
    const cookieStore = await cookies();
    const impersonateCookie = cookieStore.get("impersonate_client_id");
    if (impersonateCookie?.value) {
      impersonatingClientId = impersonateCookie.value;
    }
  }

  return {
    id: user.id,
    email: user.email || "",
    role,
    clientId,
    impersonatingClientId,
  };
}

/**
 * Get the effective client ID for the current user.
 * For clients: their own client_id.
 * For admins impersonating: the impersonated client_id.
 * For admins not impersonating: null (has access to all).
 */
export function getEffectiveClientId(user: AppUser): string | null {
  if (user.role === "client") return user.clientId;
  if (user.impersonatingClientId) return user.impersonatingClientId;
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
