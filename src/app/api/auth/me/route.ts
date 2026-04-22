import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const effectiveClientId = user.impersonating?.clientId ?? user.clientId;

  return Response.json({
    id: user.id,
    email: user.email,
    role: user.role,
    clientId: effectiveClientId,
    invitedAt: user.invitedAt ?? null,
    impersonating: user.impersonating ?? null,
  });
}
