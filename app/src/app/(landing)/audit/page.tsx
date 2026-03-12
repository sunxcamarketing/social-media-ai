"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";

type Phase = "idle" | "scraping" | "reels" | "analyzing" | "done" | "error";

interface ProfileData {
  username: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  profilePicUrl: string;
}

interface AuditSummary {
  score: number;
  scoreLabel: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  quickWins: string[];
}

const STEPS = [
  { phase: "scraping" as Phase, label: "Profil wird geladen…" },
  { phase: "reels" as Phase, label: "Videos werden analysiert…" },
  { phase: "analyzing" as Phase, label: "Strategie wird erstellt…" },
];

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 text-blush-dark animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ProgressStep({ label, status }: { label: string; status: "waiting" | "active" | "done" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-ocean/10 bg-white">
        {status === "done" && <CheckIcon />}
        {status === "active" && <SpinnerIcon />}
        {status === "waiting" && <div className="h-2 w-2 rounded-full bg-ocean/15" />}
      </div>
      <span className={`text-sm font-light ${status === "waiting" ? "text-ocean/30" : status === "active" ? "text-ocean/70" : "text-ocean/50"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Score Ring ──
function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color = score >= 7 ? "#22c55e" : score >= 4 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(32,35,69,0.06)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-light text-ocean">{score}</span>
          <span className="text-xs text-ocean/35">/10</span>
        </div>
      </div>
      <span className="mt-3 text-sm font-medium text-ocean/60">{label}</span>
    </div>
  );
}

// ── Section Card ──
function SectionCard({ title, items, accentColor, icon }: {
  title: string;
  items: string[];
  accentColor: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ocean/5 bg-white p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentColor}`}>
          {icon}
        </div>
        <h3 className="text-base font-medium text-ocean">{title}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm font-light text-ocean/60 leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ocean/15" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AuditPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [error, setError] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const phaseOrder: Phase[] = ["scraping", "reels", "analyzing", "done"];

  function getStepStatus(stepPhase: Phase): "waiting" | "active" | "done" {
    const currentIdx = phaseOrder.indexOf(phase);
    const stepIdx = phaseOrder.indexOf(stepPhase);
    if (currentIdx > stepIdx) return "done";
    if (currentIdx === stepIdx) return "active";
    return "waiting";
  }

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !instagram.trim()) {
      setError("Bitte fülle alle Felder aus.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    setPhase("scraping");
    setProfile(null);
    setSummary(null);


    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, instagramHandle: instagram, lang: "de" }),
        signal: controller.signal,
      });

      if (!res.body) {
        setPhase("error");
        setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.phase === "scraping") setPhase("scraping");
            else if (data.phase === "profile_loaded" && data.profile) setProfile(data.profile);
            else if (data.phase === "reels") setPhase("reels");
            else if (data.phase === "analyzing") setPhase("analyzing");
            else if (data.phase === "done") {
              setPhase("done");
              setSummary(data.summary);
              if (data.profile) setProfile(data.profile);
              // Email wird server-seitig getriggert — kein Client-Request nötig
            } else if (data.phase === "error") {
              setPhase("error");
              setError(data.message || "Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setPhase("error");
        setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
      }
    }
  }, [firstName, lastName, email, instagram]);

  const handleReset = () => {
    setPhase("idle");
    setProfile(null);
    setSummary(null);
    setError("");

    setFirstName("");
    setLastName("");
    setEmail("");
    setInstagram("");
  };

  const isLoading = phase === "scraping" || phase === "reels" || phase === "analyzing";
  const showForm = phase === "idle" || phase === "error";
  const showProgress = isLoading;
  const showResult = phase === "done" && summary;

  return (
    <div className="relative overflow-hidden">

      {/* ════════════════════════════════════════════════ */}
      {/* HERO SECTION — Split layout with image */}
      {/* ════════════════════════════════════════════════ */}
      <section className="relative bg-warm-white overflow-hidden">
        {/* Gradient Orbs */}
        <div className="pointer-events-none absolute top-20 -left-40 h-[500px] w-[500px] rounded-full bg-blush/20 blur-[120px]" />
        <div className="pointer-events-none absolute top-60 -right-32 h-[400px] w-[400px] rounded-full bg-wind/10 blur-[100px]" />

        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — Text + CTA */}
            <div className="relative z-10">
              <span className="inline-block text-xs font-medium tracking-[0.2em] text-ocean/35 uppercase mb-6">
                Kostenloser Strategie-Scan
              </span>
              <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-light tracking-tight text-ocean leading-[1.1]">
                Finde heraus, was dein Instagram{" "}
                <span className="relative inline-block">
                  wirklich zurückhält
                  <span className="absolute bottom-1 left-0 w-full h-3 bg-blush/40 -z-10" />
                </span>
              </h1>
              <p className="mt-6 text-lg font-light text-ocean/50 leading-relaxed max-w-lg">
                KI-gestützte Analyse deines Profils mit konkreten Tipps — kostenlos.
                Du bekommst eine Sofort-Übersicht und die vollständige Analyse als PDF per Mail.
              </p>

              {/* Quick benefit pills */}
              <div className="mt-8 flex flex-wrap gap-3">
                {["Datenbasierte Analyse", "Sofort-Ergebnis", "PDF per Mail"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-2 rounded-full bg-white border border-ocean/5 px-4 py-2 text-sm font-light text-ocean/60">
                    <svg className="h-4 w-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {t}
                  </span>
                ))}
              </div>

              <button
                onClick={scrollToForm}
                className="mt-10 rounded-full bg-ocean px-10 py-4 text-white font-medium tracking-wide hover:bg-ocean-light transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20"
              >
                Jetzt kostenlos analysieren
              </button>
            </div>

            {/* Right — Hero image */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md">
                <Image
                  src="/images/landing/aysun-hero.jpg"
                  alt="Aysun Caliskan — Instagram Growth Strategin"
                  width={600}
                  height={900}
                  className="rounded-3xl object-cover shadow-2xl shadow-ocean/10"
                  priority
                />
                {/* Floating stat card */}
                <div className="absolute -left-6 bottom-20 rounded-2xl bg-white/95 backdrop-blur-sm border border-ocean/5 p-4 shadow-lg">
                  <p className="text-xs text-ocean/40 font-medium uppercase tracking-wider">Kunden-Ergebnis</p>
                  <p className="text-2xl font-light text-ocean mt-1">+1.251%</p>
                  <p className="text-xs text-ocean/40">Reichweite in 30 Tagen</p>
                </div>
                {/* Floating stat card 2 */}
                <div className="absolute -right-4 top-16 rounded-2xl bg-white/95 backdrop-blur-sm border border-ocean/5 p-4 shadow-lg">
                  <p className="text-xs text-ocean/40 font-medium uppercase tracking-wider">Kunden-Ergebnis</p>
                  <p className="text-2xl font-light text-ocean mt-1">90K → 150K</p>
                  <p className="text-xs text-ocean/40">Follower-Wachstum</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* SOCIAL PROOF — Results strip */}
      {/* ════════════════════════════════════════════════ */}
      {showForm && (
        <section className="py-12 bg-white border-y border-ocean/5">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <p className="text-center text-xs font-medium tracking-[0.2em] text-ocean/30 uppercase mb-8">
              Ergebnisse meiner Kunden
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
              {[
                { value: "607K+", label: "Accounts erreicht", sub: "in 30 Tagen" },
                { value: "+412%", label: "Impressionen", sub: "organisch" },
                { value: "150K", label: "Follower aufgebaut", sub: "für Kunden" },
                { value: "10M+", label: "Reichweite", sub: "pro Monat" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl md:text-4xl font-light text-ocean">{stat.value}</p>
                  <p className="text-sm font-medium text-ocean/50 mt-1">{stat.label}</p>
                  <p className="text-xs text-ocean/30">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ════════════════════════════════════════════════ */}
      {showForm && (
        <section className="py-16 md:py-20 bg-warm-white">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <p className="text-center text-xs font-medium tracking-[0.2em] text-ocean/30 uppercase mb-4">
              So funktioniert&apos;s
            </p>
            <h2 className="text-center text-3xl md:text-4xl font-light text-ocean mb-12">
              In 3 Schritten zu deiner Analyse
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Handle eingeben",
                  desc: "Gib deinen Instagram-Handle ein. Unsere KI analysiert dein Profil und deine letzten Reels.",
                },
                {
                  step: "02",
                  title: "Sofort-Ergebnis",
                  desc: "Du bekommst direkt eine visuelle Übersicht mit Score, Stärken und Quick-Wins.",
                },
                {
                  step: "03",
                  title: "Detaillierte PDF per Mail",
                  desc: "Die vollständige Analyse mit Content-Strategie und Wachstumsprognose kommt als PDF.",
                },
              ].map((item) => (
                <div key={item.step} className="relative rounded-2xl border border-ocean/5 bg-white p-6">
                  <span className="text-4xl font-light text-blush/40">{item.step}</span>
                  <h3 className="mt-3 text-lg font-medium text-ocean">{item.title}</h3>
                  <p className="mt-2 text-sm font-light text-ocean/50 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* FORM / PROGRESS / RESULT SECTION */}
      {/* ════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-white" id="scan">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">

          {/* Form */}
          {showForm && (
            <>
              <div className="text-center mb-10">
                <h2 className="text-3xl md:text-4xl font-light text-ocean">
                  Starte deinen Strategie-Scan
                </h2>
                <p className="mt-3 text-ocean/40 font-light">
                  Kostenlos. Keine Verpflichtungen. Ergebnis in unter 60 Sekunden.
                </p>
              </div>

              <form ref={formRef} onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ocean/70 mb-1.5">Vorname</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
                      placeholder="Max"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ocean/70 mb-1.5">Nachname</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
                      placeholder="Mustermann"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ocean/70 mb-1.5">E-Mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
                    placeholder="max@beispiel.de"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ocean/70 mb-1.5">Instagram Handle</label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
                    placeholder="@dein.handle"
                  />
                </div>

                {error && (
                  <p className="text-sm text-ivory font-medium">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full rounded-full bg-ocean px-8 py-4 text-white font-medium tracking-wide hover:bg-ocean-light transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20"
                >
                  Kostenlosen Strategie-Scan starten
                </button>

                <p className="text-center text-xs text-ocean/25 font-light pt-1">
                  Kein Spam. Deine Daten werden nur für den Scan verwendet.
                </p>
              </form>
            </>
          )}

          {/* Progress */}
          {showProgress && (
            <div className="mx-auto max-w-md">
              <div className="rounded-2xl border border-ocean/5 bg-warm-white p-8 space-y-5">
                {profile && (
                  <div className="flex items-center gap-4 pb-5 border-b border-ocean/5">
                    {profile.profilePicUrl && (
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl)}`}
                        alt={profile.username}
                        className="h-12 w-12 rounded-full object-cover border border-ocean/10"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-ocean">@{profile.username}</p>
                      <p className="text-xs text-ocean/40">{profile.followers?.toLocaleString()} Follower</p>
                    </div>
                  </div>
                )}
                {STEPS.map((step) => (
                  <ProgressStep
                    key={step.phase}
                    label={step.label}
                    status={getStepStatus(step.phase)}
                  />
                ))}
                <p className="text-xs text-ocean/30 text-center pt-2">
                  Das dauert ca. 30–60 Sekunden…
                </p>
              </div>
            </div>
          )}

          {/* Result */}
          {showResult && (
            <div className="mx-auto max-w-2xl space-y-6">
              {/* Profile header + Score */}
              <div className="rounded-2xl border border-ocean/5 bg-warm-white p-6 md:p-8">
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {profile?.profilePicUrl && (
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl)}`}
                        alt={profile.username}
                        className="h-16 w-16 shrink-0 rounded-full object-cover border-2 border-blush/40"
                      />
                    )}
                    <div className="min-w-0">
                      <h2 className="text-xl font-light text-ocean truncate">@{profile?.username}</h2>
                      <p className="text-sm text-ocean/40">Dein Strategie-Scan</p>
                    </div>
                  </div>
                  <ScoreRing score={summary.score} label={summary.scoreLabel} />
                </div>

                {profile && (
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="rounded-xl bg-white p-4 text-center">
                      <p className="text-2xl font-light text-ocean">{profile.followers?.toLocaleString()}</p>
                      <p className="text-xs text-ocean/40 mt-1">Follower</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 text-center">
                      <p className="text-2xl font-light text-ocean">{profile.reelsCount30d}</p>
                      <p className="text-xs text-ocean/40 mt-1">Reels (30 Tage)</p>
                    </div>
                    <div className="rounded-xl bg-white p-4 text-center">
                      <p className="text-2xl font-light text-ocean">{profile.avgViews30d?.toLocaleString()}</p>
                      <p className="text-xs text-ocean/40 mt-1">Ø Views</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary text */}
              <div className="rounded-2xl border border-ocean/5 bg-warm-white p-6 md:p-8">
                <p className="text-ocean/60 font-light leading-relaxed">{summary.summary}</p>
              </div>

              {/* Three section cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SectionCard
                  title="Stärken"
                  items={summary.strengths}
                  accentColor="bg-green-50"
                  icon={<svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <SectionCard
                  title="Verbesserungen"
                  items={summary.improvements}
                  accentColor="bg-amber-50"
                  icon={<svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
                />
                <SectionCard
                  title="Sofort-Tipps"
                  items={summary.quickWins}
                  accentColor="bg-sky-50"
                  icon={<svg className="h-5 w-5 text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
                />
              </div>

              {/* Email confirmation */}
              <div className="rounded-2xl border border-ocean/5 bg-warm-white p-5 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-ocean">
                    Vollständige Analyse kommt per Mail
                  </p>
                  <p className="text-xs text-ocean/40 mt-0.5">
                    Die ausführliche PDF-Analyse wird in 1–2 Minuten an {email} gesendet.
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-2xl bg-ocean p-8 md:p-10 text-center">
                <h3 className="text-2xl md:text-3xl font-light text-white tracking-tight">
                  Willst du diese Tipps umsetzen?
                </h3>
                <p className="mt-3 text-white/40 font-light max-w-md mx-auto">
                  Lass uns gemeinsam eine Content-Strategie bauen, die zu dir und deiner Marke passt.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href="#"
                    className="rounded-full bg-white px-8 py-4 text-ocean font-medium tracking-wide hover:bg-blush-light transition-colors duration-300"
                  >
                    Kostenloses Strategiegespräch
                  </a>
                  <button
                    onClick={handleReset}
                    className="rounded-full border border-white/15 px-8 py-4 text-white/70 font-medium tracking-wide hover:border-white/30 hover:text-white transition-all duration-300"
                  >
                    Neuen Scan starten
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════ */}
      {/* PROOF SECTION — Case Studies */}
      {/* ════════════════════════════════════════════════ */}
      {showForm && (
        <section className="py-16 md:py-20 bg-warm-white">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <p className="text-center text-xs font-medium tracking-[0.2em] text-ocean/30 uppercase mb-4">
              Echte Ergebnisse
            </p>
            <h2 className="text-center text-3xl md:text-4xl font-light text-ocean mb-12">
              Was meine Kunden erreichen
            </h2>

            {/* Case Study Cards */}
            <div className="space-y-6">

              {/* Case 1 — Ali: Follower Growth */}
              <div className="rounded-2xl border border-ocean/5 bg-white p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white text-lg font-medium">
                      A
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ocean">Ali D.</p>
                      <p className="text-xs text-ocean/40">Crypto & Business Creator</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-8">
                    <div className="text-center">
                      <p className="text-xs text-ocean/35 uppercase tracking-wider mb-1">Vorher</p>
                      <p className="text-2xl md:text-3xl font-light text-ocean/40">90K</p>
                    </div>
                    <svg className="h-5 w-5 text-blush shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <div className="text-center">
                      <p className="text-xs text-ocean/35 uppercase tracking-wider mb-1">Nachher</p>
                      <p className="text-2xl md:text-3xl font-light text-ocean">150K</p>
                    </div>
                    <div className="hidden sm:block rounded-full bg-green-50 px-3 py-1">
                      <p className="text-xs font-medium text-green-600">+67%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Case 2 — Amir: Reach */}
              <div className="rounded-2xl border border-ocean/5 bg-white p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                  <div className="flex items-center gap-4 flex-1">
                    <Image
                      src="/images/landing/client-amir.jpg"
                      alt="Amir"
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium text-ocean">Amir H.</p>
                      <p className="text-xs text-ocean/40">Immobilien & Lifestyle</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-8">
                    <div className="text-center">
                      <p className="text-xs text-ocean/35 uppercase tracking-wider mb-1">Vorher</p>
                      <p className="text-2xl md:text-3xl font-light text-ocean/40">44K</p>
                    </div>
                    <svg className="h-5 w-5 text-blush shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <div className="text-center">
                      <p className="text-xs text-ocean/35 uppercase tracking-wider mb-1">Nachher</p>
                      <p className="text-2xl md:text-3xl font-light text-ocean">607K</p>
                    </div>
                    <div className="hidden sm:block rounded-full bg-green-50 px-3 py-1">
                      <p className="text-xs font-medium text-green-600">+1.251%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Case 3 — Ammar: Impressions */}
              <div className="rounded-2xl border border-ocean/5 bg-white p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                  <div className="flex items-center gap-4 flex-1">
                    <Image
                      src="/images/landing/client-ammar.jpg"
                      alt="Ammar"
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-medium text-ocean">Ammar A.</p>
                      <p className="text-xs text-ocean/40">Unternehmer & Recruiting</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-8">
                    <div className="text-center">
                      <p className="text-xs text-ocean/35 uppercase tracking-wider mb-1">Vorher</p>
                      <p className="text-2xl md:text-3xl font-light text-ocean/40">182K</p>
                    </div>
                    <svg className="h-5 w-5 text-blush shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                    <div className="text-center">
                      <p className="text-xs text-ocean/35 uppercase tracking-wider mb-1">Nachher</p>
                      <p className="text-2xl md:text-3xl font-light text-ocean">931K</p>
                    </div>
                    <div className="hidden sm:block rounded-full bg-green-50 px-3 py-1">
                      <p className="text-xs font-medium text-green-600">+412%</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* ABOUT — Personal credibility */}
      {/* ════════════════════════════════════════════════ */}
      {showForm && (
        <section className="py-16 md:py-20 bg-white">
          <div className="mx-auto max-w-4xl px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-10 items-center">
              <div className="md:col-span-2 flex justify-center">
                <Image
                  src="/images/landing/aysun-hero.jpg"
                  alt="Aysun Caliskan"
                  width={320}
                  height={480}
                  className="rounded-2xl object-cover shadow-lg shadow-ocean/5"
                />
              </div>
              <div className="md:col-span-3">
                <p className="text-xs font-medium tracking-[0.2em] text-ocean/30 uppercase mb-4">
                  Über mich
                </p>
                <h2 className="text-2xl md:text-3xl font-light text-ocean mb-4">
                  Hi, ich bin Aysun.
                </h2>
                <p className="text-ocean/50 font-light leading-relaxed mb-4">
                  Ich helfe Selbständigen und Marken, auf Instagram sichtbar zu werden — mit einer klaren
                  Strategie statt zufälligem Posten. Meine Kunden erzielen regelmäßig sechsstellige
                  Reichweiten und gewinnen Traumkunden über organischen Content.
                </p>
                <p className="text-ocean/50 font-light leading-relaxed mb-6">
                  Dieser kostenlose Strategie-Scan gibt dir einen ehrlichen Blick auf dein Profil —
                  basierend auf echten Daten, nicht auf Bauchgefühl.
                </p>
                <button
                  onClick={scrollToForm}
                  className="rounded-full bg-ocean px-8 py-3.5 text-white font-medium tracking-wide hover:bg-ocean-light transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20 text-sm"
                >
                  Jetzt kostenlos analysieren
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════ */}
      {/* FINAL CTA */}
      {/* ════════════════════════════════════════════════ */}
      {showForm && (
        <section className="py-16 md:py-24 bg-ocean">
          <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-light text-white tracking-tight">
              Bereit herauszufinden, was möglich ist?
            </h2>
            <p className="mt-4 text-white/35 font-light max-w-lg mx-auto">
              Über 100 Profile bereits analysiert. Kostenlos, unverbindlich, datenbasiert.
            </p>
            <button
              onClick={scrollToForm}
              className="mt-8 rounded-full bg-white px-10 py-4 text-ocean font-medium tracking-wide hover:bg-blush-light transition-colors duration-300"
            >
              Strategie-Scan starten
            </button>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-ocean/5 bg-warm-white">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <p className="text-xs text-ocean/30 font-light">
            &copy; {new Date().getFullYear()} SUNXCA
          </p>
        </div>
      </footer>
    </div>
  );
}
