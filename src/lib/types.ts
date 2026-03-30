export interface Config {
  id: string;
  configName: string;
  creatorsCategory: string;
  // Strategy
  strategyGoal: string; // "reach" | "trust" | "revenue"
  strategyPillars: string; // JSON: [{name: string, subTopics: string}]
  strategyWeekly: string; // JSON: {_reasoning?: string, Mon: {type: string, format: string, reason?: string}, ...}
  performanceInsights: string; // JSON: PerformanceInsights
  postsPerWeek: string;
  // Client info
  name: string;
  company: string;
  role: string;
  location: string;
  businessContext: string;
  professionalBackground: string;
  keyAchievements: string;
  // Brand & audience
  brandFeeling: string;
  brandProblem: string;
  brandingStatement: string;
  humanDifferentiation: string;
  dreamCustomer: string; // JSON
  customerProblems: string; // JSON array
  providerRole: string;
  providerBeliefs: string;
  providerStrengths: string;
  authenticityZone: string;
  // Social & web
  website: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  linkedin: string;
  twitter: string;
  // Cached Instagram profile
  igFullName: string;
  igBio: string;
  igFollowers: string;
  igFollowing: string;
  igPostsCount: string;
  igProfilePicUrl: string;
  igCategory: string;
  igVerified: string;
  igLastUpdated: string;
  voiceProfile: string; // JSON: VoiceProfile
  scriptStructure: string; // JSON: ScriptStructureProfile
  googleDriveFolder: string;
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
  durationSeconds: number;
  analysis: string;
  newConcepts: string;
  datePosted: string;
  dateAdded: string;
  configName: string;
  starred: boolean;
}

export interface Idea {
  id: string;
  clientId: string;
  title: string;
  description: string;
  contentType: string;
  status: string;
  createdAt: string;
}

export interface Script {
  id: string;
  clientId: string;
  title: string;
  pillar: string;
  contentType: string;
  format: string;
  hook: string;
  hookPattern: string;
  textHook: string;
  body: string;
  cta: string;
  status: string;
  source: string;
  shotList: string;
  createdAt: string;
}

export interface TrainingScript {
  id: string;
  clientId: string;     // associated client (empty = global)
  format: string;       // matches BUILT_IN_FORMATS names
  textHook: string;     // on-screen text hook
  visualHook: string;   // visual/action hook
  audioHook: string;    // spoken/audio hook
  script: string;       // main body script
  cta: string;          // call to action
  sourceId: string;     // e.g. "gdrive:<fileId>" for deduplication
  createdAt: string;
}

export interface TopicPlanItem {
  day: string;          // "Mon", "Tue", etc.
  pillar: string;
  contentType: string;
  format: string;
  title: string;        // short working title
  description: string;  // 1-sentence description
  reasoning?: string;   // strategic justification based on audit/performance data
}

export interface Analysis {
  id: string;
  clientId: string;
  instagramHandle: string;
  lang: string;
  report: string;
  profileFollowers: number;
  profileReels30d: number;
  profileAvgViews30d: number;
  profilePicUrl: string;
  createdAt: string;
}

export interface VoiceProfile {
  avgSentenceLength: number;
  favoriteWords: string[];
  avoidedPatterns: string[];
  tone: string;
  energy: string;
  sentencePatterns: string;
  slangMarkers: string[];
  exampleSentences: string[];
  summary: string;
}

export interface ScriptStructureProfile {
  hookPatterns: Array<{
    pattern: string;
    description: string;
    frequency: string;
    example: string;
  }>;
  bodyStructures: Array<{
    name: string;
    steps: string[];
    example: string;
  }>;
  transitionPatterns: string[];
  ctaPatterns: Array<{
    pattern: string;
    example: string;
  }>;
  avgParagraphs: number;
  dramaturgicFlow: string;
  keyRules: string[];
  summary: string;
}

export interface StrategyInsight {
  category: "performance" | "audit" | "competitor" | "gap";
  insight: string;
  dataPoint: string;
  implication: string;
}

export interface StructuredSubTopic {
  title: string;
  angle: string;
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
