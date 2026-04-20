import "dotenv/config";
import { scrapeSinglePost } from "../src/lib/apify";
import { uploadVideo, analyzeVideo } from "../src/lib/gemini";

const REEL_URL = process.argv[2] || "https://www.instagram.com/reel/DW2rLFJAbD_/";

const CAROUSEL_FOCUS_PROMPT = `WICHTIG: Schreibe die gesamte Analyse auf DEUTSCH. Antworte STRUKTURIERT mit exakt diesen Überschriften.

# META
Creator-Handle, Reel-Länge in Sekunden, Hauptaussage in 1 Satz.

# HOOK (Sek 0-3)
VISUAL: Was ist auf dem Screen zu sehen BEVOR ein Wort fällt? (Kameraposition, Person, Setting, Text-Overlay, Bewegung)
ON-SCREEN-TEXT: Exakter Text-Hook (abschreiben, 1:1)
AUDIO: Erste gesprochenen Worte (wortwörtlich)
HOOK-MECHANIK: Welcher psychologische Trigger stoppt den Scroll?

# KARUSSELL-INTEGRATION — wie zeigt/nutzt das Video Instagram-Karussells?
Antworte SEHR detailliert — das ist der Kernfokus der Analyse:
- Sind im Video Karussell-Posts zu sehen (z.B. er wischt durch einen eigenen Karussell-Post, zeigt Slides, erklärt den Aufbau)?
- Falls JA: Beschreibe JEDEN sichtbaren Karussell-Slide einzeln. Was steht auf Slide 1, Slide 2, Slide 3 usw.?
- Wie ist der Slide-Flow aufgebaut? (Hook-Slide → Problem → Value-Slides → CTA-Slide? Oder anderes Muster?)
- Welche VISUALS nutzt er pro Slide (Text-only, Screenshots, Grafiken, Fotos, Memes)?
- Welche FARB-/FONT-/LAYOUT-Systematik? (Hintergrundfarbe, Font-Style, Farbakzente, wiederkehrendes Layout-Raster)
- Nutzt er SWIPE-CUES auf den Slides (Pfeile, "→", "Swipe →" Hinweise)?
- Wie viele Slides insgesamt?
- Falls er über seine Karussell-Strategie SPRICHT statt sie zu zeigen: Fasse die Methode/Behauptungen Wort für Wort zusammen.

# RETENTION-MECHANIK
Was hält den Zuschauer bis zum Ende? (Open Loops, verzögerter Payoff, Listen-Countdown, Cliffhanger)

# CTA / REWARD
Was passiert am Ende? Was ist die Aufforderung oder das Ergebnis für den Zuschauer?

# KOMPLETTES TRANSKRIPT
Gesprochenes Skript wortwörtlich, mit Sekundenangaben wo möglich.
`;

async function downloadBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Video download failed ${res.status}`);
  const mimeType = res.headers.get("content-type") || "video/mp4";
  const ab = await res.arrayBuffer();
  return { buffer: Buffer.from(ab), mimeType };
}

async function main() {
  console.log(`Scraping ${REEL_URL} via Apify ...`);
  const post = await scrapeSinglePost(REEL_URL);

  console.log("── META ──");
  console.log(`@${post.ownerUsername} · ${post.videoPlayCount} views · ${post.likesCount} likes · ${post.commentsCount} comments`);
  console.log(`Duration: ${post.videoDuration ?? "?"}s`);
  console.log(`Timestamp: ${post.timestamp}`);
  console.log(`Images in post: ${post.images?.length ?? 0}`);
  console.log(`Video URL: ${post.videoUrl ? "present" : "missing"}`);

  if (!post.videoUrl) {
    console.error("No videoUrl returned — this post might not be a Reel.");
    process.exit(1);
  }

  console.log("\nDownloading video ...");
  const { buffer, mimeType } = await downloadBuffer(post.videoUrl);
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

  console.log("Uploading to Gemini + waiting for ACTIVE ...");
  const { uri, mimeType: gMime } = await uploadVideo(buffer, mimeType);

  console.log("Analyzing with Gemini ...\n");
  const analysis = await analyzeVideo(uri, gMime, CAROUSEL_FOCUS_PROMPT);

  console.log("───────────── ANALYSE ─────────────\n");
  console.log(analysis);
}

main().catch((err) => {
  console.error("Analyse fehlgeschlagen:", err);
  process.exit(1);
});
