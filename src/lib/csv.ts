import { supabase } from "./supabase";
import type { Config, Creator, Video, Script, TrainingScript, Analysis } from "./types";

// ── Configs ─────────────────────────────────────────────────────────────────

export async function readConfigs(): Promise<Config[]> {
  const { data, error } = await supabase.from("configs").select("*");
  if (error) throw error;
  return (data || []) as Config[];
}

export async function writeConfigs(configs: Config[]) {
  const { error } = await supabase.from("configs").upsert(configs, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteConfig(id: string) {
  const { error } = await supabase.from("configs").delete().eq("id", id);
  if (error) throw error;
}

// ── Creators ────────────────────────────────────────────────────────────────

export async function readCreators(): Promise<Creator[]> {
  const { data, error } = await supabase.from("creators").select("*");
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    username: (r.username as string) || "",
    category: (r.category as string) || "",
    profilePicUrl: (r.profile_pic_url as string) || "",
    followers: (r.followers as number) || 0,
    reelsCount30d: (r.reels_count_30d as number) || 0,
    avgViews30d: (r.avg_views_30d as number) || 0,
    lastScrapedAt: (r.last_scraped_at as string) || "",
  }));
}

export async function writeCreators(creators: Creator[]) {
  const rows = creators.map((c) => ({
    id: c.id,
    username: c.username,
    category: c.category,
    profile_pic_url: c.profilePicUrl,
    followers: c.followers,
    reels_count_30d: c.reelsCount30d,
    avg_views_30d: c.avgViews30d,
    last_scraped_at: c.lastScrapedAt || null,
  }));
  const { error } = await supabase.from("creators").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

// ── Videos ───────────────────────────────────────────────────────────────────

export async function readVideos(): Promise<Video[]> {
  const { data, error } = await supabase.from("videos").select("*");
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    link: (r.link as string) || "",
    thumbnail: (r.thumbnail as string) || "",
    creator: (r.creator as string) || "",
    views: (r.views as number) || 0,
    likes: (r.likes as number) || 0,
    comments: (r.comments as number) || 0,
    durationSeconds: (r.duration_seconds as number) || 0,
    analysis: (r.analysis as string) || "",
    newConcepts: (r.new_concepts as string) || "",
    datePosted: (r.date_posted as string) || "",
    dateAdded: (r.date_added as string) || "",
    configName: (r.config_name as string) || "",
    starred: (r.starred as boolean) || false,
  }));
}

export async function writeVideos(videos: Video[]) {
  const rows = videos.map((v) => ({
    id: v.id,
    link: v.link,
    thumbnail: v.thumbnail,
    creator: v.creator,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    duration_seconds: v.durationSeconds,
    analysis: v.analysis,
    new_concepts: v.newConcepts,
    date_posted: v.datePosted || null,
    date_added: v.dateAdded || null,
    config_name: v.configName,
    starred: v.starred,
  }));
  const { error } = await supabase.from("videos").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

export async function appendVideo(video: Video) {
  const row = {
    id: video.id,
    link: video.link,
    thumbnail: video.thumbnail,
    creator: video.creator,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    duration_seconds: video.durationSeconds,
    analysis: video.analysis,
    new_concepts: video.newConcepts,
    date_posted: video.datePosted || null,
    date_added: video.dateAdded || null,
    config_name: video.configName,
    starred: video.starred,
  };
  const { error } = await supabase.from("videos").insert(row);
  if (error) throw error;
}

// ── Scripts ──────────────────────────────────────────────────────────────────

export async function readScripts(): Promise<Script[]> {
  const { data, error } = await supabase.from("scripts").select("*");
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    title: (r.title as string) || "",
    pillar: (r.pillar as string) || "",
    contentType: (r.content_type as string) || "",
    format: (r.format as string) || "",
    hook: (r.hook as string) || "",
    body: (r.body as string) || "",
    cta: (r.cta as string) || "",
    status: (r.status as string) || "entwurf",
    createdAt: (r.created_at as string) || "",
  }));
}

