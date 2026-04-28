/**
 * Create a new admin user (Aysun's team members).
 *
 * Creates a Supabase Auth user with the given email/password,
 * confirms the email automatically (no verification flow), and adds
 * a client_users row with role='admin' so the user has full access.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts <email> <password>
 *
 * Example:
 *   npx tsx scripts/create-admin.ts neuemitarbeiterin@example.com sicheres-passwort
 *
 * Notes:
 * - The password lives in shell history but NEVER in git.
 * - The user should change their password on first login.
 * - Idempotent: re-running on an existing email upgrades the row to admin
 *   instead of failing.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

// Lightweight .env loader — avoids dotenv version mismatches
function loadEnv() {
  try {
    const env = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const [, key, rawVal] = m;
      if (process.env[key]) continue; // don't override
      const val = rawVal.replace(/^["'](.*)["']$/, "$1");
      process.env[key] = val;
    }
  } catch {
    /* .env optional in CI */
  }
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: npx tsx scripts/create-admin.ts <email> <password>");
  process.exit(1);
}

if (password.length < 8) {
  console.error("✗ Passwort muss mindestens 8 Zeichen haben.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log(`\n→ Lege Admin an: ${email}\n`);

  // 1. Check if user already exists in Auth
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.error("✗ Fehler beim User-Listing:", listErr.message);
    process.exit(1);
  }

  let userId: string | undefined = users.find(u => u.email?.toLowerCase() === email.toLowerCase())?.id;

  if (userId) {
    console.log(`  ↺ User existiert schon (${userId}) — setze neues Passwort.`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updErr) {
      console.error("✗ Passwort-Update fehlgeschlagen:", updErr.message);
      process.exit(1);
    }
    console.log("  ✓ Passwort aktualisiert.");
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification — internal account
    });
    if (createErr || !created.user) {
      console.error("✗ Auth-Create fehlgeschlagen:", createErr?.message || "no user returned");
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`  ✓ Auth-User erstellt: ${userId}`);
  }

  // 2. Upsert admin mapping in client_users
  const { data: existing } = await supabase
    .from("client_users")
    .select("id, role")
    .eq("user_id", userId)
    .is("client_id", null)
    .maybeSingle();

  if (existing) {
    if (existing.role === "admin") {
      console.log("  ✓ Admin-Mapping existiert bereits.");
    } else {
      const { error: upErr } = await supabase
        .from("client_users")
        .update({ role: "admin" })
        .eq("id", existing.id);
      if (upErr) {
        console.error("✗ Mapping-Update fehlgeschlagen:", upErr.message);
        process.exit(1);
      }
      console.log("  ✓ Mapping auf 'admin' upgegradet.");
    }
  } else {
    const { error: insErr } = await supabase.from("client_users").insert({
      user_id: userId,
      role: "admin",
      client_id: null,
    });
    if (insErr) {
      console.error("✗ Admin-Mapping fehlgeschlagen:", insErr.message);
      process.exit(1);
    }
    console.log("  ✓ Admin-Mapping erstellt.");
  }

  console.log(`\n✅ Fertig. ${email} kann sich jetzt einloggen.\n`);
  console.log("   Empfehlung: nach erstem Login Passwort wechseln lassen.\n");
}

run().catch(err => {
  console.error("✗ Unerwarteter Fehler:", err);
  process.exit(1);
});
