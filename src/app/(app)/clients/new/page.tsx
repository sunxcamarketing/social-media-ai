"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  X,
  Mic,
  SkipForward,
} from "lucide-react";
import { addClientToCache } from "@/hooks/use-clients-cache";
import { useI18n } from "@/lib/i18n";
import { VoiceAgent } from "@/components/voice-agent";

type Lang = "de" | "en";

// ── Step definitions ──────────────────────────────────────────────────────

interface Step {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  fields: FieldDef[];
}

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "url" | "language-toggle" | "color-palette" | "font-picker" | "voice-intro" | "url-list";
  placeholder: string;
  required?: boolean;
  half?: boolean;
}

function pick<T>(lang: Lang, de: T, en: T): T {
  return lang === "en" ? en : de;
}

// ── Colors / Fonts options ────────────────────────────────────────────────

const COLOR_PALETTES: { id: string; de: { label: string; desc: string }; en: { label: string; desc: string }; colors: string[] }[] = [
  { id: "sage",    de: { label: "Soft Sage",       desc: "Natürlich & beruhigend" },    en: { label: "Soft Sage",       desc: "Natural & calming" },         colors: ["#F5F1E8", "#A3B18A", "#CB997E"] },
  { id: "dusty",   de: { label: "Dusty Rose",      desc: "Romantisch & elegant" },      en: { label: "Dusty Rose",      desc: "Romantic & elegant" },        colors: ["#F4EDE1", "#D4A5A5", "#6D2E46"] },
  { id: "med",     de: { label: "Mediterranean",   desc: "Lebendig & warm" },           en: { label: "Mediterranean",   desc: "Vibrant & warm" },            colors: ["#F6E7C8", "#2E5AA7", "#F4A261"] },
  { id: "sunset",  de: { label: "Sunset Glow",     desc: "Energievoll & einladend" },   en: { label: "Sunset Glow",     desc: "Energetic & inviting" },      colors: ["#FAEDCD", "#F4A261", "#E76F51"] },
  { id: "cocoa",   de: { label: "Cocoa Blush",     desc: "Mutig & unverwechselbar" },   en: { label: "Cocoa Blush",     desc: "Bold & distinctive" },        colors: ["#31241F", "#E9B8C9", "#0A2A92"] },
  { id: "olive",   de: { label: "Earthy Olive",    desc: "Natürlich & geerdet" },       en: { label: "Earthy Olive",    desc: "Natural & grounded" },        colors: ["#8F9D77", "#A63D1A", "#C9C4B8"] },
  { id: "deep",    de: { label: "Deep Contrast",   desc: "Edel & zeitlos" },            en: { label: "Deep Contrast",   desc: "Refined & timeless" },        colors: ["#2F3437", "#BFA67A", "#000000"] },
  { id: "muted",   de: { label: "Muted Business",  desc: "Sachlich & hochwertig" },     en: { label: "Muted Business",  desc: "Professional & premium" },    colors: ["#E8AB16", "#324A60", "#E7E1E0"] },
  { id: "tech",    de: { label: "Modern Tech",     desc: "Digital & präzise" },         en: { label: "Modern Tech",     desc: "Digital & precise" },         colors: ["#8A94A3", "#5B5FEF", "#0D2B45"] },
];

// CapCut-Style Fonts — am häufigsten in Reels/TikTok-Overlays gesehen.
// Alle auf Google Fonts verfügbar, so kann Preview live geladen werden.
const FONTS = [
  { id: "bebas",    fontFamily: "Bebas Neue",        tag: "BOLD DISPLAY", specimen: "Aa", de: { label: "Bold Impact",             desc: "Klassischer Reels-Titel · Groß · All-Caps" },       en: { label: "Bold Impact",             desc: "Classic reels title · Big · All-caps" } },
  { id: "anton",    fontFamily: "Anton",             tag: "CONDENSED",    specimen: "Aa", de: { label: "Tall & Heavy",            desc: "Schmal · Schwer · Hoher Kontrast" },                en: { label: "Tall & Heavy",            desc: "Tight · Heavy · High contrast" } },
  { id: "playfair", fontFamily: "Playfair Display",  tag: "EDITORIAL",    specimen: "Aa", de: { label: "Elegant Editorial",       desc: "Serif · Luxuriös · Ausdrucksstark" },               en: { label: "Elegant Editorial",       desc: "Serif · Luxurious · Expressive" } },
  { id: "caveat",   fontFamily: "Caveat",            tag: "HANDWRITTEN",  specimen: "Aa", de: { label: "Handwritten Script",      desc: "Warm · Persönlich · Nahbar" },                      en: { label: "Handwritten Script",      desc: "Warm · Personal · Approachable" } },
  { id: "marker",   fontFamily: "Permanent Marker",  tag: "MARKER",       specimen: "Aa", de: { label: "Marker Overlay",          desc: "Fett handgeschrieben · Signature Capcut-Style" },   en: { label: "Marker Overlay",          desc: "Bold handwritten · Signature CapCut style" } },
];

const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

function loadGoogleFont(name: string) {
  if (typeof document === "undefined" || !name.trim()) return;
  const id = `gf-${name.trim().replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name.trim())}:wght@300;400;500;700&display=swap`;
  document.head.appendChild(link);
}

