import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const { data, error } = await supabase
    .from("configs")
    .select(`id, "configName", name, "voiceOnboarding"`)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });

  const raw = (data.voiceOnboarding as string) || "";
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = { parseError: true, raw };
  }

  return NextResponse.json({
    id: data.id,
    configName: data.configName,
    name: data.name,
    voiceOnboardingRawLength: raw.length,
    voiceOnboarding: parsed,
  });
}
