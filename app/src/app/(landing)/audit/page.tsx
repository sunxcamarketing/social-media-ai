"use client";

import { useState, useRef, useCallback } from "react";

type Phase = "idle" | "scraping" | "reels" | "analyzing" | "done" | "error";

interface ProfileData {
  username: string;
  followers: number;
  reelsCount30d: number;
  avgViews30d: number;
  profilePicUrl: string;
}

const STEPS = [
  { phase: "scraping" as Phase, label: "Profil wird geladen…" },
  { phase: "reels" as Phase, label: "Videos werden analysiert…" },
  { phase: "analyzing" as Phase, label: "Verbesserungspotenziale werden ermittelt & Strategie wird erstellt…" },
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

export default function AuditPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [error, setError] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [report, setReport] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const phaseOrder: Phase[] = ["scraping", "reels", "analyzing", "done"];

  function getStepStatus(stepPhase: Phase): "waiting" | "active" | "done" {
    const currentIdx = phaseOrder.indexOf(phase);
    const stepIdx = phaseOrder.indexOf(stepPhase);
    if (currentIdx > stepIdx) return "done";
    if (currentIdx === stepIdx) return "active";
    return "waiting";
  }

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
    setReport("");

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
              setReport(data.report || "");
              if (data.profile) setProfile(data.profile);
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
    setReport("");
    setError("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setInstagram("");
  };

  const isLoading = phase === "scraping" || phase === "reels" || phase === "analyzing";
  const showForm = phase === "idle" || phase === "error";
  const showProgress = isLoading;
  const showReport = phase === "done" && report;

  return (
    <div className="relative overflow-hidden">
      {/* Gradient Orbs */}
      <div className="pointer-events-none absolute top-20 -left-40 h-[500px] w-[500px] rounded-full bg-blush/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-60 -right-32 h-[400px] w-[400px] rounded-full bg-wind/10 blur-[100px]" />

      {/* Hero + Form Section */}
      <section className="relative bg-warm-white py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          {/* Hero */}
          <div className="text-center mb-12 md:mb-16">
            <span className="section-label">KOSTENLOSER STRATEGIE-SCAN</span>
            <h1 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-ocean">
              Dein Instagram{" "}
              <span className="relative inline-block">
                Strategie-Scan
                <span className="absolute bottom-1 left-0 w-full h-3 bg-blush/40 -z-10" />
              </span>
            </h1>
            <p className="mt-6 text-lg md:text-xl font-light text-ocean/50 max-w-2xl mx-auto">
              Finde heraus, was dein Instagram-Profil zurückhält — und was du sofort ändern kannst, um mehr Reichweite zu bekommen.
            </p>
          </div>

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ocean/70 mb-1.5">Vorname</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-ocean/10 bg-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
                    placeholder="Max"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ocean/70 mb-1.5">Nachname</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-ocean/10 bg-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
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
                  className="w-full rounded-xl border border-ocean/10 bg-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
                  placeholder="max@beispiel.de"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ocean/70 mb-1.5">Instagram Handle</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className="w-full rounded-xl border border-ocean/10 bg-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
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
            </form>
          )}

          {/* Progress */}
          {showProgress && (
            <div className="mx-auto max-w-md">
              <div className="rounded-2xl border border-ocean/5 bg-white p-8 space-y-5">
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

          {/* Report */}
          {showReport && (
            <div className="mx-auto max-w-2xl space-y-8">
              {/* Profile header */}
              {profile && (
                <div className="rounded-2xl border border-ocean/5 bg-white p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    {profile.profilePicUrl && (
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl)}`}
                        alt={profile.username}
                        className="h-16 w-16 rounded-full object-cover border-2 border-blush/40"
                      />
                    )}
                    <div>
                      <h2 className="text-xl font-light text-ocean">@{profile.username}</h2>
                      <p className="text-sm text-ocean/40">Dein Strategie-Scan</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-xl bg-warm-white p-4 text-center">
                      <p className="text-2xl font-light text-ocean">{profile.followers?.toLocaleString()}</p>
                      <p className="text-xs text-ocean/40 mt-1">Follower</p>
                    </div>
                    <div className="rounded-xl bg-warm-white p-4 text-center">
                      <p className="text-2xl font-light text-ocean">{profile.reelsCount30d}</p>
                      <p className="text-xs text-ocean/40 mt-1">Reels (30 Tage)</p>
                    </div>
                    <div className="rounded-xl bg-warm-white p-4 text-center">
                      <p className="text-2xl font-light text-ocean">{profile.avgViews30d?.toLocaleString()}</p>
                      <p className="text-xs text-ocean/40 mt-1">Ø Views</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Report content */}
              <div className="rounded-2xl border border-ocean/5 bg-white p-6 md:p-8">
                <div className="prose prose-sm max-w-none
                  prose-headings:font-light prose-headings:tracking-tight prose-headings:text-ocean
                  prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h2:first:mt-0
                  prose-p:text-ocean/60 prose-p:font-light prose-p:leading-relaxed
                  prose-li:text-ocean/60 prose-li:font-light
                  prose-strong:text-ocean prose-strong:font-medium
                ">
                  {report.split("\n").map((line, i) => {
                    if (line.startsWith("## ")) {
                      return <h2 key={i}>{line.replace("## ", "")}</h2>;
                    }
                    if (line.startsWith("### ")) {
                      return <h3 key={i} className="text-base mt-4 mb-2">{line.replace("### ", "")}</h3>;
                    }
                    if (line.startsWith("- ") || line.startsWith("* ")) {
                      return (
                        <div key={i} className="flex gap-2 ml-1 mb-1">
                          <span className="text-blush-dark mt-0.5">•</span>
                          <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
                        </div>
                      );
                    }
                    if (/^\d+\.\s/.test(line)) {
                      const num = line.match(/^(\d+)\./)?.[1];
                      const text = line.replace(/^\d+\.\s*/, "");
                      return (
                        <div key={i} className="flex gap-2 ml-1 mb-1">
                          <span className="text-blush-dark font-medium">{num}.</span>
                          <span dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />
                        </div>
                      );
                    }
                    if (line.trim() === "") return <div key={i} className="h-2" />;
                    return <p key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") }} />;
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className="rounded-2xl bg-ocean p-8 md:p-10 text-center">
                <h3 className="text-2xl md:text-3xl font-light text-white tracking-tight">
                  Willst du mehr?
                </h3>
                <p className="mt-3 text-white/40 font-light max-w-md mx-auto">
                  Lass uns gemeinsam eine Content-Strategie bauen, die zu dir und deiner Marke passt.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href="#"
                    className="rounded-full bg-white px-8 py-4 text-ocean font-medium tracking-wide hover:bg-blush-light transition-colors duration-300"
                  >
                    Termin buchen
                  </a>
                  <button
                    onClick={handleReset}
                    className="rounded-full border border-white/15 px-8 py-4 text-white/70 font-medium tracking-wide hover:border-white/30 hover:text-white transition-all duration-300"
                  >
                    Neuen Strategie-Scan starten
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Trust Section */}
      {showForm && (
        <section className="py-16 md:py-20 bg-white">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: "📊", text: "100+ Profile analysiert" },
                { icon: "⚡", text: "In 30 Sekunden" },
                { icon: "🎯", text: "Konkrete Tipps" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 rounded-2xl border border-ocean/5 p-5 hover:border-blush/40 hover:shadow-lg hover:shadow-blush/5 transition-all duration-300">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-sm font-medium text-ocean/70">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-ocean/5">
        <div className="mx-auto max-w-3xl px-6 lg:px-8 text-center">
          <p className="text-xs text-ocean/30 font-light">
            © {new Date().getFullYear()} SUNXCA
          </p>
        </div>
      </footer>
    </div>
  );
}
