function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex h-20 items-center justify-between px-6 lg:px-8 bg-white/80 backdrop-blur-xl border-b border-blush/20">
      <a href="/" className="text-2xl font-light tracking-[0.3em] uppercase text-ocean">
        Sun<span className="text-ivory">x</span>ca
      </a>
    </nav>
  );
}

export default function LandingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <LandingNav />
      <main className="min-h-screen pt-20">
        {children}
      </main>
    </>
  );
}
