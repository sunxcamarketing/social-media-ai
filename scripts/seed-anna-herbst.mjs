// One-shot seed script for Anna Herbst's IMOS profile.
// Reads the agent-kit folder from Downloads, maps content to existing
// Config fields, and pushes the long-form material into avatarDeepDive
// + clientPlaybook. Run once: `node scripts/seed-anna-herbst.mjs`.
//
// Run with --dry to preview without writing.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const KIT = "/Users/aysuncaliskan/Downloads/social-media-agent-kit";
const ANNA_ID = "afeac05b-c597-4a63-9529-c3c0fddaf319";
const DRY = process.argv.includes("--dry");

const read = (rel) => readFileSync(join(KIT, rel), "utf8");

// ── Long-form Markdown blobs ────────────────────────────────────────────────
const avatarDeepDive = read("brand/avatar-harald.md");

const clientPlaybook = [
  "# Brand Voice & Stil",
  read("brand/brand-voice.md"),
  "",
  "---",
  "",
  "# Copywriting-Grundregeln (20 Regeln, AIDA, Headlines, CTAs, FAB, Anti-Staccato)",
  read("brand/copywriting-grundregeln.md"),
  "",
  "---",
  "",
  "# LinkedIn-Playbook (3 Säulen, Wochenplan, Post-Formate, Hook-Typen, CTA-Matrix)",
  read("brand/linkedin-playbook.md"),
  "",
  "---",
  "",
  "# Marketing Method V7 (Asset-Building-Prozess)",
  read("brand/marketing-method.md"),
  "",
  "---",
  "",
  "# Messaging Framework (DU-Perspektive, Funnel-Schichten, Nutzenkategorien)",
  read("brand/messaging-framework.md"),
  "",
  "---",
  "",
  "# Business-Kontext IMOS",
  read("strategy/business-kontext.md"),
  "",
  "---",
  "",
  "# Sales-Strategie & 5 aktive Funnels",
  read("strategy/sales-strategie.md"),
  read("strategy/funnel-uebersicht.md"),
  "",
  "---",
  "",
  "# Plattform-Style-Guide (LinkedIn / Instagram / TikTok / YouTube)",
  read("content/style-guide-content.md"),
  "",
  "---",
  "",
  "# Content-Distribution Learnings (Metricool, Posting-Regeln)",
  read("content/content-distribution.md"),
  "",
  "---",
  "",
  "# CI / Visual Identity",
  "**IMOS Farben (immer nur diese):**",
  "- Prussian `#1E3A5F` — Hauptfarbe, Überschriften",
  "- Champagne `#C9A96E` — Akzente, Highlights",
  "- Ash `#4A4A4A` — Fließtext",
  "- Powder `#E8EEF4` — Hintergründe, Tabellen",
  "- Carrot `#E67E22` — CTAs, Buttons",
  "- Weiß `#FFFFFF` und Schwarz `#000000`",
  "",
  "**Logo-Regeln:** Nie verzerren. Original-Dateien aus `/logos/` verwenden. Schwarzes Logo auf hellen Hintergründen, weißes auf dunklen.",
].join("\n");

// ── Structured fields ────────────────────────────────────────────────────────
const dreamCustomer = {
  description:
    "Harald — der typische DACH-Investor. Männlich, 50-65, Unternehmer/Geschäftsführer/Ex-Unternehmer/Zahnarzt/Family-Office-Inhaber. Hat 30 Jahre Vermögen aufgebaut, will es jetzt vor Inflation, Politik und Euro-Risiko schützen. Bleibt in DACH wohnen, will nur international diversifizieren.",
  age: "50-65",
  gender: "80% Männer, 16% Frauen, 4% Paare",
  income: "Eigenkapital ab 500.000 EUR aufwärts (Schwerpunkt). Einstieg ab 250.000 EUR.",
  country: "DE 75%, CH 20%, AT 5%",
  profession:
    "KMU-Geschäftsführer, Zahnarzt/Kieferorthopäde, Finanzdienstleister, Projektentwickler, Family-Office-Inhaber, Ex-Unternehmer nach Firmenverkauf",
  values:
    "Kontrolle zurück, Sicherheit, Ruhe, Vertrauen, etwas hinterlassen, keine Überraschungen mehr, emotionale Entlastung",
  tonality:
    "Misstrauisch (wurde zu oft enttäuscht), müde vom Kämpfen, will Klartext statt Hochglanz, schätzt deutsche Gründlichkeit, erkennt sofort Verkäufer-BS",
};

