export type PillarType = "RESULT" | "PROOF" | "MECHANISM" | "BELIEFS" | "IDENTITY";

export interface PillarSubTopic {
  title: string;
  angle?: string;
}

export interface Pillar {
  name: string;
  pillarType?: PillarType;       // new in Block D
  offerLink?: string;             // new in Block D: how does this pillar funnel to coreOffer?
  purpose?: string;               // legacy field (pre-Block D). Mapped via normalizePillarType().
  why?: string;
  subTopics: PillarSubTopic[] | string;
}

export function normalizePillarType(raw: string | undefined): PillarType | undefined {
  if (!raw) return undefined;
  const v = raw.toUpperCase();
  if (v === "RESULT" || v === "PROOF" || v === "MECHANISM" || v === "BELIEFS" || v === "IDENTITY") return v;
  // Legacy mapping (pre-Block D)
  const legacy: Record<string, PillarType> = {
    "DREAM-OUTCOME": "RESULT",
    "PROOF": "PROOF",
    "TIME-SHORTCUT": "MECHANISM",
    "EFFORT-REDUCTION": "MECHANISM",
    "PERSONALITY": "IDENTITY",
    "BELIEF-BREAKING": "BELIEFS",
  };
  return legacy[v];
}

export interface Config {
  id: string;
  configName: string;
  creatorsCategory: string;
  // Strategy
  strategyGoal: string; // "reach" | "trust" | "revenue"
  strategyPillars: string; // JSON: Pillar[]
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
  // Offer & goal (Hormozi Value Equation)
  coreOffer?: string; // What the client sells (product, price, duration, outcome)
  mainGoal?: string; // Concrete goal (e.g. "5 Sales Calls/Woche")
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
  voiceOnboarding?: string; // JSON: VoiceOnboarding — structured 8-block interview
  voiceNotes?: string; // Free-form notes about speaking style
  voiceExamples?: string; // Example texts in client's voice
  scriptStructure: string; // JSON: ScriptStructureProfile
  googleDriveFolder: string;
  targetPlatforms?: string; // JSON: PlatformId[] e.g. '["instagram","tiktok"]'
  language?: "de" | "en"; // Drives output language for all generation + agents. Defaults to 'de'.
  // Visual identity (captured during onboarding)
  styleVibe?: string; // "minimal" | "bold" | "elegant" | "playful" | "techy"
  colorPalette?: string; // JSON: { id: string, colors: string[] }
  fontStyle?: string; // font option id e.g. "inter" | "playfair"
  customFonts?: string; // JSON: { heading?: string, body?: string } when using custom Google Fonts
  // Editing / content inspiration (captured during onboarding)
  inspirationReels?: string; // Newline-separated Reel URLs the client considers well-edited
  inspirationProfiles?: string; // Newline-separated profile URLs / @handles the client admires
}

export interface Creator {
  id: string;
  username: string;
  category: string;
  profilePicUrl: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  platform?: string;
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
  platform?: string;
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
  platform?: string;
  // Pipeline metadata (Block A–E, 2026-04-17)
  patternType?: string;   // STORY | HOW_TO | MISTAKES | PROOF | HOT_TAKE
  postType?: string;      // core | variant | test
  anchorRef?: string;     // winner this post is anchored to
  ctaType?: string;       // soft | lead | authority | none
  funnelStage?: string;   // TOF | MOF | BOF
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

// ── Voice Onboarding: structured 8-block interview ──────────────────────────
// Captured during /clients/new voice step. Each block has an AI-extracted
// summary + raw quotes from the transcript. Once all blocks are covered a
// `synthesis` string holds the holistic voice-DNA document that gets fed
// into script/strategy/chat pipelines as additional context.

export type VoiceBlockId =
  | "identity"      // 1. Persönlichkeit & Storytelling-DNA
  | "positioning"   // 2. Positionierung & Autorität
  | "audience"      // 3. Zielgruppe (wen anziehen / abstoßen)
  | "beliefs"       // 4. Audience-Beliefs (was glauben sie vorher)
  | "offer"         // 5. Emotionales Ergebnis (was wird wirklich verkauft)
  | "feel"          // 6. Content-Feel (Ton, Vibe, Grenzen)
  | "vision"        // 7. Instagram-Vision & KPIs
  | "resources";    // 8. Ressourcen & Reality-Check

export interface VoiceBlock {
  id: VoiceBlockId;
  status: "pending" | "done";
  summary: string;        // AI-extracted 1-3 sentence summary of what client said
  quotes: string[];       // 1-5 raw verbatim quotes from the transcript
  completedAt?: string;   // ISO timestamp
}

export interface VoiceOnboarding {
  blocks: VoiceBlock[];          // always 8 entries, in VOICE_BLOCK_ORDER
  currentBlockId: VoiceBlockId;  // block the agent is currently working on
  synthesis: string;             // holistic voice-DNA doc — populated when all 8 done
  updatedAt: string;             // ISO timestamp
}

export const VOICE_BLOCK_ORDER: VoiceBlockId[] = [
  "identity",
  "positioning",
  "audience",
  "beliefs",
  "offer",
  "feel",
  "vision",
  "resources",
];

export function emptyVoiceOnboarding(): VoiceOnboarding {
  return {
    blocks: VOICE_BLOCK_ORDER.map((id) => ({
      id,
      status: "pending",
      summary: "",
      quotes: [],
    })),
    currentBlockId: "identity",
    synthesis: "",
    updatedAt: new Date().toISOString(),
  };
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
