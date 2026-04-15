import { supabase } from "./supabase";
import type { Config, Creator, Video, Script, TrainingScript, Analysis } from "./types";

// ── In-Memory Cache ─────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): T {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

function invalidate(...prefixes: string[]) {
  for (const key of cache.keys()) {
    if (prefixes.some((p) => key.startsWith(p))) cache.delete(key);
  }
}

const TTL_5M = 5 * 60 * 1000;
const TTL_10M = 10 * 60 * 1000;
const TTL_30M = 30 * 60 * 1000;

// ── Row → Model mappers ──────────────────────────────────────────────────────

function mapVideo(r: Record<string, unknown>): Video {
  return {
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
  };
}

function mapScript(r: Record<string, unknown>): Script {
  return {
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    title: (r.title as string) || "",
    pillar: (r.pillar as string) || "",
    contentType: (r.content_type as string) || "",
    format: (r.format as string) || "",
    hook: (r.hook as string) || "",
    hookPattern: (r.hook_pattern as string) || "",
    textHook: (r.text_hook as string) || "",
    body: (r.body as string) || "",
    cta: (r.cta as string) || "",
    status: (r.status as string) || "entwurf",
    source: (r.source as string) || "",
    shotList: (r.shot_list as string) || "",
    createdAt: (r.created_at as string) || "",
  };
}

function mapAnalysis(r: Record<string, unknown>): Analysis {
  return {
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
  };
}

// ── Configs ─────────────────────────────────────────────────────────────────

/** Frontend-safe config fields (excludes large backend-only blobs) */
const CONFIG_LIGHT_COLUMNS = [
  "id", "configName", "creatorsCategory", "postsPerWeek",
  "strategyGoal", "strategyPillars", "strategyWeekly", "performanceInsights",
  "name", "company", "role", "location", "businessContext", "professionalBackground", "keyAchievements",
  "brandFeeling", "brandProblem", "brandingStatement", "humanDifferentiation",
  "dreamCustomer", "customerProblems", "providerRole", "providerBeliefs", "providerStrengths", "authenticityZone",
  "website", "instagram", "tiktok", "youtube", "linkedin", "twitter",
  "igFullName", "igBio", "igFollowers", "igFollowing", "igPostsCount",
  "igProfilePicUrl", "igCategory", "igVerified", "igLastUpdated",
  "googleDriveFolder",
].join(",");

export async function readConfigs(): Promise<Config[]> {
  const cached = getCached<Config[]>("configs");
  if (cached) return cached;
  const { data, error } = await supabase.from("configs").select("*");
  if (error) throw error;
  return setCache("configs", (data || []) as Config[], TTL_5M);
}

/** Read a single config by ID — full data for backend pipelines */
export async function readConfig(id: string): Promise<Config | null> {
  const cached = getCached<Config | null>(`config:${id}`);
  if (cached !== null) return cached;
  const { data, error } = await supabase
    .from("configs")
    .select("*")
    .eq("id", id)
    .single();
  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  return setCache(`config:${id}`, data as Config, TTL_5M);
}

/** Read a single config with only frontend-needed fields */
export async function readConfigLight(id: string): Promise<Config | null> {
  const cached = getCached<Config | null>(`configLight:${id}`);
  if (cached !== null) return cached;
  const { data, error } = await supabase
    .from("configs")
    .select(CONFIG_LIGHT_COLUMNS)
    .eq("id", id)
    .single();
  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  return setCache(`configLight:${id}`, data as unknown as Config, TTL_5M);
}

export async function writeConfigs(configs: Config[]) {
  const { error } = await supabase.from("configs").upsert(configs, { onConflict: "id" });
  if (error) throw error;
}

export async function insertConfig(config: Config) {
  const { error } = await supabase.from("configs").insert(config);
  if (error) throw error;
  invalidate("configs", "config:", "configLight:");
}

export async function updateConfig(id: string, fields: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const { id: _id, ...rest } = fields;
  const cleanFields = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  );
  const { data, error } = await supabase
    .from("configs")
    .update(cleanFields)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  invalidate("configs", "config:", "configLight:");
  return data;
}

export async function deleteConfig(id: string) {
  const { error } = await supabase.from("configs").delete().eq("id", id);
  if (error) throw error;
  invalidate("configs", "config:", "configLight:");
}

// ── Creators ────────────────────────────────────────────────────────────────

