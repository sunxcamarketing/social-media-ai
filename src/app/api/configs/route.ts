import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { readConfigs, writeConfigs } from "@/lib/csv";
import type { Config } from "@/lib/types";

export async function GET() {
  const configs = await readConfigs();
  return NextResponse.json(configs);
}

export async function POST(request: Request) {
  const body = await request.json();
  const configs = await readConfigs();
  const newConfig: Config = {
    id: uuid(),
    configName: body.configName,
    creatorsCategory: body.creatorsCategory,
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
    voiceProfile: "",
  };
  configs.push(newConfig);
  await writeConfigs(configs);
  return NextResponse.json(newConfig, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const configs = await readConfigs();
  const index = configs.findIndex((c) => c.id === body.id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  configs[index] = { ...configs[index], ...body };
  await writeConfigs(configs);
  return NextResponse.json(configs[index]);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { deleteConfig } = await import("@/lib/csv");
  await deleteConfig(id);
  return NextResponse.json({ success: true });
}
