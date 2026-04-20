import "dotenv/config";
import { runCarouselPipeline } from "../src/lib/carousel/pipeline";

// ── CLI Args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string, fallback?: string) {
  const idx = args.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const CLIENT_ID = getArg("client");
const TOPIC = getArg("topic");
const STYLE_ID = getArg("style", "02-split-screen")!;
const HANDLE_OVERRIDE = getArg("handle");

if (!CLIENT_ID || !TOPIC) {
  console.error(
    `Usage: npx tsx scripts/generate-carousel.ts --client <config_id> --topic "<topic>" [--style 02-split-screen] [--handle @yourhandle]`,
  );
  process.exit(1);
}

async function main() {
  console.log(`\n── Carousel Generator ──`);
  console.log(`Client:    ${CLIENT_ID}`);
  console.log(`Topic:     ${TOPIC}`);
  console.log(`Style:     ${STYLE_ID}\n`);

  const result = await runCarouselPipeline({
    clientId: CLIENT_ID!,
    topic: TOPIC!,
    styleId: STYLE_ID,
    handleOverride: HANDLE_OVERRIDE,
    onProgress: (ev) => {
      const tag = `[${ev.stage}:${ev.status}]`;
      const msg = ev.message || "";
      const data = ev.data
        ? " " +
          Object.entries(ev.data)
            .filter(([k]) => !["slideFiles", "htmlPath", "outDir"].includes(k))
            .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60)}`)
            .join(" ")
        : "";
      const idx = ev.index !== undefined ? ` ${ev.index}/${ev.total ?? "?"}` : "";
      console.log(`${tag}${idx}${msg ? " " + msg : ""}${data}`);
    },
  });

  console.log(`\n── Done in ${(result.durationMs / 1000).toFixed(1)}s ──`);
  console.log(`HTML:   ${result.htmlPath}`);
  console.log(`Slides: ${result.slideFiles.length} in ${result.outDir}/slides`);
  console.log(`Open:   open "${result.outDir}"`);
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