const customerProblems = {
  financial:
    "Geld verliert auf der Bank ~300 EUR/Tag Kaufkraft durch Inflation. Deutsche Immobilien bringen 2,8% Mietrendite, nach Steuern 1,5%. Vier verschiedene Immobiliensteuern in DE. Angst vor Lastenausgleich/Enteignung. Euro-Abhängigkeit als Klumpenrisiko.",
  mental:
    "Angst vor falscher Entscheidung. Glaubenssatz 'In Krisenzeiten muss man warten'. Glaubt 'Dubai ist Blase / nur für Influencer'. Glaubt 'Auslandsimmobilien sind zu kompliziert'. Misstraut allen Beratern nach schlechten Vorerfahrungen.",
  social:
    "Einsam in der Entscheidung. Frau sagt 'mach was du willst', Steuerberater zuckt Schultern, Kumpel kennt sich nicht aus. Fühlt sich in DE als Unternehmer nicht mehr wertgeschätzt. Will einen Partner, keinen Verkäufer.",
  physical:
    "Müde — nicht pleite, sondern erschöpft vom ständigen Reagieren auf neue Regulierungen. Schläft schlecht weil er nachts durchrechnet was vom Ersparten übrig bleibt. Kiefer spannt sich an beim Lesen der Nachrichten.",
  aesthetic:
    "Will Premium-Service auf deutschem Qualitätsniveau, kein Callcenter. Erwartet Sprache und Prozesse, die er aus der DACH-Geschäftswelt kennt. Schätzt diskrete Eleganz statt Dubai-Hype-Inszenierung.",
};

