// DEV-SCRIPT — not used in production. Run via: npx tsx --require dotenv/config scripts/<this-file>
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sendInviteEmail } from "../src/lib/emails/invite";

const APP_URL = "https://app.sunxca.com";
const TARGET_EMAIL = "Annaherbst.Business@gmail.com";
const CLIENT_NAME_QUERY = "anna"; // lowercase substring match on configs.name

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findClient() {
  const { data } = await supabase.from("configs").select("id, name");
  const match = (data || []).find((c) =>
    c.name?.toLowerCase().includes(CLIENT_NAME_QUERY)
  );
  if (!match) {
    console.log("Available clients:", data?.map((c) => c.name).join(", "));
    throw new Error(`No client matching "${CLIENT_NAME_QUERY}"`);
  }
  return match;
}

async function getOrCreateUser(email: string) {
  const { data } = await supabase.auth.admin.listUsers();
  const existing = data.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    console.log(`User exists: ${existing.id}`);
    return existing;
  }
  console.log("User does not exist — generating invite link...");
  return null;
}

async function ensureMapping(userId: string, clientId: string) {
  const { data: existing } = await supabase
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .single();
  if (existing) {
    console.log(`Mapping already exists: ${existing.id}`);
    return;
  }
  const { error } = await supabase.from("client_users").insert({
    user_id: userId,
    client_id: clientId,
    role: "client",
    accepted_at: new Date().toISOString(),
  });
  if (error) throw error;
  console.log("Mapping created.");
}

async function run() {
  const client = await findClient();
  console.log(`Client: ${client.name} (${client.id})`);

  let user = await getOrCreateUser(TARGET_EMAIL);

  // Generate magic link (works for new + existing user)
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: user ? "magiclink" : "invite",
      email: TARGET_EMAIL,
    });
  if (linkError) throw linkError;

  if (!user) user = linkData.user;
  if (!user) throw new Error("No user after generateLink");

  await ensureMapping(user.id, client.id);

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) throw new Error("No hashed_token in response");

  const linkType = user ? "magiclink" : "invite";
  const verifyUrl = `${APP_URL}/auth/verify?token_hash=${encodeURIComponent(
    tokenHash
  )}&type=${linkType}&next=/portal`;
  console.log(`Verify URL: ${verifyUrl}`);

  await sendInviteEmail({ to: TARGET_EMAIL, verifyUrl });
  console.log(`✓ Email sent to ${TARGET_EMAIL}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});