function getSteps(lang: Lang): Step[] {
  return [
    {
      id: "language",
      category: "Sprache / Language",
      title: pick(lang, "In welcher Sprache soll dein Content generiert werden?", "Which language should your content be generated in?"),
      subtitle: pick(lang, "Alle Skripte, Strategien und Agent-Antworten nutzen diese Sprache. Kann später nicht geändert werden.", "All scripts, strategies, and agent responses will use this language. Can't be changed later."),
      fields: [
        { key: "language", label: pick(lang, "Sprache", "Language"), type: "language-toggle", placeholder: "", required: true },
      ],
    },
    {
      id: "basics",
      category: pick(lang, "Grundlagen", "Basics"),
      title: pick(lang, "Wer bist du?", "Who are you?"),
      subtitle: pick(lang, "Name und Basics — das Fundament für alles weitere.", "Name and basics — the foundation for everything that follows."),
      fields: [
        { key: "configName", label: pick(lang, "Dein Name / Markenname", "Your name / brand name"), type: "text", placeholder: pick(lang, "z.B. Elliott Mohammadi", "e.g. Elliott Mohammadi"), required: true },
        { key: "company", label: pick(lang, "Dein Unternehmen", "Your company"), type: "text", placeholder: pick(lang, "z.B. Elliott Fitness GmbH", "e.g. Elliott Fitness Inc."), half: true },
        { key: "role", label: pick(lang, "Deine Rolle / Titel", "Your role / title"), type: "text", placeholder: pick(lang, "z.B. Fitness Coach & Mindset Trainer", "e.g. Fitness Coach & Mindset Trainer"), half: true },
        { key: "location", label: pick(lang, "Dein Standort", "Your location"), type: "text", placeholder: pick(lang, "z.B. Dubai / München", "e.g. Dubai / New York"), half: true },
        { key: "creatorsCategory", label: pick(lang, "Deine Nische / Kategorie", "Your niche / category"), type: "text", placeholder: pick(lang, "z.B. Fitness & Mindset", "e.g. Fitness & Mindset"), half: true },
      ],
    },
    {
      id: "social",
      category: pick(lang, "Social Media", "Social Media"),
      title: pick(lang, "Wo bist du aktiv?", "Where are you active?"),
      subtitle: pick(lang, "Deine Social-Media-Profile und Website. Mindestens Instagram.", "Your social profiles and website. Instagram at minimum."),
      fields: [
        { key: "instagram", label: "Instagram", type: "text", placeholder: "@username", required: true },
        { key: "tiktok", label: "TikTok", type: "text", placeholder: "@username", half: true },
        { key: "youtube", label: "YouTube", type: "text", placeholder: "@channel", half: true },
        { key: "linkedin", label: "LinkedIn", type: "url", placeholder: "linkedin.com/in/...", half: true },
        { key: "twitter", label: "X / Twitter", type: "text", placeholder: "@handle", half: true },
        { key: "website", label: pick(lang, "Website", "Website"), type: "url", placeholder: "www.example.com" },
      ],
    },
    {
      id: "business",
      category: pick(lang, "Business", "Business"),
      title: pick(lang, "Was machst du?", "What do you do?"),
      subtitle: pick(lang, "Kontext, Hintergrund und deine Erfolge.", "Context, background, and your achievements."),
      fields: [
        { key: "businessContext", label: pick(lang, "Business-Kontext", "Business context"), type: "textarea", placeholder: pick(lang, "Was machst du genau? Welche Dienstleistungen/Produkte bietest du an? Wer sind deine typischen Kunden?", "What exactly do you do? Which services/products? Who are your typical customers?") },
        { key: "professionalBackground", label: pick(lang, "Dein professioneller Hintergrund", "Your professional background"), type: "textarea", placeholder: pick(lang, "Dein Werdegang, deine Expertise, jahrelange Erfahrung in...", "Your career path, expertise, years of experience in...") },
        { key: "keyAchievements", label: pick(lang, "Deine wichtigsten Erfolge", "Your key achievements"), type: "textarea", placeholder: pick(lang, "z.B. 500+ Kunden betreut, 10M+ Views auf Instagram, Buch veröffentlicht...", "e.g. coached 500+ clients, 10M+ views on Instagram, published a book...") },
      ],
    },
    {
      id: "brand",
      category: pick(lang, "Marke", "Brand"),
      title: pick(lang, "Wie soll deine Marke wirken?", "How should your brand feel?"),
      subtitle: pick(lang, "Das Gefühl, das Problem und deine Positionierung.", "The feeling, the problem, and your positioning."),
      fields: [
        { key: "brandFeeling", label: pick(lang, "Markengefühl", "Brand feeling"), type: "textarea", placeholder: pick(lang, "Welches Gefühl soll jemand haben wenn er deinen Content sieht? z.B. 'Ich kann das auch schaffen'", "What feeling should someone have when they see your content? e.g. 'I can do this too'") },
        { key: "brandProblem", label: pick(lang, "Kernproblem deiner Zielgruppe", "Core problem of your audience"), type: "textarea", placeholder: pick(lang, "Welches Problem löst du für deine Kunden? So konkret wie möglich.", "What problem do you solve for your customers? As concrete as possible.") },
        { key: "brandingStatement", label: pick(lang, "Deine Positionierung in einem Satz", "Your positioning in one sentence"), type: "text", placeholder: pick(lang, "z.B. 'Der ehrlichste Fitness-Coach Deutschlands'", "e.g. 'The most honest fitness coach in the US'") },
        { key: "humanDifferentiation", label: pick(lang, "Was macht dich einzigartig?", "What makes you unique?"), type: "textarea", placeholder: pick(lang, "Was unterscheidet dich von allen anderen in deiner Nische? Der persönliche Faktor.", "What sets you apart from everyone else in your niche? The personal factor.") },
      ],
    },
    {
      id: "colors",
      category: pick(lang, "Farben", "Colors"),
      title: pick(lang, "Welche Farben passen zu dir?", "Which colors fit you?"),
      subtitle: pick(lang, "Wähle eine Palette oder gib eigene Hex-Codes an.", "Pick a palette or enter your own hex codes."),
      fields: [
        { key: "colorPalette", label: pick(lang, "Farbpalette", "Color palette"), type: "color-palette", placeholder: "" },
      ],
    },
    {
      id: "fonts",
      category: pick(lang, "Schrift", "Fonts"),
      title: pick(lang, "Welcher Schriftstil gefällt dir?", "Which font style do you like?"),
      subtitle: pick(lang, "Die Schrift prägt deinen Charakter. Wähle einen Klassiker oder gib einen Google-Font-Namen ein.", "Fonts shape your character. Pick a classic or enter any Google Font name."),
      fields: [
        { key: "fontStyle", label: pick(lang, "Schrift", "Font"), type: "font-picker", placeholder: "" },
      ],
    },
    {
      id: "offer",
      category: pick(lang, "Angebot", "Offer"),
      title: pick(lang, "Was verkaufst du?", "What do you sell?"),
      subtitle: pick(lang, "Dein Angebot ist der Kern — Content ist seine Verlängerung, nicht Kunstprojekt.", "Your offer is the core — content is its extension, not an art project."),
      fields: [
        { key: "coreOffer", label: pick(lang, "Dein Core Offer", "Your core offer"), type: "textarea", placeholder: pick(lang, "Was genau verkaufst du? Preis, Laufzeit, konkretes Ergebnis. z.B. '12-Wochen Coaching-Programm, 3.000€, Ergebnis: Traumfigur ohne Jojo-Effekt'", "What exactly are you selling? Price, duration, concrete result. e.g. '12-week coaching program, $3,000, result: dream body without yo-yo effect'") },
        { key: "mainGoal", label: pick(lang, "Dein konkretes Ziel", "Your concrete goal"), type: "text", placeholder: pick(lang, "z.B. '5 Sales Calls/Woche', 'Launch in 6 Wochen', '10 neue Kunden/Monat'", "e.g. '5 sales calls/week', 'launch in 6 weeks', '10 new clients/month'") },
      ],
    },
    {
      id: "audience",
      category: pick(lang, "Zielgruppe", "Audience"),
      title: pick(lang, "Wen willst du erreichen?", "Who do you want to reach?"),
      subtitle: pick(lang, "Dein Traumkunde und seine Probleme.", "Your dream customer and their problems."),
      fields: [
        { key: "dreamCustomer", label: pick(lang, "Dein Traumkunde", "Your dream customer"), type: "textarea", placeholder: pick(lang, "Wer ist dein idealer Kunde? Alter, Situation, Schmerzpunkt, Wünsche...", "Who is your ideal customer? Age, situation, pain point, desires...") },
        { key: "customerProblems", label: pick(lang, "Top-Probleme deiner Zielgruppe", "Top problems of your audience"), type: "textarea", placeholder: pick(lang, "Die 3-5 größten Probleme die dein Traumkunde hat (eins pro Zeile)", "The 3-5 biggest problems your dream customer has (one per line)") },
      ],
    },
    {
      id: "inspiration",
      category: pick(lang, "Inspiration", "Inspiration"),
      title: pick(lang, "Welche Reels & Profile findest du gut?", "Which reels & profiles do you love?"),
      subtitle: pick(lang, "Paste Links zu Reels die du als gut editiert empfindest und Profile die du magst. Die KI lernt daraus deinen Referenz-Stil.", "Paste links to reels you consider well-edited and profiles you admire. The AI learns your reference style from them."),
      fields: [
        { key: "inspirationReels", label: pick(lang, "Reel-Links (Editing-Referenz)", "Reel links (editing references)"), type: "url-list", placeholder: pick(lang, "z.B. https://www.instagram.com/reel/Cxy...", "e.g. https://www.instagram.com/reel/Cxy...") },
        { key: "inspirationProfiles", label: pick(lang, "Profile die du magst", "Profiles you admire"), type: "url-list", placeholder: pick(lang, "z.B. @aysun.caliskan oder instagram.com/aysun.caliskan", "e.g. @aysun.caliskan or instagram.com/aysun.caliskan") },
      ],
    },
    {
      id: "voiceBasics",
      category: pick(lang, "Stimme", "Voice"),
      title: pick(lang, "Wie sprichst du?", "How do you speak?"),
      subtitle: pick(lang, "Tonalität, Überzeugungen und Stärken — für authentischen Content.", "Tone, beliefs, and strengths — for authentic content."),
      fields: [
        { key: "providerRole", label: pick(lang, "Deine Rolle gegenüber der Zielgruppe", "Your role toward the audience"), type: "text", placeholder: pick(lang, "z.B. Mentor, großer Bruder, strenger Coach, beste Freundin...", "e.g. mentor, big brother, strict coach, best friend...") },
        { key: "providerBeliefs", label: pick(lang, "Deine Kernüberzeugungen", "Your core beliefs"), type: "textarea", placeholder: pick(lang, "Was glaubst du zutiefst? z.B. 'Jeder kann sich verändern, aber nicht jeder will es genug'", "What do you deeply believe? e.g. 'Anyone can change, but not everyone wants it enough'") },
        { key: "providerStrengths", label: pick(lang, "Deine Kommunikationsstärken", "Your communication strengths"), type: "textarea", placeholder: pick(lang, "z.B. direkt, emotional, humorvoll, provokant, empathisch...", "e.g. direct, emotional, humorous, provocative, empathetic...") },
        { key: "authenticityZone", label: pick(lang, "Deine Authentizitätszone", "Your authenticity zone"), type: "textarea", placeholder: pick(lang, "Worüber sprichst du am liebsten frei und ungeschliffen? Wo ist deine Leidenschaft am größten?", "What do you love to talk about most freely and rawly? Where is your passion the greatest?") },
      ],
    },
    {
      id: "voiceInterview",
      category: pick(lang, "Stimmprofil", "Voice profile"),
      title: pick(lang, "Jetzt reden wir.", "Now let's talk."),
      subtitle: pick(lang, "15–20 Minuten Gespräch mit unserem KI-Interviewer. Dabei erfassen wir dein Stimmprofil, deine Erfahrungen und Geschichten — die Basis für authentischen Content in deinem echten Ton.", "15–20 minutes with our AI interviewer. We'll capture your voice profile, your experiences and stories — the foundation for authentic content in your real tone."),
      fields: [
        { key: "voiceInterviewDone", label: "", type: "voice-intro", placeholder: "" },
      ],
    },
  ];
}

