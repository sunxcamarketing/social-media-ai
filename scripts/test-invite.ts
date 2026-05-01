// DEV-SCRIPT — not used in production. Run via: npx tsx --require dotenv/config scripts/<this-file>
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sendInviteEmail } from "../src/lib/emails/invite";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://app.sunxca.com").replace(/\/$/, "");
const TARGET_EMAIL = process.argv[2] || "caliskan2809+sunxcatest2@gmail.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteExistingUser(email: string): Promise<void> {
  const { data } = await supabase.auth.admin.listUsers();
  const existing = data.users?.find((u) => u.email === email);
  if (existing) {
    console.log(`Deleting existing user ${existing.id}...`);
    await supabase.auth.admin.deleteUser(existing.id);
  }
}

async function run() {
  console.log(`Target: ${TARGET_EMAIL}`);
  await deleteExistingUser(TARGET_EMAIL);

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: TARGET_EMAIL,
  });

  if (error) {
    console.error("generateLink failed:", error.message);
    process.exit(1);
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    console.error("No hashed_token in response");
    process.exit(1);
  }

  const verifyUrl = `${APP_URL}/auth/verify?token_hash=${encodeURIComponent(tokenHash)}&type=invite&next=/portal`;
  console.log(`Verify URL: ${verifyUrl}`);

  await sendInviteEmail({ to: TARGET_EMAIL, verifyUrl });
  console.log("Email sent via Resend.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});