export async function writeScripts(scripts: Script[]) {
  const rows = scripts.map((s) => ({
    id: s.id,
    client_id: s.clientId,
    title: s.title,
    pillar: s.pillar,
    content_type: s.contentType,
    format: s.format,
    hook: s.hook,
    body: s.body,
    cta: s.cta,
    status: s.status,
    created_at: s.createdAt || null,
  }));
  const { error } = await supabase.from("scripts").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

// ── Ideas ────────────────────────────────────────────────────────────────────

export async function readIdeas(): Promise<Record<string, string>[]> {
  const { data, error } = await supabase.from("ideas").select("*");
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    title: (r.title as string) || "",
    description: (r.description as string) || "",
    contentType: (r.content_type as string) || "",
    status: (r.status as string) || "",
    createdAt: (r.created_at as string) || "",
  }));
}

export async function writeIdeas(ideas: Record<string, string>[]) {
  const rows = ideas.map((i) => ({
    id: i.id,
    client_id: i.clientId,
    title: i.title,
    description: i.description,
    content_type: i.contentType,
    status: i.status,
    created_at: i.createdAt || null,
  }));
  const { error } = await supabase.from("ideas").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

// ── Training Scripts ─────────────────────────────────────────────────────────

export async function readTrainingScripts(): Promise<TrainingScript[]> {
  const { data, error } = await supabase.from("training_scripts").select("*");
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    format: (r.format as string) || "",
    textHook: (r.text_hook as string) || "",
    visualHook: (r.visual_hook as string) || "",
    audioHook: (r.audio_hook as string) || "",
    script: (r.script as string) || "",
    cta: (r.cta as string) || "",
    createdAt: (r.created_at as string) || "",
  }));
}

export async function writeTrainingScripts(scripts: TrainingScript[]) {
  const rows = scripts.map((s) => ({
    id: s.id,
    client_id: s.clientId,
    format: s.format,
    text_hook: s.textHook,
    visual_hook: s.visualHook,
    audio_hook: s.audioHook,
    script: s.script,
    cta: s.cta,
    created_at: s.createdAt || null,
  }));
  const { error } = await supabase.from("training_scripts").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

// ── Analyses ─────────────────────────────────────────────────────────────────

export async function readAnalyses(): Promise<Analysis[]> {
  const { data, error } = await supabase.from("analyses").select("*");
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    instagramHandle: (r.instagram_handle as string) || "",
    lang: (r.lang as string) || "",
    report: (r.report as string) || "",
    profileFollowers: (r.profile_followers as number) || 0,
    profileReels30d: (r.profile_reels_30d as number) || 0,
    profileAvgViews30d: (r.profile_avg_views_30d as number) || 0,
    profilePicUrl: (r.profile_pic_url as string) || "",
    createdAt: (r.created_at as string) || "",
  }));
}

export async function writeAnalyses(analyses: Analysis[]) {
  const rows = analyses.map((a) => ({
    id: a.id,
    client_id: a.clientId,
    instagram_handle: a.instagramHandle,
    lang: a.lang,
    report: a.report,
    profile_followers: a.profileFollowers,
    profile_reels_30d: a.profileReels30d,
    profile_avg_views_30d: a.profileAvgViews30d,
    profile_pic_url: a.profilePicUrl,
    created_at: a.createdAt || null,
  }));
  const { error } = await supabase.from("analyses").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

// ── Strategy Config ──────────────────────────────────────────────────────────

export async function readStrategyConfig() {
  const { data, error } = await supabase
    .from("strategy_config")
    .select("*")
    .eq("id", "global")
    .single();
  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
  return data?.config || { customContentTypes: [], customFormats: [], trainingExamples: [] };
}

export async function writeStrategyConfig(config: unknown) {
  const { error } = await supabase
    .from("strategy_config")
    .upsert({ id: "global", config }, { onConflict: "id" });
  if (error) throw error;
}
