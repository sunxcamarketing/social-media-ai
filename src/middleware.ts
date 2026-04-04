import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const PUBLIC_ROUTES = ["/login", "/no-access"] as const;
const PUBLIC_PREFIXES = ["/viral-guide", "/api/", "/_next/", "/favicon"] as const;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname === route) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const roleRedirect = await resolveRoleRedirect(user.id, pathname);
  if (roleRedirect) {
    return NextResponse.redirect(new URL(roleRedirect, request.url));
  }

  return response;
}

const NO_ROWS_FOUND = "PGRST116";

/**
 * Look up the user's role and return a redirect path if they shouldn't
 * be on `pathname`, or null if access is allowed.
 */
async function resolveRoleRedirect(
  userId: string,
  pathname: string,
): Promise<string | null> {
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: clientUser, error } = await serviceClient
    .from("client_users")
    .select("role, client_id")
    .eq("user_id", userId)
    .limit(1)
    .single();

  // Table missing or unexpected error — allow through (setup mode)
  if (error && error.code !== NO_ROWS_FOUND) return null;

  // No client_users entry — no access
  if (!clientUser) return "/no-access";

  const isClient = clientUser.role === "client";
  const isPortalRoute = pathname.startsWith("/portal");

  // Clients can only access /portal
  if (isClient && !isPortalRoute) return "/portal";

  // Only clients can access /portal — admins use the admin UI
  if (isPortalRoute && !isClient) return "/";

  return null;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
