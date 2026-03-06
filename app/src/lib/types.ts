export interface Config {
  id: string;
  configName: string;
  creatorsCategory: string;
  // Prompt variables (replaces raw analysisInstruction / newConceptsInstruction)
  clientDescription: string;
  contentNiche: string;
  targetAudience: string;
  toneNotes: string;
  // Client info
  name: string;
  company: string;
  role: string;
  location: string;
  businessContext: string;
  professionalBackground: string;
  keyAchievements: string;
  // Social & web
  website: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  linkedin: string;
  twitter: string;
}

export interface Creator {
  id: string;
  username: string;
  category: string;
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  lastScrapedAt: string;
}

export interface Video {
  id: string;
  link: string;
  thumbnail: string;
  creator: string;
  views: number;
  likes: number;
  comments: number;
  analysis: string;
  newConcepts: string;
  datePosted: string;
  dateAdded: string;
  configName: string;
  starred: boolean;
}

export interface PipelineParams {
  configName: string;
  maxVideos: number;
  topK: number;
  nDays: number;
}

export interface ActiveTask {
  id: string;
  creator: string;
  step: string;
  views?: number;
}

export interface PipelineProgress {
  status: "idle" | "running" | "completed" | "error";
  phase: "scraping" | "analyzing" | "done";
  activeTasks: ActiveTask[];
  creatorsCompleted: number;
  creatorsTotal: number;
  creatorsScraped: number;
  videosAnalyzed: number;
  videosTotal: number;
  errors: string[];
  log: string[];
}
