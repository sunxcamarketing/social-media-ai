import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readConfigs } from "@/lib/csv";
import type { Config } from "@/lib/types";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Clients shouldn't list all configs — redirect to their own via /api/configs/[id]
  if (user.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configs = await readConfigs();
  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const body = await request.json();
  const newConfig: Config = {
    id: uuid(),
    configName: body.configName,
    creatorsCategory: body.creatorsCategory || "",
    name: body.name || "",
    company: body.company || "",
    role: body.role || "",
    location: body.location || "",
    businessContext: body.businessContext || "",
    professionalBackground: body.professionalBackground || "",
    keyAchievements: body.keyAchievements || "",
    website: body.website || "",
    instagram: body.instagram || "",
    tiktok: body.tiktok || "",
    youtube: body.youtube || "",
    linkedin: body.linkedin || "",
    twitter: body.twitter || "",
    strategyGoal: body.strategyGoal || "",
    strategyPillars: body.strategyPillars || "",
    strategyWeekly: body.strategyWeekly || "",
    performanceInsights: body.performanceInsights || "",
    postsPerWeek: body.postsPerWeek || "5",
    brandFeeling: body.brandFeeling || "",
    brandProblem: body.brandProblem || "",
    brandingStatement: body.brandingStatement || "",
    humanDifferentiation: body.humanDifferentiation || "",
    dreamCustomer: body.dreamCustomer || "",
    customerProblems: body.customerProblems || "",
    providerRole: body.providerRole || "",
    providerBeliefs: body.providerBeliefs || "",
    providerStrengths: body.providerStrengths || "",
    igFullName: "", igBio: "", igFollowers: "", igFollowing: "",
    igPostsCount: "", igProfilePicUrl: "", igCategory: "", igVerified: "", igLastUpdated: "",
    authenticityZone: body.authenticityZone || "",
    coreOffer: body.coreOffer || "",
    mainGoal: body.mainGoal || "",
    voiceProfile: "",
    scriptStructure: "",
    googleDriveFolder: body.googleDriveFolder || "",
    language: body.language === "en" ? "en" : "de",
    styleVibe: body.styleVibe || "",
    colorPalette: body.colorPalette || "",
    fontStyle: body.fontStyle || "",
    customFonts: body.customFonts || "",
    inspirationReels: body.inspirationReels || "",
    inspirationProfiles: body.inspirationProfiles || "",
    isOwner: body.isOwner === true,
  };
  try {
    const { insertConfig } = await import("@/lib/csv");
    await insertConfig(newConfig);
    return NextResponse.json(newConfig, { status: 201 });
  } catch (e) {
    console.error("POST /api/configs error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Create failed" }, { status: 500 });
  }
}

// Fields a client may write on their own config from the portal. Anything
// outside this list is admin-only (strategy, voice profile blobs, billing,
// IG cache, etc.). Mirrors the questions surfaced in the portal voice
// setup checklist.
const CLIENT_WRITABLE_FIELDS = new Set<keyof Config>([
  "businessContext",
  "professionalBackground",
  "keyAchievements",
  "coreOffer",
  "mainGoal",
  "brandFeeling",
  "brandProblem",
  "brandingStatement",
  "humanDifferentiation",
  "providerRole",
  "providerBeliefs",
  "providerStrengths",
  "authenticityZone",
]);

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let payload: Record<string, unknown> = body;

  if (user.role === "client") {
    if (user.clientId !== body.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Filter to allowlist — silently dropping foreign fields is safer than
    // 400ing on, say, a stale UI sending an extra metadata key.
    const allowed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === "id") continue;
      if (CLIENT_WRITABLE_FIELDS.has(k as keyof Config)) allowed[k] = v;
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Keine erlaubten Felder im Update" }, { status: 400 });
    }
    payload = { id: body.id, ...allowed };
  }

  try {
    const { updateConfig } = await import("@/lib/csv");
    const updated = await updateConfig(body.id, payload);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("PUT /api/configs error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { deleteConfig } = await import("@/lib/csv");
  await deleteConfig(id);
  return NextResponse.json({ success: true });
}