const fields = {
  // Identity
  name: "Anna Herbst",
  company: "IMOS Real Estate",
  role: "Geschäftsführerin / Vermögensarchitektin Dubai",
  location: "Dubai (UAE) — Zielmarkt: DACH",
  businessContext:
    "IMOS Real Estate — strategische Vermögensarchitektur für DACH-Investoren über Immobilien in Dubai. Off-Plan und Bestandsimmobilien, AAA-Lagen und Meereslage, Luxussegment. Anti-Broker-Positionierung: nicht Wohnungsverkauf, sondern Family-Office-Approach für den Standort Dubai. Full-Service: Immobilienerwerb, Firmengründung, Golden Visa, Strukturierung, laufende Betreuung. Team: 12 Personen, CEO Savvas Kyritsis.",
  professionalBackground:
    "Deutschsprachige Immobilienmaklerin, lebt seit 5 Jahren in Dubai. Spezialisiert auf den Aufbau von Immobilienportfolios für DACH-Investoren ab 250k EUR Eigenkapital (Schwerpunkt 500k+). Family-Office-Approach für den Standort Dubai. Zeitzone: GST (UTC+4).",
  keyAchievements:
    "Nr. 4 Agentur bei EMAAR 2024. 80+ Mio. EUR Investorenkapital strukturiert (in 18 Monaten). 150+ begleitete Investoren. Zugang zu Projekten vor öffentlichem Launch.",

  // Brand
  brandFeeling:
    "Ruhe. Kontrolle zurück. Sicherheit. Vertrauen durch Substanz. Endlich kümmert sich jemand. Charisma = Power + Presence + Warmth (alle drei gleichzeitig).",
  brandProblem:
    "DACH-Investoren wollen ihr Vermögen aus dem Euroraum diversifizieren — finden aber keinen vertrauenswürdigen, deutschsprachigen Partner für Dubai. Die meisten Anbieter sind Hype-Influencer ohne Substanz oder Off-Shore-Verkäufer ohne Verbindung zur DACH-Mentalität. Anna schließt diese Lücke als Family Office für den Standort Dubai.",
  brandingStatement:
    "Anti-Broker. Strategische Vermögensarchitektur in Dubai. Wir verkaufen keine Wohnungen — wir strukturieren Vermögensarchitektur für Unternehmer, die Kapital mit der Sorgfalt eines Family Office strukturieren. Der Kunde ist der Held. Wir sind der Guide.",
  humanDifferentiation:
    "Lebt seit 5 Jahren vor Ort — keine Ferndiagnosen. Deutschsprachige 1:1-Betreuung (Du-Form auf IG/TikTok, Sie-Form auf LinkedIn). Family-Office-Approach statt Maklerei. Persönlich, mit Augenzwinkern (Klammer-Einschübe, ;-), konkrete Namen, Metaphern statt rationaler Begriffe). Loyalität gegenüber Werten, Integrität (was sie sagt, macht sie auch), Selbstachtung (DU stehst im Fokus, nicht das Produkt).",
  providerRole:
    "Guide / Vermögensarchitektin / Family Office für Dubai. Nicht Verkäuferin. Strategische Partnerin, die filtert bevor der Kunde entscheiden muss. Die anruft bevor du fragen musst.",
  providerBeliefs: [
    "Loyalität — treu gegenüber eigenen Werten, kein Anbiedern",
    "Integrität — was ich sage, mache ich auch",
    "Selbstachtung — DU stehst im Fokus, nicht das Produkt, nicht ich",
    "Selbstbestimmung — MEIN Business, mein Weg, Mut + Empowerment",
    "Bewusstsein — sharing some deep true shit, echte Wahrheiten statt Hochglanz",
    "Wachstum — Scham nehmen, vorausgehen, Unbequemes ansprechen wenn es hilft",
    "Charisma = Power + Presence + Warmth (alle drei gleichzeitig)",
    "Leichtigkeit & Happiness + Spaß & Humor — kein Dauerdrama",
    "Verbindung zum Business — jeder persönliche Moment hat eine Brücke zum Investment-Thema",
  ].join("\n"),
  providerStrengths: [
    "FINANZIELLER SCHUTZ: Keine Grundsteuer/Erbschaftssteuer in Dubai (vs. 4 verschiedene Steuern in DE). 6-8% Mietrendite in AAA-Lagen (vs. 2,8% brutto in DE, 1,5% netto). AED an USD gekoppelt (Euro-Hedge). Nr. 4 Agentur bei EMAAR 2024 = Zugang zu Projekten vor öffentlichem Launch.",
    "ZEIT & PROZESS: Kompletter Kaufprozess auf Deutsch begleitet (kein englischer/arabischer Vertrag selbst zu prüfen). Property Management + Vermietung inklusive. 6-Schritte-Prozess von Reservierung bis Grundbuch.",
    "EMOTIONALE SICHERHEIT: 5 Jahre vor Ort = echtes Marktwissen. 150+ begleitete Investoren, 80+ Mio. EUR Portfolio = bewiesene Erfahrung. 1:1 persönliche Betreuung statt Callcenter — die Ansprechpartnerin ruft an BEVOR du fragen musst.",
  ].join("\n\n"),
  authenticityZone: [
    "Klammer-Einschübe für Nebengedanken (\"...ist ja eh schon ein super heisses Thema\")",
    "Drei-Punkte-Auslassung als Stilmittel (\"...und welches Narrativ bedient werden soll\")",
    "Smiley klassisch ;-) statt moderner Emojis. Emojis sparsam, nur als Akzent (→ für Listen, 👉 für CTA)",
    "Metaphern statt rationaler Begriffe (\"Gläser voller als leer\", \"stabiler Anker außerhalb\", \"den Mutigen gehört die Welt\")",
    "Konkrete Namen statt Platzhalter (\"Brian Fürderer und Philipp\" nicht \"zwei Unternehmer\"; \"TME Legal\" nicht \"unser Rechtspartner\")",
    "Konkrete Zeitangaben (\"Anfang März\" / \"im Juli 2025\") nicht vage (\"letzten Sommer\" / \"kürzlich\")",
    "P.S. mit Link + Community-Sprache (\"freuen uns über jeden Like\")",
    "Anti-Staccato: Sätze fließen, sie hacken nicht. Gedanken werden verbunden, nicht zerhackt",
  ].join("\n"),

  // Offer & goal
  coreOffer:
    "Einzelimmobilie ab 250.000 EUR Eigenkapital (Beratung, Suche, Kauf) ODER Portfolio-Aufbau ab 500.000 EUR Eigenkapital (Strategieentwicklung, mehrere Objekte). Kompletter Service: Erwerb, Firmengründung, Golden Visa, Strukturierung, Property Management.",
  mainGoal:
    "Hauptherausforderung aktuell: Leadgenerierung. Hauptkanal: Social Media + Empfehlungen. Funnel: 5-Szenarien-PDF, VSL, Webinar TME Legal, Pre-Launch (DM-Trigger ZUGANG), Direkt-Anfrage über LinkedIn-Content.",

  // (voiceNotes / voiceExamples are TS-only fields without DB columns —
  //  brand-voice material is captured in clientPlaybook below.)

  // Channels
  linkedin: "https://www.linkedin.com/in/annaherbstdubai/",
  language: "de",

  // ── New long-form fields ────────────────────────────────────────────────
  avatarDeepDive,
  clientPlaybook,
};

// Stringify JSON fields for storage
const writePayload = {
  ...fields,
  dreamCustomer: JSON.stringify(dreamCustomer),
  customerProblems: JSON.stringify(customerProblems),
};

// ── Push ────────────────────────────────────────────────────────────────────
console.log(`Updating ${Object.keys(writePayload).length} fields on Anna (${ANNA_ID})`);
console.log(`  avatarDeepDive: ${avatarDeepDive.length.toLocaleString()} chars`);
console.log(`  clientPlaybook: ${clientPlaybook.length.toLocaleString()} chars`);
console.log(`  structured fields: ${Object.keys(writePayload).filter(k => !["avatarDeepDive", "clientPlaybook"].includes(k)).length}`);

if (DRY) {
  console.log("\n[DRY RUN] Skipping write. Sample of writePayload keys:");
  console.log(Object.keys(writePayload).join(", "));
  process.exit(0);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const { error } = await supabase.from("configs").update(writePayload).eq("id", ANNA_ID);
if (error) {
  console.error("Update failed:", error);
  process.exit(1);
}
console.log("\n✓ Anna's profile updated.");
