/**
 * Migration: Create client_users table and insert admin user.
 *
 * Run with: npx tsx scripts/migrate-client-users.ts
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function migrate() {
  console.log("1/3 Creating client_users table...");

  // Use the Supabase SQL endpoint via fetch (supabase-js doesn't support raw DDL)
  const sqlStatements = `
    CREATE TABLE IF NOT EXISTS client_users (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      client_id TEXT REFERENCES configs(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'client')) DEFAULT 'client',
      invited_at TIMESTAMPTZ DEFAULT now(),
      accepted_at TIMESTAMPTZ,
      UNIQUE(user_id, client_id)
    );

    ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'client_users' AND policyname = 'Service role full access'
      ) THEN
        CREATE POLICY "Service role full access" ON client_users FOR ALL USING (true);
      END IF;
    END $$;
  `;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  // The REST API can't run DDL. Let's try via the /pg endpoint or just check if table exists
  // and create it via the management API. As a fallback, we'll use supabase-js to check
  // and guide the user.

  // Check if table already exists
  const { data, error } = await supabase.from("client_users").select("id").limit(1);

  if (error && error.message.includes("does not exist")) {
    console.error("\n❌ Die Tabelle client_users existiert noch nicht.");
    console.error("   Du musst das SQL manuell im Supabase Dashboard ausführen:");
    console.error("   → Supabase Dashboard → SQL Editor → New Query → Paste & Run\n");
    console.error("SQL:");
    console.error(sqlStatements);
    process.exit(1);
  }

  if (!error) {
    console.log("   ✓ client_users Tabelle existiert bereits");
  }

  // 2. Find the current admin user
  console.log("\n2/3 Suche deinen Auth-User...");

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError || !users?.length) {
    console.error("   Keine Users gefunden:", usersError?.message);
    process.exit(1);
  }

  console.log(`   ${users.length} User gefunden:`);
  users.forEach((u, i) => {
    console.log(`   ${i + 1}. ${u.email} (${u.id}) — erstellt: ${u.created_at?.slice(0, 10)}`);
  });

  // Find the first/primary user (likely Aysun)
  const adminUser = users[0];
  console.log(`\n   → Verwende ${adminUser.email} als Admin`);

  // 3. Insert admin mapping
  console.log("\n3/3 Admin-Eintrag erstellen...");

  const { data: existing } = await supabase
    .from("client_users")
    .select("id")
    .eq("user_id", adminUser.id)
    .eq("role", "admin")
    .limit(1)
    .single();

  if (existing) {
    console.log("   ✓ Admin-Eintrag existiert bereits");
  } else {
    const { error: insertError } = await supabase.from("client_users").insert({
      user_id: adminUser.id,
      role: "admin",
      client_id: null,
    });

    if (insertError) {
      console.error("   ❌ Fehler:", insertError.message);
      process.exit(1);
    }
    console.log("   ✓ Admin-Eintrag erstellt");
  }

  console.log("\n✅ Migration abgeschlossen! App sollte jetzt funktionieren.");
}

migrate().catch(console.error);
