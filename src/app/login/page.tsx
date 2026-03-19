"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute top-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full bg-blush/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-150px] left-[-100px] w-[400px] h-[400px] rounded-full bg-wind/10 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative">
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
        <div className="bg-white rounded-2xl border border-ocean/5 p-8 md:p-10 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
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
                className="w-full rounded-xl border border-ocean/10 bg-warm-white px-5 py-3.5 text-ocean placeholder:text-ocean/25 focus:outline-none focus:border-blush transition-colors font-light"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-ivory text-sm font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ocean px-8 py-4 text-white font-medium tracking-wide hover:bg-ocean-light transition-all duration-300 hover:shadow-lg hover:shadow-ocean/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Anmelden..." : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
