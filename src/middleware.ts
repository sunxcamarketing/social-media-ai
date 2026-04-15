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

  const impersonating = Boolean(request.cookies.get("impersonate_client_id")?.value);
  const roleRedirect = await resolveRoleRedirect(user.id, pathname, impersonating);
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
  impersonating: boolean,
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

  if (error && error.code !== NO_ROWS_FOUND) return null;
  if (!clientUser) return "/no-access";

  const isClient = clientUser.role === "client";
  const isPortalRoute = pathname.startsWith("/portal");

  if (isClient && !isPortalRoute) return "/portal";

  // Admins reach /portal only while impersonating. Without the cookie they
  // get bounced to the admin UI.
  if (isPortalRoute && !isClient && !impersonating) return "/";

  return null;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
