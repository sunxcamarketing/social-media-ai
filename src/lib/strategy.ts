export interface ContentType {
  id: string;
  name: string;
  goal: string;
  bestFor: string;
  custom?: boolean;
}

export interface ContentFormat {
  id: string;
  name: string;
  description: string;
  bestContentType: string;
  platform: string;
  custom?: boolean;
}

export const BUILT_IN_CONTENT_TYPES: ContentType[] = [
  { id: "authority", name: "Authority", goal: "Establish expertise & credibility", bestFor: "Positioning, attracting high-ticket clients" },
  { id: "story", name: "Story / Personality", goal: "Build emotional connection & trust", bestFor: "Personal brand differentiation" },
  { id: "social-proof", name: "Social Proof", goal: "Trigger buying decisions", bestFor: "Converting followers into clients" },
  { id: "education", name: "Education / Value", goal: "Drive saves, shares & reach", bestFor: "Growing audience, algorithm performance" },
  { id: "opinion", name: "Opinion / Polarisation", goal: "Drive comments & engagement", bestFor: "Reach, visibility, algorithm boost" },
  { id: "bts", name: "Behind the Scenes", goal: "Show process & authenticity", bestFor: "Trust, humanising the brand" },
  { id: "inspiration", name: "Inspiration / Motivation", goal: "Emotional resonance", bestFor: "Shares, saves, emotional connection" },
  { id: "entertainment", name: "Entertainment", goal: "Retention & virality", bestFor: "Reach, new audience discovery" },
  { id: "community", name: "Community / Interaction", goal: "Foster engagement & loyalty", bestFor: "Comments, DMs, relationship building" },
  { id: "promotion", name: "Promotion / Offer", goal: "Drive direct sales or sign-ups", bestFor: "Conversion, revenue" },
];

export const BUILT_IN_FORMATS: ContentFormat[] = [
  { id: "face-cam", name: "Face to Camera", description: "Direct address to camera, personal & authentic", bestContentType: "Opinion, Authority, Story", platform: "Reels, TikTok, YouTube Shorts" },
  { id: "voiceover", name: "Voice Over + B-Roll", description: "Narration over footage or visuals, no face required", bestContentType: "Education, Authority, Story", platform: "Reels, TikTok, YouTube" },
  { id: "storytelling", name: "Storytelling", description: "Narrative arc — setup, conflict, resolution", bestContentType: "Story, Authority, Social Proof", platform: "Reels, TikTok, YouTube" },
  { id: "carousel", name: "Carousel / Slideshow", description: "Multi-slide educational or list content", bestContentType: "Education, Authority, Social Proof", platform: "Instagram, LinkedIn" },
  { id: "screen-rec", name: "Screen Recording", description: "Tutorial or walkthrough content", bestContentType: "Education, Tutorial, Behind the Scenes", platform: "Reels, TikTok, YouTube" },
  { id: "reaction", name: "Reaction", description: "Respond to or react on existing content", bestContentType: "Opinion, Authority, Entertainment", platform: "Reels, TikTok" },
  { id: "bts-format", name: "Behind the Scenes", description: "Raw, unpolished look at process or daily life", bestContentType: "Story, Personality, Community", platform: "Stories, Reels, TikTok" },
  { id: "text-post", name: "Text-based Post", description: "Pure text, no video", bestContentType: "Opinion, Education, Community", platform: "LinkedIn, Twitter/X" },
  { id: "screenshot", name: "Screenshot Post", description: "Screenshot of message, result, or conversation", bestContentType: "Social Proof, Opinion", platform: "Instagram, LinkedIn" },
  { id: "talking-head", name: "Talking Head (sit-down)", description: "Longer, seated interview-style video", bestContentType: "Authority, Education, Story", platform: "YouTube, LinkedIn" },
  { id: "trend", name: "Trend / Audio Remix", description: "Use trending audio or format", bestContentType: "Entertainment, Reach, Opinion", platform: "TikTok, Reels" },
  { id: "podcast-clip", name: "Podcast Clip", description: "Clip from podcast or longer interview", bestContentType: "Authority, Education, Story", platform: "LinkedIn, Reels, YouTube" },
  { id: "live", name: "Live", description: "Real-time streaming content", bestContentType: "Community, Authority, Q&A", platform: "Instagram, TikTok, YouTube" },
  { id: "poll", name: "Poll / Question Sticker", description: "Interactive story content", bestContentType: "Community, Interaction", platform: "Stories" },
];
