import Link from "next/link";

export default function NoAccessPage() {
  return (
    <div className="min-h-screen bg-warm-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-light tracking-[0.3em] uppercase text-ocean mb-4">
          Sun<span className="text-ivory">x</span>ca
        </h1>
        <h2 className="text-lg text-ocean font-medium mb-2">Kein Zugriff</h2>
        <p className="text-ocean/50 font-light mb-6">
          Dein Account hat noch keinen Zugriff auf die Plattform. Bitte kontaktiere dein Team.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-ocean px-8 py-3 text-white font-medium tracking-wide hover:bg-ocean-light transition-all duration-300"
        >
          Zurück zum Login
        </Link>
      </div>
    </div>
  );
}