export async function readCreators(): Promise<Creator[]> {
  const cached = getCached<Creator[]>("creators");
  if (cached) return cached;
  const { data, error } = await supabase.from("creators").select("*");
  if (error) throw error;
  const result = (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    username: (r.username as string) || "",
    category: (r.category as string) || "",
    profilePicUrl: (r.profile_pic_url as string) || "",
    followers: (r.followers as number) || 0,
    reelsCount30d: (r.reels_count_30d as number) || 0,
    avgViews30d: (r.avg_views_30d as number) || 0,
    lastScrapedAt: (r.last_scraped_at as string) || "",
  }));
  return setCache("creators", result, TTL_5M);
}

/** Update a single creator by ID */
export async function updateCreator(id: string, fields: Record<string, unknown>) {
  const { error } = await supabase.from("creators").update(fields).eq("id", id);
  if (error) throw error;
  invalidate("creators");
}

export async function insertCreator(creator: Record<string, unknown>) {
  const { error } = await supabase.from("creators").insert(creator);
  if (error) throw error;
  invalidate("creators");
}

export async function deleteCreator(id: string) {
  const { error } = await supabase.from("creators").delete().eq("id", id);
  if (error) throw error;
  invalidate("creators");
}

// Legacy — still used by refresh route (batch)
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
  invalidate("creators");
}

// ── Videos ───────────────────────────────────────────────────────────────────

/** List columns for video list view (excludes large analysis/newConcepts) */
const VIDEO_LIST_COLUMNS = "id,link,thumbnail,creator,views,likes,comments,duration_seconds,date_posted,date_added,config_name,starred";

/** Read videos for list view — lightweight, no analysis blobs */
export async function readVideosList(configName?: string): Promise<Video[]> {
  const key = configName ? `videos:list:${configName}` : "videos:list";
  const cached = getCached<Video[]>(key);
  if (cached) return cached;
  let query = supabase.from("videos").select(VIDEO_LIST_COLUMNS).order("date_added", { ascending: false });
  if (configName) query = query.eq("config_name", configName);
  const { data, error } = await query;
  if (error) throw error;
  const result = (data || []).map((r: Record<string, unknown>) => ({
    ...mapVideo(r),
    analysis: "",
    newConcepts: "",
  }));
  return setCache(key, result, TTL_10M);
}

/** Read a single video with full detail (including analysis) */
export async function readVideo(id: string): Promise<Video | null> {
  const { data, error } = await supabase.from("videos").select("*").eq("id", id).single();
  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  return data ? mapVideo(data) : null;
}

/** Read all videos — full data, for backend pipeline use */
export async function readVideos(): Promise<Video[]> {
  const { data, error } = await supabase.from("videos").select("*");
  if (error) throw error;
  return (data || []).map(mapVideo);
}

/** Read videos for a specific client config — scoped, ordered by views */
export async function readVideosByClient(configName: string, limit = 100): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("config_name", configName)
    .order("views", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(mapVideo);
}

/** Read videos filtered by configName — full data, for pipeline use */
export async function readVideosByConfig(configName: string): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("config_name", configName)
    .order("views", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapVideo);
}

/** Update a single video field (e.g. starred) */
export async function updateVideo(id: string, fields: Record<string, unknown>) {
  const { error } = await supabase.from("videos").update(fields).eq("id", id);
  if (error) throw error;
  invalidate("videos:");
}

/** Delete a video by ID */
export async function deleteVideo(id: string) {
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) throw error;
  invalidate("videos:");
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
  invalidate("videos:");
}

// Legacy — kept for pipeline bulk writes
export async function writeVideos(videos: Video[]) {
  const rows = videos.map((v) => ({
    id: v.id,
    link: v.link,
    thumbnail: v.thumbnail,
    creator: v.creator,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    duration_seconds: Math.round(v.durationSeconds || 0),
    analysis: v.analysis,
    new_concepts: v.newConcepts,
    date_posted: v.datePosted || null,
    date_added: v.dateAdded || null,
    config_name: v.configName,
    starred: v.starred,
  }));
  const { error } = await supabase.from("videos").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  invalidate("videos:");
}

// ── Scripts ──────────────────────────────────────────────────────────────────

export async function readScripts(): Promise<Script[]> {
  const cached = getCached<Script[]>("scripts");
  if (cached) return cached;
  const { data, error } = await supabase.from("scripts").select("*");
  if (error) throw error;
  return setCache("scripts", (data || []).map(mapScript), TTL_10M);
}