// ── Sub-components ────────────────────────────────────────────────────────

function UrlList({
  lang,
  value,
  onChange,
  placeholder,
}: {
  lang: Lang;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  // Value is newline-joined URLs/handles. Render as editable rows with +/- controls.
  const lines = value ? value.split("\n").filter((l) => l.trim().length > 0) : [];
  const entries = lines.length > 0 ? lines : [""];

  const setLine = (idx: number, next: string) => {
    const copy = [...entries];
    copy[idx] = next;
    onChange(copy.filter((l) => l.trim().length > 0).join("\n"));
  };

  const addRow = () => {
    onChange(entries.concat([""]).filter((l, i, arr) => l.trim().length > 0 || i === arr.length - 1).join("\n"));
  };

  const removeRow = (idx: number) => {
    const copy = entries.filter((_, i) => i !== idx);
    onChange(copy.filter((l) => l.trim().length > 0).join("\n"));
  };

  // Always show at least one empty row at the end if last is not empty
  const shown = entries.length > 0 && entries[entries.length - 1].trim().length > 0
    ? [...entries, ""]
    : entries;

  return (
    <div className="space-y-2">
      {shown.map((v, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <input
            type="text"
            value={v}
            onChange={(e) => setLine(i, e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            className="flex-1 h-11 rounded-xl bg-white border border-ocean/[0.08] px-4 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none focus:border-blush/60 focus:shadow-[0_0_0_3px_rgba(242,200,210,0.15)] transition-all"
          />
          {v.trim().length > 0 && (
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="h-8 w-8 rounded-lg text-ocean/35 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
              title={pick(lang, "Entfernen", "Remove")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs text-ocean/55 hover:text-ocean transition-colors mt-1"
      >
        <Plus className="h-3.5 w-3.5" />
        {pick(lang, "Weiteren Link hinzufügen", "Add another link")}
      </button>
    </div>
  );
}

function ColorPaletteGrid({ lang, value, onChange }: { lang: Lang; value: string; onChange: (v: string) => void }) {
  // value is JSON: { id: string, colors: string[] }
  const parsed = useMemo(() => {
    try { return value ? JSON.parse(value) as { id: string; colors: string[] } : null; }
    catch { return null; }
  }, [value]);

  const selectedId = parsed?.id || "";
  const [customColors, setCustomColors] = useState<string[]>(
    parsed?.id === "custom" ? parsed.colors : ["#e5e5e5", "#d4d4d4", "#f5f5f5"],
  );
  const [hexValues, setHexValues] = useState<string[]>(customColors);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const selectPalette = (id: string) => {
    if (id === "custom") {
      onChange(JSON.stringify({ id: "custom", colors: customColors }));
    } else {
      const p = COLOR_PALETTES.find(x => x.id === id);
      if (p) onChange(JSON.stringify({ id, colors: p.colors }));
    }
  };

  const handleHex = (idx: number, text: string) => {
    const val = text.startsWith("#") ? text : "#" + text;
    const nextHex = [...hexValues];
    nextHex[idx] = val;
    setHexValues(nextHex);
    if (isValidHex(val)) {
      const nextColors = [...customColors];
      nextColors[idx] = val;
      setCustomColors(nextColors);
      onChange(JSON.stringify({ id: "custom", colors: nextColors }));
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
      {COLOR_PALETTES.map((p, i) => {
        const selected = selectedId === p.id;
        const content = lang === "en" ? p.en : p.de;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => selectPalette(p.id)}
            className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
              selected
                ? "border-ocean shadow-[0_4px_18px_rgba(32,35,69,0.12)]"
                : "border-ocean/[0.08] hover:border-ocean/25 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex h-[72px]">
              {p.colors.map((c, ci) => (
                <div key={ci} className="flex-1" style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className={`px-3 py-2.5 ${selected ? "bg-ocean/[0.04]" : "bg-white"}`}>
              <div className={`text-[12px] font-medium leading-tight ${selected ? "text-ocean" : "text-ocean/85"}`}>
                {content.label}
              </div>
              <div className={`text-[10.5px] leading-tight mt-0.5 ${selected ? "text-ocean/70" : "text-ocean/50"}`}>
                {content.desc}
              </div>
            </div>
            {selected && (
              <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-ocean flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Custom palette card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: COLOR_PALETTES.length * 0.03 }}
        onClick={() => selectedId !== "custom" && selectPalette("custom")}
        className={`relative rounded-xl overflow-hidden cursor-pointer border-2 border-dashed transition-all ${
          selectedId === "custom"
            ? "border-ocean bg-ocean/[0.02] shadow-[0_4px_18px_rgba(32,35,69,0.10)]"
            : "border-ocean/[0.15] hover:border-ocean/35"
        }`}
      >
        <div className="flex h-[72px]">
          {customColors.map((c, ci) => (
            <div key={ci} className="flex-1" style={{ backgroundColor: isValidHex(c) ? c : "#e5e5e5" }} />
          ))}
        </div>
        <div className={`px-3 py-2.5 ${selectedId === "custom" ? "bg-ocean/[0.04]" : "bg-white"}`}>
          <div className={`text-[12px] font-medium leading-tight ${selectedId === "custom" ? "text-ocean" : "text-ocean/85"}`}>
            {pick(lang, "Eigene Farben", "Custom colors")}
          </div>
          <div className={`text-[10.5px] leading-tight mt-0.5 ${selectedId === "custom" ? "text-ocean/70" : "text-ocean/50"}`}>
            {pick(lang, "Deine Hex-Codes", "Your hex codes")}
          </div>
        </div>

        <AnimatePresence>
          {selectedId === "custom" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="overflow-hidden bg-ocean/[0.02] border-t border-ocean/[0.08]"
            >
              <div className="p-2.5 space-y-1.5">
                {[0, 1, 2].map((idx) => {
                  const val = hexValues[idx] || customColors[idx];
                  const invalid = val.length > 1 && !isValidHex(val);
                  const active = activeIdx === idx;
                  return (
                    <div key={idx} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all ${active ? "bg-ocean/[0.04]" : ""}`}>
                      <div
                        className="h-5 w-5 rounded border border-ocean/15 shrink-0"
                        style={{ backgroundColor: isValidHex(val) ? val : "#e5e5e5" }}
                      />
                      <span className="text-[10.5px] text-ocean/55 flex-1">
                        {pick(lang, `Farbe ${idx + 1}`, `Color ${idx + 1}`)}
                      </span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleHex(idx, e.target.value)}
                        onFocus={() => setActiveIdx(idx)}
                        onBlur={() => setActiveIdx(null)}
                        onClick={(e) => e.stopPropagation()}
                        maxLength={7}
                        placeholder="#000000"
                        className={`w-[74px] font-mono text-[10.5px] uppercase text-center rounded-md px-1.5 py-1 outline-none transition-all ${
                          invalid
                            ? "border border-red-400 text-red-500 bg-red-50"
                            : active
                            ? "border border-ocean/35 text-ocean bg-white"
                            : "border border-ocean/10 text-ocean/70 bg-white"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function FontPicker({ lang, value, customFontsValue, onChange, onCustomChange }: {
  lang: Lang;
  value: string;
  customFontsValue: string;
  onChange: (v: string) => void;
  onCustomChange: (v: string) => void;
}) {
  const parsedCustom = useMemo(() => {
    try { return customFontsValue ? JSON.parse(customFontsValue) as { heading?: string; body?: string } : null; }
    catch { return null; }
  }, [customFontsValue]);

  const [customOpen, setCustomOpen] = useState(!!parsedCustom?.heading);
  const [headingInput, setHeadingInput] = useState(parsedCustom?.heading || "");
  const [preview, setPreview] = useState(parsedCustom?.heading || "");

  useEffect(() => {
    FONTS.forEach(f => loadGoogleFont(f.fontFamily));
    if (parsedCustom?.heading) loadGoogleFont(parsedCustom.heading);
  }, [parsedCustom?.heading]);

  const debouncedPreview = (text: string) => {
    setHeadingInput(text);
    const t = setTimeout(() => {
      setPreview(text);
      if (text.trim()) loadGoogleFont(text.trim());
    }, 350);
    return () => clearTimeout(t);
  };

  const confirmCustom = () => {
    if (!headingInput.trim()) return;
    const normalized = headingInput.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1));
    loadGoogleFont(normalized);
    onCustomChange(JSON.stringify({ heading: normalized }));
    onChange("custom");
  };

  const clearCustom = () => {
    onCustomChange("");
    setHeadingInput("");
    setPreview("");
    if (value === "custom") onChange("");
  };

  const confirmedCustom = parsedCustom?.heading;

  return (
    <div className="space-y-2.5 w-full">
      {FONTS.map((f, i) => {
        const selected = value === f.id;
        const content = lang === "en" ? f.en : f.de;
        return (
          <motion.button
            key={f.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onChange(f.id)}
            className={`w-full relative flex items-center justify-between gap-6 p-5 rounded-2xl border-2 transition-all ${
              selected
                ? "border-ocean bg-ocean/[0.04] shadow-[0_4px_18px_rgba(32,35,69,0.08)]"
                : "border-ocean/[0.08] bg-white hover:border-ocean/25 hover:-translate-y-0.5"
            }`}
          >
            <div className="flex flex-col items-start gap-1 min-w-0 text-left">
              <span className={`text-[9px] tracking-[0.2em] uppercase ${selected ? "text-ocean" : "text-ocean/45"}`}>
                {f.tag}
              </span>
              <span
                className={`text-[17px] font-medium tracking-tight leading-snug ${selected ? "text-ocean" : "text-ocean/85"}`}
                style={{ fontFamily: `"${f.fontFamily}", sans-serif` }}
              >
                {content.label}
              </span>
              <span className={`text-[12px] ${selected ? "text-ocean/65" : "text-ocean/55"}`}>
                {content.desc}
              </span>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span
                className={`text-[44px] leading-none ${selected ? "text-ocean" : "text-ocean/45"}`}
                style={{ fontFamily: `"${f.fontFamily}", sans-serif`, fontWeight: 400 }}
              >
                {f.specimen}
              </span>
              <span className="text-[9px] uppercase tracking-[0.12em] text-ocean/40">
                {f.fontFamily}
              </span>
            </div>
            {selected && (
              <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-ocean flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </motion.button>
        );
      })}

      {/* Custom font */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setCustomOpen(v => !v)}
          className="flex items-center gap-1.5 text-[12px] text-ocean/70 hover:text-ocean transition-colors"
        >
          <motion.span animate={{ rotate: customOpen ? 45 : 0 }} transition={{ duration: 0.2 }}>
            <Plus className="h-3.5 w-3.5" />
          </motion.span>
          {pick(lang, "Eigene Google-Font verwenden", "Use a custom Google Font")}
        </button>

        <AnimatePresence>
          {customOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2.5">
                {confirmedCustom ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 rounded-xl border border-ocean/25 bg-ocean/[0.03]"
                  >
                    <div>
                      <div className="text-[9px] tracking-[0.2em] uppercase text-ocean/60">
                        {pick(lang, "Aktive Schrift", "Active font")}
                      </div>
                      <div
                        className="text-[18px] text-ocean"
                        style={{ fontFamily: `"${confirmedCustom}", sans-serif` }}
                      >
                        {confirmedCustom}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearCustom}
                      className="p-1.5 text-ocean/40 hover:text-ocean/80"
                      title={pick(lang, "Entfernen", "Remove")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={headingInput}
                      onChange={(e) => debouncedPreview(e.target.value)}
                      placeholder={pick(lang, "Google-Font-Name, z.B. Manrope, Fraunces, Syne...", "Google Font name, e.g. Manrope, Fraunces, Syne...")}
                      spellCheck={false}
                      className="w-full h-11 rounded-xl bg-white border border-ocean/[0.08] px-4 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none focus:border-ocean/35 transition-all"
                    />
                    <AnimatePresence>
                      {preview.trim() && (
                        <motion.button
                          type="button"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={confirmCustom}
                          className="w-full text-left p-4 rounded-xl border border-ocean/[0.08] bg-white hover:border-ocean/25 transition-all"
                        >
                          <div className="text-[9px] tracking-[0.2em] uppercase text-ocean/45 mb-1.5">
                            {pick(lang, "Klicken zum Bestätigen", "Click to confirm")}
                          </div>
                          <div
                            className="text-[24px] leading-tight text-ocean tracking-tight"
                            style={{ fontFamily: `"${preview}", sans-serif` }}
                          >
                            {pick(lang, "Hier spricht deine Marke", "Your brand speaking")}
                          </div>
                          <div className="text-[11px] text-ocean/50 mt-1" style={{ fontFamily: `"${preview}", sans-serif` }}>
                            Aa Bb Cc · 123 · {preview}
                          </div>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function NewClientOnboarding() {
  const router = useRouter();
  const { lang: uiLang } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [langPickedByUser, setLangPickedByUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const lang: Lang = langPickedByUser && (answers.language === "en" || answers.language === "de")
    ? answers.language
    : uiLang;
  const STEPS = useMemo(() => getSteps(lang), [lang]);

  useEffect(() => {
    if (!langPickedByUser) {
      setAnswers((prev) => ({ ...prev, language: uiLang }));
    }
  }, [uiLang, langPickedByUser]);

  const pickLanguage = useCallback((lng: Lang) => {
    setLangPickedByUser(true);
    setAnswers((prev) => ({ ...prev, language: lng }));
  }, []);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;
  const isVoiceStep = step.id === "voiceInterview";

  const canProceed = step.fields
    .filter((f) => f.required)
    .every((f) => (answers[f.key] || "").trim().length > 0);

  const setAnswer = useCallback((key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goNext = () => {
    if (!canProceed) return;
    setDirection(1);
    if (isLast) {
      handleSubmit({ startVoice: isVoiceStep });
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (isFirst) {
      router.push("/admin");
      return;
    }
    setDirection(-1);
    setCurrentStep((s) => s - 1);
  };

  const handleSubmit = async ({ startVoice }: { startVoice: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || pick(lang, "Fehler beim Speichern", "Failed to save"));
      }
      const created = await res.json();
      addClientToCache(created);
      if (startVoice) {
        setCreatedClientId(created.id);
        setSaving(false);
      } else {
        router.push(`/clients/${created.id}/dashboard`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : pick(lang, "Fehler", "Error"));
      setSaving(false);
    }
  };

  const finishVoiceSession = () => {
    if (!createdClientId) return;
    router.push(`/clients/${createdClientId}/dashboard`);
  };

  const goToStep = (idx: number) => {
    if (idx > currentStep) return;
    setDirection(idx > currentStep ? 1 : -1);
    setCurrentStep(idx);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canProceed) {
      // Skip Enter-submit on steps that need visual interaction
      if (step.fields.some(f => ["color-palette", "font-picker", "voice-intro"].includes(f.type))) return;
      e.preventDefault();
      goNext();
    }
  };

  // Once the client is created and we're in voice session — render the VoiceAgent full-width.
  if (createdClientId) {
    return (
      <div className="-mx-4 sm:-mx-6 md:-mx-8 -mt-6 md:-mt-8 -mb-6 md:-mb-8 min-h-[calc(100vh-3.5rem)] flex flex-col">
        <div className="px-4 sm:px-6 md:px-8 pt-6 md:pt-8 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-5xl mx-auto w-full">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-ocean/40 mb-1">
              {pick(lang, "Letzter Schritt", "Final step")}
            </div>
            <h1 className="text-lg sm:text-xl font-light text-ocean">
              {pick(lang, "Erzähl uns deine Geschichte.", "Tell us your story.")}
            </h1>
            <p className="text-sm text-ocean/50 mt-1">
              {pick(lang, "15–20 Minuten reichen. Dein Stimmprofil entsteht live.", "15–20 minutes. Your voice profile is captured live.")}
            </p>
          </div>
          <button
            onClick={finishVoiceSession}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full border border-ocean/[0.12] text-sm text-ocean/70 hover:bg-ocean/[0.03] transition-all shrink-0"
          >
            <SkipForward className="h-4 w-4" />
            <span className="whitespace-nowrap">{pick(lang, "Fertig — zum Dashboard", "Done — go to dashboard")}</span>
          </button>
        </div>
        <div className="flex-1 px-4 sm:px-6 md:px-8 pb-6 md:pb-8 max-w-5xl mx-auto w-full">
          <VoiceAgent
            clientIdOverride={createdClientId}
            lang={lang}
            mode="onboarding"
            onSessionEnd={finishVoiceSession}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 md:-mx-8 -mt-6 md:-mt-8 -mb-6 md:-mb-8 min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-8 sm:mb-10">
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToStep(i)}
              title={s.category}
              disabled={i > currentStep}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < currentStep
                  ? "bg-ocean cursor-pointer hover:bg-ocean-light"
                  : i === currentStep
                  ? "bg-ocean"
                  : "bg-ocean/15"
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-ocean/40 uppercase tracking-wider">{step.category}</span>
          <span className="text-[10px] text-ocean/40">{currentStep + 1} / {STEPS.length}</span>
        </div>
      </div>

      {/* Step content */}
      <div className="w-full max-w-2xl" onKeyDown={handleKeyDown}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="mb-6 sm:mb-8">
              <h1 className="text-xl sm:text-2xl font-light text-ocean">{step.title}</h1>
              {step.subtitle && (
                <p className="text-sm text-ocean/50 mt-1.5">{step.subtitle}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              {step.fields.map((field, i) => (
                <motion.div
                  key={field.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={field.half ? "w-full sm:w-[calc(50%-0.5rem)]" : "w-full"}
                >
                  {field.type !== "color-palette" && field.type !== "font-picker" && field.type !== "voice-intro" && field.label && (
                    <label className="block text-xs font-medium text-ocean/60 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-blush-dark ml-0.5">*</span>}
                    </label>
                  )}
                  {field.type === "textarea" ? (
                    <textarea
                      value={answers[field.key] || ""}
                      onChange={(e) => setAnswer(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full rounded-xl bg-white border border-ocean/[0.08] px-4 py-3 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none focus:border-blush/60 focus:shadow-[0_0_0_3px_rgba(242,200,210,0.15)] transition-all resize-none leading-relaxed"
                    />
                  ) : field.type === "language-toggle" ? (
                    <div className="flex gap-3">
                      {(["de", "en"] as const).map((lng) => {
                        const selected = answers[field.key] === lng;
                        return (
                          <button
                            key={lng}
                            type="button"
                            onClick={() => pickLanguage(lng)}
                            className={`flex-1 h-20 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                              selected
                                ? "border-ocean bg-ocean/[0.04] shadow-[0_2px_12px_rgba(32,35,69,0.08)]"
                                : "border-ocean/[0.08] bg-white hover:border-ocean/25"
                            }`}
                          >
                            <span className="text-2xl">{lng === "de" ? "🇩🇪" : "🇬🇧"}</span>
                            <span className={`text-sm font-medium ${selected ? "text-ocean" : "text-ocean/60"}`}>
                              {lng === "de" ? "Deutsch" : "English"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : field.type === "voice-intro" ? (
                    <div className="rounded-2xl border-2 border-ocean/[0.08] bg-gradient-to-br from-blush-light/30 to-white p-8 text-center">
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush/20 mb-4">
                        <Mic className="h-6 w-6 text-blush-dark" />
                      </div>
                      <h3 className="text-lg font-medium text-ocean mb-2">
                        {pick(lang, "Dein Stimmprofil live", "Your voice profile, live")}
                      </h3>
                      <p className="text-sm text-ocean/60 leading-relaxed max-w-md mx-auto">
                        {pick(
                          lang,
                          "Unser KI-Interviewer stellt dir ~15 gezielte Fragen. Du redest frei — dabei erfassen wir deinen Ton, deine Art zu erzählen, deine Präferenzen. Alles fließt automatisch in künftige Skripte ein.",
                          "Our AI interviewer asks you ~15 targeted questions. You speak freely — we capture your tone, your way of telling stories, your preferences. All of it flows into future scripts automatically.",
                        )}
                      </p>
                      <div className="mt-6 flex flex-wrap gap-3 justify-center text-xs text-ocean/55">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-ocean/[0.08]">
                          <span className="h-1.5 w-1.5 rounded-full bg-blush-dark" />
                          15–20 Min
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-ocean/[0.08]">
                          <span className="h-1.5 w-1.5 rounded-full bg-blush-dark" />
                          {pick(lang, "Mikro erforderlich", "Mic required")}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-ocean/[0.08]">
                          <span className="h-1.5 w-1.5 rounded-full bg-blush-dark" />
                          {pick(lang, "Du kannst später wiederholen", "Can be redone later")}
                        </span>
                      </div>
                    </div>
                  ) : field.type === "color-palette" ? (
                    <ColorPaletteGrid lang={lang} value={answers[field.key] || ""} onChange={(v) => setAnswer(field.key, v)} />
                  ) : field.type === "font-picker" ? (
                    <FontPicker
                      lang={lang}
                      value={answers[field.key] || ""}
                      customFontsValue={answers.customFonts || ""}
                      onChange={(v) => setAnswer(field.key, v)}
                      onCustomChange={(v) => setAnswer("customFonts", v)}
                    />
                  ) : field.type === "url-list" ? (
                    <UrlList
                      lang={lang}
                      value={answers[field.key] || ""}
                      onChange={(v) => setAnswer(field.key, v)}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      type={field.type === "url" ? "url" : "text"}
                      value={answers[field.key] || ""}
                      onChange={(e) => setAnswer(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full h-11 rounded-xl bg-white border border-ocean/[0.08] px-4 text-sm text-ocean placeholder:text-ocean/30 focus:outline-none focus:border-blush/60 focus:shadow-[0_0_0_3px_rgba(242,200,210,0.15)] transition-all"
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="w-full max-w-2xl flex items-center justify-between mt-10 gap-3">
        <button
          onClick={goBack}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-ocean/[0.08] text-sm text-ocean/60 hover:text-ocean hover:border-ocean/[0.15] transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFirst ? pick(lang, "Abbrechen", "Cancel") : pick(lang, "Zurück", "Back")}
        </button>

        <div className="flex items-center gap-2">
          {isVoiceStep && (
            <button
              onClick={() => handleSubmit({ startVoice: false })}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-ocean/[0.08] text-sm text-ocean/60 hover:text-ocean hover:bg-ocean/[0.03] transition-all disabled:opacity-40"
            >
              <SkipForward className="h-4 w-4" />
              {pick(lang, "Ohne Interview speichern", "Save without interview")}
            </button>
          )}
          <button
            onClick={goNext}
            disabled={!canProceed || saving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all shadow-lg ${
              canProceed && !saving
                ? "bg-ocean text-white hover:bg-ocean-light hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                : "bg-ocean/30 text-white/60 cursor-not-allowed shadow-none"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {pick(lang, "Wird gespeichert...", "Saving...")}
              </>
            ) : isVoiceStep ? (
              <>
                <Mic className="h-4 w-4" />
                {pick(lang, "Gespräch starten", "Start interview")}
              </>
            ) : isLast ? (
              <>
                <Check className="h-4 w-4" />
                {pick(lang, "Client anlegen", "Create client")}
              </>
            ) : (
              <>
                {pick(lang, "Weiter", "Next")}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
