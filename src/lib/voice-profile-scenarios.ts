// ── Voice Profile Scenarios ─────────────────────────────────────────────────
// Scenarios clients retell in their own words to capture their natural
// speaking style. The voice agent LISTENS passively during scenarios
// (no audio response, only short nudges after ~4 seconds of silence).
// The final step is a guided conversation about the client's own topic.

export type VoiceProfileStep = {
  id: "scenario1" | "scenario2" | "scenario3" | "topic";
  kind: "scenario" | "topic";
  titleDe: string;
  titleEn: string;
  promptDe: string;  // shown on screen before recording
  promptEn: string;
};

export const VOICE_PROFILE_STEPS: VoiceProfileStep[] = [
  {
    id: "scenario1",
    kind: "scenario",
    titleDe: "Vorstellung",
    titleEn: "Introduction",
    promptDe: `Stell dir vor: Du stehst auf einem Familiengeburtstag und ein entfernter Bekannter kommt zu dir und fragt:

"Sag mal — was machst du eigentlich so?"

Erzähl ihm, wie du antworten würdest. Nicht aufgesetzt, nicht perfekt. Einfach wie bei einem echten Gespräch. Nimm dir 60-90 Sekunden.`,
    promptEn: `Imagine: You're at a family birthday party and a distant acquaintance comes up to you and asks:

"So — what do you actually do?"

Tell them how you would answer. Not rehearsed, not perfect. Just like a real conversation. Take 60-90 seconds.`,
  },
  {
    id: "scenario2",
    kind: "scenario",
    titleDe: "Widerspruch",
    titleEn: "Pushback",
    promptDe: `Jemand sagt zu dir:

"Ich glaub ehrlich gesagt nicht, dass das was du machst wirklich funktioniert. Das ist doch alles nur Abzocke heutzutage."

Wie reagierst du? Sprich, als wärst du gerade mitten in dem Gespräch. Sei ehrlich — nicht diplomatisch. 60-90 Sekunden.`,
    promptEn: `Someone says to you:

"Honestly, I don't think what you do actually works. It's all just a scam these days."

How do you respond? Speak as if you're in the middle of the conversation right now. Be honest — not diplomatic. 60-90 seconds.`,
  },
  {
    id: "scenario3",
    kind: "scenario",
    titleDe: "Empathie",
    titleEn: "Empathy",
    promptDe: `Ein Freund kommt zu dir und sagt:

"Ich weiß gerade nicht weiter. Alles fühlt sich fest an. Ich hab so viel versucht und nichts bewegt sich."

Was sagst du zu ihm? Nicht als Coach. Als Freund. 60-90 Sekunden.`,
    promptEn: `A friend comes to you and says:

"I'm stuck. Everything feels jammed. I've tried so much and nothing is moving."

What do you say to them? Not as a coach. As a friend. 60-90 seconds.`,
  },
  {
    id: "topic",
    kind: "topic",
    titleDe: "Dein Thema",
    titleEn: "Your Topic",
    promptDe: `Jetzt reden wir über dein Thema.

Ich stell dir 3-4 Fragen dazu wie DU darüber denkst und sprichst. Keine Show-Antworten — gib mir die echte Version. Dein Alltag, deine Meinung, deine Worte.`,
    promptEn: `Now let's talk about your topic.

I'll ask you 3-4 questions about how YOU think and speak about it. No show answers — give me the real version. Your everyday, your opinion, your words.`,
  },
];

export function getStep(id: string): VoiceProfileStep | undefined {
  return VOICE_PROFILE_STEPS.find((s) => s.id === id);
}
