// ── Admin user management ──────────────────────────────────────────────────
// Admins live in the same client_users table as portal users, but with
// role="admin" and client_id=null. Names are stored on the auth.users
// user_metadata (Supabase Auth's native place for profile data) so they
// follow the user across role changes and are available everywhere
// `getCurrentUser()` is used (e.g. dashboard greeting).

import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { sendInviteEmail } from "@/lib/emails/invite";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://app.sunxca.com").replace(/\/$/, "");

interface AdminRow {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  isCurrent: boolean;
}

interface AuthMeta {
  first_name?: string;
  last_name?: string;
}

function readNames(meta: unknown): { firstName: string | null; lastName: string | null } {
  const m = (meta || {}) as AuthMeta;
  return { firstName: m.first_name || null, lastName: m.last_name || null };
}

export async function GET() {
  let me;
  try {
    me = await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { data: rows, error } = await supabase
    .from("client_users")
    .select("id, user_id, invited_at, accepted_at")
    .eq("role", "admin");
  if (error) {
    return Response.json({ error: "Konnte Admins nicht laden" }, { status: 500 });
  }

  const enriched: AdminRow[] = await Promise.all(
    (rows || []).map(async (r) => {
      const { data } = await supabase.auth.admin.getUserById(r.user_id);
      const names = readNames(data.user?.user_metadata);
      return {
        id: r.id,
        userId: r.user_id,
        email: data.user?.email || "?",
        firstName: names.firstName,
        lastName: names.lastName,
        invitedAt: r.invited_at,
        acceptedAt: r.accepted_at,
        isCurrent: r.user_id === me.id,
      };
    }),
  );

  enriched.sort((a, b) => {
    const aLabel = (a.firstName || a.email).toLowerCase();
    const bLabel = (b.firstName || b.email).toLowerCase();
    return aLabel.localeCompare(bLabel);
  });
  return Response.json(enriched);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  const email = body.email?.trim();
  const firstName = body.firstName?.trim() || "";
  const lastName = body.lastName?.trim() || "";

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Gültige Email erforderlich" }, { status: 400 });
  }

  const meta = { first_name: firstName, last_name: lastName };

  // Check whether this user already exists in Supabase Auth. Default page
  // size is 50, which we'd silently exceed once the agency has more users —
  // bump perPage so the lookup is reliable for the foreseeable future.
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = existing?.users?.find((u) => u.email === email);

  if (existingUser) {
    // Merge name metadata — never overwrite a non-empty name with empty input.
    const currentMeta = (existingUser.user_metadata || {}) as AuthMeta;
    const mergedMeta = {
      ...currentMeta,
      first_name: firstName || currentMeta.first_name || "",
      last_name: lastName || currentMeta.last_name || "",
    };
    await supabase.auth.admin.updateUserById(existingUser.id, { user_metadata: mergedMeta });

    const { data: mapping } = await supabase
      .from("client_users")
      .select("id, role")
      .eq("user_id", existingUser.id)
      .limit(1)
      .maybeSingle();

    if (mapping?.role === "admin") {
      return Response.json({ error: "Diese Email ist schon Admin" }, { status: 409 });
    }

    if (mapping) {
      const { error: updErr } = await supabase
        .from("client_users")
        .update({ role: "admin", client_id: null, accepted_at: new Date().toISOString() })
        .eq("id", mapping.id);
      if (updErr) return Response.json({ error: "Update fehlgeschlagen" }, { status: 500 });
      return Response.json({ success: true, message: "Bestehender User auf Admin gesetzt" });
    }

    const { error: insErr } = await supabase.from("client_users").insert({
      user_id: existingUser.id,
      client_id: null,
      role: "admin",
      accepted_at: new Date().toISOString(),
    });
    if (insErr) return Response.json({ error: "Konnte Admin-Zugriff nicht erstellen" }, { status: 500 });
    return Response.json({ success: true, message: "Admin-Zugriff hinzugefügt" });
  }

  // New user → invite via magic-link email
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
  });
  if (linkError || !linkData.user || !linkData.properties?.hashed_token) {
    return Response.json({ error: "Einladung konnte nicht erzeugt werden" }, { status: 500 });
  }

  // Set name metadata on the freshly created user.
  await supabase.auth.admin.updateUserById(linkData.user.id, { user_metadata: meta });

  const { error: insErr } = await supabase.from("client_users").insert({
    user_id: linkData.user.id,
    client_id: null,
    role: "admin",
  });
  if (insErr) {
    return Response.json({ error: "Konnte Admin-Zugriff nicht erstellen" }, { status: 500 });
  }

  const verifyUrl = `${APP_URL}/auth/verify?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=invite&next=/admin`;
  try {
    await sendInviteEmail({ to: email, verifyUrl });
  } catch (err) {
    return Response.json(
      { error: `Einladung gespeichert, Email-Versand fehlgeschlagen: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return Response.json({ success: true, message: "Admin eingeladen" });
}

/** Edit name on an existing admin row (without re-inviting). */
export async function PATCH(request: Request) {
  try {
    await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    firstName?: string;
    lastName?: string;
  };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });

  const { data: target } = await supabase
    .from("client_users")
    .select("user_id, role")
    .eq("id", body.id)
    .single();
  if (!target || target.role !== "admin") {
    return Response.json({ error: "Admin nicht gefunden" }, { status: 404 });
  }

  const { data: existing } = await supabase.auth.admin.getUserById(target.user_id);
  const currentMeta = (existing.user?.user_metadata || {}) as AuthMeta;
  const mergedMeta = {
    ...currentMeta,
    first_name: body.firstName?.trim() ?? currentMeta.first_name ?? "",
    last_name: body.lastName?.trim() ?? currentMeta.last_name ?? "",
  };

  const { error: updErr } = await supabase.auth.admin.updateUserById(target.user_id, {
    user_metadata: mergedMeta,
  });
  if (updErr) return Response.json({ error: "Update fehlgeschlagen" }, { status: 500 });
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  let me;
  try {
    me = await requireAdmin();
  } catch (res) {
    return res as Response;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const { data: target } = await supabase
    .from("client_users")
    .select("user_id, role")
    .eq("id", id)
    .single();
  if (!target) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  if (target.role !== "admin") {
    return Response.json({ error: "Nur Admin-Zugriffe können hier entfernt werden" }, { status: 400 });
  }
  if (target.user_id === me.id) {
    return Response.json({ error: "Du kannst dich nicht selbst entfernen" }, { status: 400 });
  }

  const { count } = await supabase
    .from("client_users")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if ((count ?? 0) <= 1) {
    return Response.json({ error: "Letzter Admin kann nicht entfernt werden" }, { status: 400 });
  }

  const { error } = await supabase.from("client_users").delete().eq("id", id);
  if (error) return Response.json({ error: "Entfernen fehlgeschlagen" }, { status: 500 });
  return Response.json({ success: true });
}
