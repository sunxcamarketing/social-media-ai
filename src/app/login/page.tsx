"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMagicSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-blush/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] left-[-100px] w-[400px] h-[400px] rounded-full bg-wind/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative animate-in-up">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-light tracking-[0.3em] uppercase text-ocean">
            Sun<span className="text-ivory">x</span>ca
          </h1>
          <p className="mt-3 text-ocean/50 font-light">
            Melde dich an, um fortzufahren
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-ocean/5 p-8 md:p-10 shadow-[0_4px_24px_-4px_rgba(32,35,69,0.06)]">
          {/* Mode Tabs */}
          <div className="flex mb-6 bg-warm-white rounded-xl p-1">
            <button
              onClick={() => { setMode("password"); setError(""); setMagicSent(false); }}
              className={`flex-1 py-2 text-sm rounded-lg transition-all duration-200 ${
                mode === "password"
                  ? "bg-white text-ocean font-medium shadow-sm"
                  : "text-ocean/50 hover:text-ocean/70"
              }`}
            >
              Passwort
            </button>
            <button
              onClick={() => { setMode("magic"); setError(""); setMagicSent(false); }}
              className={`flex-1 py-2 text-sm rounded-lg transition-all duration-200 ${
                mode === "magic"
                  ? "bg-white text-ocean font-medium shadow-sm"
                  : "text-ocean/50 hover:text-ocean/70"
              }`}
            >
              Magic Link
            </button>
          </div>

          {magicSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-blush-light/60 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-ocean" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-ocean font-medium mb-1">Check deine E-Mails</h3>
              <p className="text-ocean/50 text-sm font-light">
                Wir haben dir einen Login-Link an <strong className="text-ocean/70">{email}</strong> geschickt.
              </p>
              <button
                onClick={() => { setMagicSent(false); setEmail(""); }}
                className="mt-4 text-sm text-ocean/50 hover:text-ocean underline transition-colors"
              >
                Andere E-Mail verwenden
              </button>
            </div>
          ) : mode === "password" ? (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-ocean/70 mb-1.5"
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none transition-all duration-200 input-glow font-light"
                  placeholder="deine@email.de"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-ocean/70 mb-1.5"
                >
                  Passwort
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none transition-all duration-200 input-glow font-light"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-ivory text-sm font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-ocean px-8 py-4 text-white font-medium tracking-wide hover:bg-ocean-light transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20 disabled:opacity-50 disabled:cursor-not-allowed btn-press"
              >
                {loading ? "Anmelden..." : "Anmelden"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-5">
              <div>
                <label
                  htmlFor="magic-email"
                  className="block text-sm font-medium text-ocean/70 mb-1.5"
                >
                  E-Mail
                </label>
                <input
                  id="magic-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none transition-all duration-200 input-glow font-light"
                  placeholder="deine@email.de"
                />
              </div>

              {error && (
                <p className="text-ivory text-sm font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-ocean px-8 py-4 text-white font-medium tracking-wide hover:bg-ocean-light transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20 disabled:opacity-50 disabled:cursor-not-allowed btn-press"
              >
                {loading ? "Link wird gesendet..." : "Magic Link senden"}
              </button>

              <p className="text-center text-xs text-ocean/40 font-light">
                Du bekommst einen Login-Link per E-Mail — kein Passwort nötig.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
