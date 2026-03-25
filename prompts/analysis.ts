// ── Video Analysis & Concepts Prompts ────────────────────────────────────────
// Used by the pipeline: Gemini video analysis + Claude concept generation.
// Moved from lib/prompts.ts — the original location.

import type { Config } from "../src/lib/types";

export const ANALYSIS_PROMPT = `# CONCEPT
Overall description of the concept of this video, and what makes it valuable and interesting (1-3 sentences).
-> Clarify the core tension: what belief is challenged, what mistake is exposed, or what outcome is promised.
-> One clear idea only. No subtopics.

# HOOK
Detailed description of the first 5 seconds of the video, what makes it scroll-stopping and attention-grabbing, why a viewer needs to stop to watch it (1-3 sentences).
-> Break it down into:
- VISUAL (what is seen in the first 1-2 seconds: movement, facial expression, contrast, pattern break)
- TEXT (short on-screen statement: danger, promise, or contradiction, max 6-8 words)
- AUDIO (first spoken words: confident, direct, no intro, no context)
-> The hook must create either fear of loss, strong curiosity, or identity relevance.

# RETENTION MECHANISMS
Detailed description of how the creator manages to retain viewers throughout the video (1-7 sentences).
-> Open loops ("in a second I'll show you why...", "most people miss this part...")
-> Delayed payoff (main insight is intentionally held back)
-> Micro-escalations every 3-5 seconds (new angle, sharper wording, visual or tonal shift)
-> Pattern interrupts (pauses, emphasis, cut, zoom, gesture)
-> Clear forward momentum: the viewer feels the video is going somewhere.

# REWARD
Describe the ultimate value that the viewer gets by watching this video (1-3 sentences).
-> Be explicit: what does the viewer now understand, feel, or see differently?
-> Define whether the reward is Education (clarity), Entertainment (emotional release), or Inspiration (self-belief / action).
-> The reward should feel proportional to the time invested.

# SCRIPT
Describe the full script of the video (1-20 sentences, as many as needed).
-> Structure:
1. Immediate hook (no greeting)
2. Problem framing / tension escalation
3. Why this matters (stakes)
4. Main insight or shift in perspective (this comes AFTER retention is established)
5. Clean close (no rambling; optional CTA only if natural)
-> Include: scenes, actions, voiceover, exact wording if possible.
-> Keep sentences short. Spoken language only.

OVERALL RULE:
THE SHORTER THE ANALYSIS - THE BETTER.
If it can be said in fewer words, it should be.
Clarity > cleverness.
Retention > information.`;

export function buildConceptsPrompt(config: Pick<Config, "configName" | "name" | "company" | "role" | "location" | "businessContext" | "professionalBackground" | "keyAchievements" | "creatorsCategory">): string {
  const clientName = config.name || config.configName;
  const identity = [config.role, config.company, config.location].filter(Boolean).join(", ");

  const clientBlock = [
    `${clientName}${identity ? ` — ${identity}` : ""}`,
    config.businessContext && `Context: ${config.businessContext}`,
    config.professionalBackground && `Background: ${config.professionalBackground}`,
    config.keyAchievements && `Achievements: ${config.keyAchievements}`,
  ].filter(Boolean).join("\n");

  return `Adapt this video for the following client:

${clientBlock}

Task:
Give us 3 NEW video concepts inspired by the ORIGINAL reference.
Do not copy the original.
Translate the core idea into this client's niche and audience context.
MAINLY iterate and sharpen the HOOKS.

Focus:
- First 3 seconds must stop this client's ideal audience from scrolling
- Hooks should challenge a belief, fear, or misconception relevant to their niche
- Match the client's voice, authority level, and positioning
- Calm authority > hype

The output should have this format:

# CONCEPT 1
Text description (1-3 sentences)

## HOOK
Detailed hook description (1-3 sentences)
Describe:
- What is seen in the first 2 seconds
- What is said in the first line
- Why this hook works for this client's specific audience

## SCRIPT
Detailed script description (1-20 sentences, as many as needed)
Include:
- Scene flow
- Spoken text / voiceover
- Clear but understated payoff
- Subtle authority, not selling

# CONCEPT 2
...

# CONCEPT 3
...`;
}
