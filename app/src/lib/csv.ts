import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import type { Config, Creator, Video, Script, TrainingScript } from "./types";

const DATA_DIR = path.join(process.cwd(), "..", "data");

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readCsv<T>(filename: string): T[] {
  const filepath = path.join(DATA_DIR, filename);
  if (!existsSync(filepath)) return [];
  const content = readFileSync(filepath, "utf-8");
  if (!content.trim()) return [];
  return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true }) as T[];
}

function writeCsv(filename: string, data: Record<string, unknown>[], columns: string[]) {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, filename);
  const output = stringify(data, { header: true, columns });
  writeFileSync(filepath, output, "utf-8");
}

// Configs
const CONFIG_COLUMNS = ["id", "configName", "creatorsCategory", "name", "company", "role", "location", "businessContext", "professionalBackground", "keyAchievements", "website", "instagram", "tiktok", "youtube", "linkedin", "twitter", "strategyGoal", "strategyPillars", "strategyWeekly", "performanceInsights", "postsPerWeek", "brandFeeling", "brandProblem", "brandingStatement", "humanDifferentiation", "dreamCustomer", "customerProblems", "providerRole", "providerBeliefs", "providerStrengths", "authenticityZone", "igFullName", "igBio", "igFollowers", "igFollowing", "igPostsCount", "igProfilePicUrl", "igCategory", "igVerified", "igLastUpdated"];

export function readConfigs(): Config[] {
  return readCsv<Config>("configs.csv");
}

export function writeConfigs(configs: Config[]) {
  writeCsv("configs.csv", configs as unknown as Record<string, unknown>[], CONFIG_COLUMNS);
}

// Creators
const CREATOR_COLUMNS = ["id", "username", "category", "profilePicUrl", "followers", "reelsCount30d", "avgViews30d", "lastScrapedAt"];

export function readCreators(): Creator[] {
  const raw = readCsv<Record<string, string>>("creators.csv");
  return raw.map((r) => ({
    id: r.id || "",
    username: r.username || "",
    category: r.category || "",
    profilePicUrl: r.profilePicUrl || "",
    followers: parseInt(r.followers || "0", 10) || 0,
    reelsCount30d: parseInt(r.reelsCount30d || "0", 10) || 0,
    avgViews30d: parseInt(r.avgViews30d || "0", 10) || 0,
    lastScrapedAt: r.lastScrapedAt || "",
  }));
}

export function writeCreators(creators: Creator[]) {
  writeCsv("creators.csv", creators as unknown as Record<string, unknown>[], CREATOR_COLUMNS);
}

// Videos
const VIDEO_COLUMNS = ["id", "link", "thumbnail", "creator", "views", "likes", "comments", "durationSeconds", "analysis", "newConcepts", "datePosted", "dateAdded", "configName", "starred"];

export function readVideos(): Video[] {
  const raw = readCsv<Record<string, string>>("videos.csv");
  return raw.map((r) => ({
    id: r.id || "",
    link: r.link || r.Link || "",
    thumbnail: r.thumbnail || r.Thumbnail || "",
    creator: r.creator || r.Creator || "",
    views: parseInt(r.views || r.Views || "0", 10) || 0,
    likes: parseInt(r.likes || r.Likes || "0", 10) || 0,
    comments: parseInt(r.comments || r.Comments || "0", 10) || 0,
    durationSeconds: parseInt(r.durationSeconds || "0", 10) || 0,
    analysis: r.analysis || r.Analysis || "",
    newConcepts: r.newConcepts || r["newConcepts"] || r["New Concepts"] || "",
    datePosted: r.datePosted || r["Date Posted"] || r["datePosted"] || "",
    dateAdded: r.dateAdded || r["Date Added"] || r["dateAdded"] || "",
    configName: r.configName || r["Config Name"] || r["configName"] || "",
    starred: r.starred === "true",
  }));
}

export function writeVideos(videos: Video[]) {
  writeCsv("videos.csv", videos as unknown as Record<string, unknown>[], VIDEO_COLUMNS);
}

export function appendVideo(video: Video) {
  const videos = readVideos();
  videos.push(video);
  writeVideos(videos);
}

// Scripts
const SCRIPT_COLUMNS = ["id", "clientId", "title", "pillar", "contentType", "format", "hook", "body", "cta", "status", "createdAt"];

export function readScripts(): Script[] {
  const raw = readCsv<Record<string, string>>("scripts.csv");
  return raw.map((r) => ({
    id: r.id || "",
    clientId: r.clientId || "",
    title: r.title || "",
    pillar: r.pillar || "",
    contentType: r.contentType || "",
    format: r.format || "",
    hook: r.hook || "",
    body: r.body || "",
    cta: r.cta || "",
    status: r.status || "entwurf",
    createdAt: r.createdAt || "",
  }));
}

export function writeScripts(scripts: Script[]) {
  writeCsv("scripts.csv", scripts as unknown as Record<string, unknown>[], SCRIPT_COLUMNS);
}

// Ideas
const IDEA_COLUMNS = ["id", "clientId", "title", "description", "contentType", "status", "createdAt"];

export function readIdeas(): Record<string, string>[] {
  return readCsv<Record<string, string>>("ideas.csv");
}

export function writeIdeas(ideas: Record<string, string>[]) {
  writeCsv("ideas.csv", ideas, IDEA_COLUMNS);
}

// Training Scripts
const TRAINING_SCRIPT_COLUMNS = ["id", "clientId", "format", "textHook", "visualHook", "audioHook", "script", "cta", "createdAt"];

export function readTrainingScripts(): TrainingScript[] {
  const raw = readCsv<Record<string, string>>("training-scripts.csv");
  return raw.map((r) => ({
    id: r.id || "",
    clientId: r.clientId || "",
    format: r.format || "",
    textHook: r.textHook || "",
    visualHook: r.visualHook || "",
    audioHook: r.audioHook || "",
    script: r.script || "",
    cta: r.cta || "",
    createdAt: r.createdAt || "",
  }));
}

export function writeTrainingScripts(scripts: TrainingScript[]) {
  writeCsv("training-scripts.csv", scripts as unknown as Record<string, unknown>[], TRAINING_SCRIPT_COLUMNS);
}

// Leads
const LEAD_COLUMNS = ["id", "firstName", "lastName", "email", "instagramHandle", "createdAt", "reportGenerated"];

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  instagramHandle: string;
  createdAt: string;
  reportGenerated: string;
}

export function readLeads(): Lead[] {
  return readCsv<Lead>("leads.csv");
}

export function appendLead(lead: Lead) {
  const leads = readLeads();
  leads.push(lead);
  writeCsv("leads.csv", leads as unknown as Record<string, unknown>[], LEAD_COLUMNS);
}

export function updateLeadReport(leadId: string) {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === leadId);
  if (lead) {
    lead.reportGenerated = "true";
    writeCsv("leads.csv", leads as unknown as Record<string, unknown>[], LEAD_COLUMNS);
  }
}