/** Read scripts for a specific client */
export async function readScriptsByClient(clientId: string): Promise<Script[]> {
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapScript);
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
    hook_pattern: s.hookPattern || "",
    text_hook: s.textHook || "",
    body: s.body,
    cta: s.cta,
    status: s.status,
    source: s.source || "",
    shot_list: s.shotList || "",
    created_at: s.createdAt || null,
  }));
  const { error } = await supabase.from("scripts").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  invalidate("scripts");
}

// ── Ideas ────────────────────────────────────────────────────────────────────

function mapIdea(r: Record<string, unknown>): Record<string, string> {
  return {
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    title: (r.title as string) || "",
    description: (r.description as string) || "",
    contentType: (r.content_type as string) || "",
    status: (r.status as string) || "",
    createdAt: (r.created_at as string) || "",
  };
}

export async function readIdeas(): Promise<Record<string, string>[]> {
  const { data, error } = await supabase.from("ideas").select("*");
  if (error) throw error;
  return (data || []).map(mapIdea);
}

export async function readIdeasByClient(clientId: string): Promise<Record<string, string>[]> {
  const { data, error } = await supabase
    .from("ideas")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapIdea);
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
  const cached = getCached<TrainingScript[]>("training");
  if (cached) return cached;
  const { data, error } = await supabase.from("training_scripts").select("*");
  if (error) throw error;
  const result = (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    format: (r.format as string) || "",
    textHook: (r.text_hook as string) || "",
    visualHook: (r.visual_hook as string) || "",
    audioHook: (r.audio_hook as string) || "",
    script: (r.script as string) || "",
    cta: (r.cta as string) || "",
    sourceId: (r.source_id as string) || "",
    createdAt: (r.created_at as string) || "",
  }));
  return setCache("training", result, TTL_10M);
}

/** Read training scripts for a specific client */
export async function readTrainingScriptsByClient(clientId: string): Promise<TrainingScript[]> {
  const cached = getCached<TrainingScript[]>(`training:${clientId}`);
  if (cached) return cached;
  const { data, error } = await supabase
    .from("training_scripts")
    .select("*")
    .eq("client_id", clientId);
  if (error) throw error;
  const result = (data || []).map((r: Record<string, unknown>) => ({
    id: (r.id as string) || "",
    clientId: (r.client_id as string) || "",
    format: (r.format as string) || "",
    textHook: (r.text_hook as string) || "",
    visualHook: (r.visual_hook as string) || "",
    audioHook: (r.audio_hook as string) || "",
    script: (r.script as string) || "",
    cta: (r.cta as string) || "",
    sourceId: (r.source_id as string) || "",
    createdAt: (r.created_at as string) || "",
  }));
  return setCache(`training:${clientId}`, result, TTL_10M);
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
    source_id: s.sourceId || null,
    created_at: s.createdAt || null,
  }));
  const { error } = await supabase.from("training_scripts").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  invalidate("training", "training:");
}

// ── Analyses ─────────────────────────────────────────────────────────────────

export async function readAnalyses(): Promise<Analysis[]> {
  const cached = getCached<Analysis[]>("analyses");
  if (cached) return cached;
  const { data, error } = await supabase.from("analyses").select("*");
  if (error) throw error;
  return setCache("analyses", (data || []).map(mapAnalysis), TTL_10M);
}

/** Read analyses for a specific client */
export async function readAnalysesByClient(clientId: string): Promise<Analysis[]> {
  const cached = getCached<Analysis[]>(`analyses:${clientId}`);
  if (cached) return cached;
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return setCache(`analyses:${clientId}`, (data || []).map(mapAnalysis), TTL_10M);
}

export function invalidateAnalysesCache() {
  invalidate("analyses", "analyses:");
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
  invalidate("analyses", "analyses:");
}

// ── Strategy Config ──────────────────────────────────────────────────────────

export async function readStrategyConfig() {
  const cached = getCached<unknown>("strategy_config");
  if (cached) return cached;
  const { data, error } = await supabase
    .from("strategy_config")
    .select("*")
    .eq("id", "global")
    .single();
  if (error && error.code !== "PGRST116") throw error;
  const result = data?.config || { customContentTypes: [], customFormats: [], trainingExamples: [] };
  return setCache("strategy_config", result, TTL_30M);
}

export async function writeStrategyConfig(config: unknown) {
  const { error } = await supabase
    .from("strategy_config")
    .upsert({ id: "global", config }, { onConflict: "id" });
  if (error) throw error;
  invalidate("strategy_config");
}
