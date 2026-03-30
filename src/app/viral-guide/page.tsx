import {
  Search, FileText, Video, Scissors,
  Lightbulb, Zap, Eye, Clock, Star,
  Target, Sparkles, ChevronRight, ArrowRight,
  CheckCircle, AlertTriangle, Brain,
} from "lucide-react";

// ── Landing Page Tutorial — Viral Reel Guide by SUNXCA ──────────────────────

function SectionBadge({ number, color }: { number: number; color: string }) {
  return (
    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${color}`}>
      {number}
    </span>
  );
}

function TipCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#202345]/[0.06] bg-white p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F2C8D2]/30">
          <Icon className="h-4 w-4 text-[#D42E35]" />
        </div>
        <h4 className="text-[15px] font-semibold text-[#202345]">{title}</h4>
      </div>
      <div className="text-[13px] text-[#202345]/70 leading-relaxed">{children}</div>
    </div>
  );
}

function PrincipleItem({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#202345] text-white text-[11px] font-bold shrink-0 mt-0.5">
        {number}
      </span>
      <div>
        <div className="text-[14px] font-medium text-[#202345]">{title}</div>
        <div className="text-[13px] text-[#202345]/60 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

export default function ViralGuidePage() {
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#202345] via-[#2a2d55] to-[#202345]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />

        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-[#F2C8D2]" />
            <span className="text-[12px] font-medium text-white/80 tracking-wide uppercase">
              SUNXCA Framework
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Wie du ein virales Reel erstellst
            <br />
            <span className="text-[#F2C8D2]">in 4 Schritten</span>
          </h1>

          <p className="mt-6 text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            Kein Glück. Kein Zufall. Ein bewährtes System das jedes Mal funktioniert.
            Research → Script → Film → Edit.
          </p>

          <div className="flex justify-center gap-4 mt-10">
            <a href="#step-1" className="inline-flex items-center gap-2 rounded-full bg-[#D42E35] px-6 py-3 text-[14px] font-medium text-white hover:bg-[#b82530] transition-colors">
              Los geht&apos;s <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Key Insight Banner */}
      <div className="bg-[#202345] border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center gap-4">
          <Brain className="h-6 w-6 text-[#F2C8D2] shrink-0" />
          <p className="text-[14px] text-white/80 leading-relaxed">
            <strong className="text-white">Der Algorithmus optimiert für Watch Time.</strong>{" "}
            Nicht für Hashtags. Nicht für Posting-Zeiten. Nur dafür wie lange Leute dein Video schauen.
            Alles in diesem Framework zielt darauf ab.
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-24">

        {/* ── STEP 1: RESEARCH ─────────────────────────────────────────────── */}
        <section id="step-1">
          <div className="flex items-center gap-4 mb-8">
            <SectionBadge number={1} color="bg-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-[#202345]">Research</h2>
              <p className="text-[14px] text-[#202345]/60">Doom-Scrolling mit Intent</p>
            </div>
          </div>

          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-6 mb-8">
            <p className="text-[14px] text-blue-900 leading-relaxed">
              Du scrollst nicht einfach — du scrollst mit einer Mission. Öffne Instagram oder TikTok
              und geh auf die Explore/For You Page. Such gezielt nach Videos die in
              <strong> deiner Nische UND deinem Format</strong> viral gegangen sind.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <TipCard icon={Target} title="Outlier erkennen">
              Videos mit <strong>5.000–10.000+ Likes</strong> sind der Indikator. Aber check immer ob es ein
              Outlier für DIESEN Creator ist. 1M Views bei einem 68K-Follower-Account = massiver Outlier.
              100K Views bei 2M Followern = normal.
            </TipCard>

            <TipCard icon={Eye} title="Nische + Format = Match">
              Beides muss passen. Nicht nur ein virales Video in deiner Nische — auch das Format
              (Talking Head, Tutorial, etc.) muss zu dem passen was du selbst machst.
            </TipCard>
          </div>

          <div className="mt-6 rounded-2xl border border-[#202345]/[0.06] bg-white p-5">
            <h4 className="text-[13px] font-semibold text-[#202345] mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Woran du ein gutes Referenz-Video erkennst
            </h4>
            <ul className="space-y-2">
              {[
                "5.000+ Likes (je mehr desto besser)",
                "Überdurchschnittlich für diesen Creator",
                "Gleiche Nische wie deine",
                "Ähnliches Format wie deins",
                "Du verstehst WARUM es viral ging",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[13px] text-[#202345]/70">
                  <ChevronRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── STEP 2: SCRIPTING ────────────────────────────────────────────── */}
        <section id="step-2">
          <div className="flex items-center gap-4 mb-8">
            <SectionBadge number={2} color="bg-purple-600" />
            <div>
              <h2 className="text-2xl font-bold text-[#202345]">Scripting</h2>
              <p className="text-[14px] text-[#202345]/60">Copy → Adapt → Simplify</p>
            </div>
          </div>

          <div className="rounded-2xl bg-purple-50 border border-purple-200 p-6 mb-8">
            <p className="text-[14px] text-purple-900 leading-relaxed">
              Öffne ein Google Doc. Schreib die Sätze des Original-Videos Zeile für Zeile ab.
              Unter <strong>jeder Zeile</strong> schreibst du deine eigene Version — in deiner Nische, in deinen Worten.
              Du erfindest nichts neu. Du adaptierst was bewiesen funktioniert.
            </p>
          </div>

          {/* Hook Section */}
          <div className="rounded-2xl border-2 border-[#D42E35]/20 bg-[#D42E35]/[0.02] p-6 mb-6">
            <div className="flex items-center gap-2.5 mb-4">
              <Zap className="h-5 w-5 text-[#D42E35]" />
              <h3 className="text-[16px] font-bold text-[#202345]">Der Hook entscheidet ALLES</h3>
            </div>
            <div className="space-y-3 text-[13px] text-[#202345]/75 leading-relaxed">
              <p>
                Der erste Satz = Make or Break. Du hast weniger als eine Sekunde.
                Wenn der Hook nicht sitzt, ist alles danach egal.
              </p>
              <p>
                <strong>Regel:</strong> Der Hook muss die Wünsche und Desires deines idealen Zuschauers ansprechen.
                Jeder einzelne Satz im gesamten Skript muss auf den Hook zurückführen.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <TipCard icon={Star} title="5-Jährigen-Test">
              Dumb it down. Kein Fachjargon. Keine Fachbegriffe.
              Ein 5-Jähriger sollte es verstehen. Short Form = ein schneller Dopamin-Hit,
              nicht eine PhD-Dissertation. Kondensiere den Value so dass der Zuschauer
              EINE Sache versteht.
            </TipCard>

            <TipCard icon={Zap} title="Dopamin-Hits einbauen">
              Die meisten Leute speichern Content und wenden ihn nie an.
              Mach also dass sie sich FÜHLEN als würden sie Fortschritt machen.
              Index härter auf das Gefühl als auf die eigentliche Lehre.
              Ein Quick Win &gt; Deep Education.
            </TipCard>

            <TipCard icon={AlertTriangle} title="3 Gründe zum Wegwischen">
              <strong>1. Verwirrt</strong> — der Zuschauer versteht nicht was du sagst.{" "}
              <strong>2. Gelangweilt</strong> — du lieferst keinen neuen Value.{" "}
              <strong>3. Aufgehört zu glauben</strong> — du hast Glaubwürdigkeit verloren.
              Lies dein Skript laut vor und eliminiere jeden dieser Punkte.
            </TipCard>

            <TipCard icon={Lightbulb} title="Revision = Pflicht">
              Lies das GESAMTE Skript laut vor, Wort für Wort.
              Check den Flow — an keinem Punkt sollte es robotisch oder verwirrend klingen.
              Frag dich: &quot;Wenn ich ein Fremder wäre — würde ich hier wegwischen?&quot;
            </TipCard>
          </div>

          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-[13px] font-semibold text-purple-800">Psychologie dahinter</span>
            </div>
            <p className="text-[12px] text-purple-700/80 leading-relaxed">
              Denk kritisch darüber nach WARUM das Original viral ging. Empathisiere mit deinem Zuschauer.
              Wer ist dein Publikum? Was resoniert mit Anfängern? Jeder Satz muss neue Information liefern —
              es wird progressiv besser, nie schlechter.
            </p>
          </div>
        </section>

        {/* ── STEP 3: FILMING ──────────────────────────────────────────────── */}
        <section id="step-3">
          <div className="flex items-center gap-4 mb-8">
            <SectionBadge number={3} color="bg-green-600" />
            <div>
              <h2 className="text-2xl font-bold text-[#202345]">Filming</h2>
              <p className="text-[14px] text-[#202345]/60">iPhone + CapCut Teleprompter</p>
            </div>
          </div>

          <div className="rounded-2xl bg-green-50 border border-green-200 p-6 mb-8">
            <p className="text-[14px] text-green-900 leading-relaxed">
              Du brauchst <strong>kein fancy Equipment</strong>. Ein iPhone reicht. Stapel Bücher für den Desk-Shot.
              Die Energie die du mitbringst ist 100x wichtiger als die Kameraqualität.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <TipCard icon={Zap} title="Pre-Filming Ritual">
              Get into a high energy state. Energy Drink, Stretching, tiefe Atemzüge.
              Noise-Cancelling Kopfhörer mit Focus-Musik (Brain FM oder Meditations-Musik).
              Du musst bewusst vom Business-Brain ins charismatische-Kamera-Person-Brain switchen.
            </TipCard>

            <TipCard icon={Lightbulb} title="Teleprompter Hack (CapCut)">
              Skript kopieren → CapCut öffnen → Kamera → Kamera drehen →
              3 Minuten einstellen → Teleprompter. Skript einfügen. Das Ziel:
              Es soll NICHT so aussehen als würdest du ablesen.
              Natürliche Energie bringen, keine übertriebenen Worte.
            </TipCard>

            <TipCard icon={Star} title="Visualisiere eine Person">
              Stell dir vor dass jemand direkt vor dir sitzt. Der Zuschauer soll
              das Gefühl haben mit einem echten Menschen zu reden. Nicht steif.
              Nicht robotisch. Wie ein Gespräch mit einem Freund.
            </TipCard>

            <TipCard icon={Target} title="Fehler sind okay">
              Du musst es nicht in einem Take schaffen. Mach Fehler, film weiter.
              Alles wird in der Bearbeitung geschnitten.
              Perfektion ist der Feind von Done.
            </TipCard>
          </div>
        </section>

        {/* ── STEP 4: EDITING ──────────────────────────────────────────────── */}
        <section id="step-4">
          <div className="flex items-center gap-4 mb-8">
            <SectionBadge number={4} color="bg-orange-600" />
            <div>
              <h2 className="text-2xl font-bold text-[#202345]">Editing</h2>
              <p className="text-[14px] text-[#202345]/60">CapCut auf dem iPhone</p>
            </div>
          </div>

          <div className="rounded-2xl bg-orange-50 border border-orange-200 p-6 mb-8">
            <p className="text-[14px] text-orange-900 leading-relaxed">
              Der 4-Schritte Editing-Prozess: <strong>Rough Cut → B-Roll → Captions → Musik.</strong>{" "}
              Jeder Schritt hat seine eigenen Regeln. Hier steckt der größte Hebel.
            </p>
          </div>

          {/* 4-Part Process */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border border-[#202345]/[0.06] bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">1</span>
                <h4 className="text-[14px] font-semibold text-[#202345]">Rough Cut</h4>
              </div>
              <p className="text-[13px] text-[#202345]/70 leading-relaxed">
                Entferne ALLE Dead Space. Atempausen, Versprecher, Stille — alles raus.
                Selbst <strong>0,5 Sekunden</strong> Dead Space macht das Video langsamer.
                Split + Delete. Besonders wichtig für neue Creator.
              </p>
            </div>

            <div className="rounded-2xl border border-[#202345]/[0.06] bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">2</span>
                <h4 className="text-[14px] font-semibold text-[#202345]">B-Roll</h4>
              </div>
              <p className="text-[13px] text-[#202345]/70 leading-relaxed">
                Plan eine Shot-Liste vom Skript BEVOR du filmst. Jeder Satz = ein Visual.
                Frag: Was macht diesen Satz <strong>einfacher zu verstehen</strong>?
                Screen Recordings für Apps. Clips so kurz wie möglich: <strong>1-2 Sekunden</strong>.
                EIN Fokuspunkt pro Frame.
              </p>
            </div>

            <div className="rounded-2xl border border-[#202345]/[0.06] bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">3</span>
                <h4 className="text-[14px] font-semibold text-[#202345]">Auto Captions</h4>
              </div>
              <p className="text-[13px] text-[#202345]/70 leading-relaxed">
                TikTok Classic Font. Return drücken damit nur <strong>2 Wörter pro Zeile</strong> stehen.
                Augen müssen sichtbar bleiben — Text nicht übers Gesicht. Gelbe Captions wenn
                der Hintergrund Kontrast braucht.
              </p>
            </div>

            <div className="rounded-2xl border border-[#202345]/[0.06] bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">4</span>
                <h4 className="text-[14px] font-semibold text-[#202345]">Musik</h4>
              </div>
              <p className="text-[13px] text-[#202345]/70 leading-relaxed">
                <strong>Nur instrumental</strong> — keine Lyrics die mit deiner Stimme konkurrieren.
                Stimmung der Musik = Stimmung des Videos. In CapCut: Sounds → Device → Song suchen.
                Casual/Funny für ein lockeres Video.
              </p>
            </div>
          </div>

          {/* Advanced Editing Tips */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <TipCard icon={Sparkles} title="5% Intentionality Principle">
              5% mehr Intention pro Satz = potenziell <strong>10x mehr Views</strong>.
              Kleine Retention-Unterschiede kompoundieren massiv.
              Denk bei JEDEM Visual darüber nach warum es da ist.
              Warum genau dieses Bild? Warum genau hier?
            </TipCard>

            <TipCard icon={Star} title="Social Proof früh zeigen">
              Screenshots von View-Zahlen in den <strong>ersten paar Sekunden</strong>.
              Zuschneiden — nur die Zahlen zeigen, kein Clutter drumherum.
              Beweist dem Zuschauer sofort dass es sich lohnt dir zuzuhören.
            </TipCard>

            <TipCard icon={Clock} title="Speed = Value Perception">
              Langweilige Teile (Tippen, Scrollen) <strong>3-5x beschleunigen</strong>.
              Schnell wechselnde Visuals lassen Content wertvoller erscheinen.
              Der Zuschauer fühlt sich als bekommt er mehr für seine Zeit.
            </TipCard>

            <TipCard icon={Target} title="Export Settings">
              <strong>4K Auflösung. 30 fps. Empfohlene Bitrate.</strong>{" "}
              Kein AI Ultra HD verwenden. Caption/Beschreibung ist egal —
              keine Hashtags oder Posting-Zeiten nötig.
            </TipCard>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-4 w-4 text-orange-600" />
              <span className="text-[13px] font-semibold text-orange-800">B-Roll Philosophie im Detail</span>
            </div>
            <ul className="space-y-1.5 text-[12px] text-orange-700/80 leading-relaxed">
              <li className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                Plane eine Shot-Liste vom Skript BEVOR du B-Roll filmst
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                Jeder Satz = ein spezifisches Visual das den Satz EINFACHER macht
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                Screen Recordings für App/Prozess-Shots
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                Crop Overlays/Stickers für UI-Elemente — nicht die volle komplexe UI zeigen
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                Jeder B-Roll Clip: maximal 1-2 Sekunden
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                Visuelle Einfachheit — EIN Fokuspunkt pro Frame
              </li>
            </ul>
          </div>
        </section>

        {/* ── PSYCHOLOGICAL PRINCIPLES ─────────────────────────────────────── */}
        <section id="principles">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#202345]">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#202345]">10 Psychologische Prinzipien</h2>
              <p className="text-[14px] text-[#202345]/60">Die Regeln hinter viralem Content</p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#202345]/[0.06] bg-white p-8 space-y-5">
            <PrincipleItem
              number={1}
              title="Algorithmus = Watch Time"
              desc="Nicht Hashtags, nicht Posting-Zeiten. Der Algorithmus pushed Videos die die meiste Watch Time und Engagement bekommen. Punkt."
            />
            <PrincipleItem
              number={2}
              title="Proven > Original"
              desc="Kopiere bewährte virale Strukturen und passe sie an. Versuch nicht als Anfänger originell zu sein — das Rad nicht neu erfinden."
            />
            <PrincipleItem
              number={3}
              title="Empathize with Viewer"
              desc="Denk immer durch die Brille deines Zuschauers. Was würde SIE zum Wegwischen bringen? Was würde SIE begeistern?"
            />
            <PrincipleItem
              number={4}
              title="Visual Simplicity"
              desc="Jeder Frame hat EINEN Fokuspunkt. Den Bildschirm nicht mit Informationen überladen."
            />
            <PrincipleItem
              number={5}
              title="Progressive Value"
              desc="Jeder Satz liefert neue Information. Das Video wird progressiv besser — nie schlechter."
            />
            <PrincipleItem
              number={6}
              title="Dopamin-Hits"
              desc="Der Zuschauer soll das Gefühl haben zu gewinnen und Fortschritt zu machen — einfach nur durch Zuschauen."
            />
            <PrincipleItem
              number={7}
              title="Speed = Value Perception"
              desc="Schnell wechselnde Visuals lassen Content wertvoller erscheinen und machen ihn speichernswert."
            />
            <PrincipleItem
              number={8}
              title="Social Proof"
              desc="Zeig Ergebnisse und Zahlen früh im Video um sofort Glaubwürdigkeit aufzubauen."
            />
            <PrincipleItem
              number={9}
              title="One Quick Win"
              desc="Short Form ist nicht für Deep Education. Es geht um EIN Gefühl von Verständnis. Eine schnelle Erkenntnis."
            />
            <PrincipleItem
              number={10}
              title="5% Intentionality"
              desc="5% mehr Intention in jedem Satz und Visual kompoundiert zu massiven View-Unterschieden. 10x ist realistisch."
            />
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <section className="text-center py-12">
          <div className="rounded-2xl bg-gradient-to-br from-[#202345] to-[#2a2d55] p-10">
            <h2 className="text-2xl font-bold text-white mb-3">
              Bereit dein erstes virales Reel zu bauen?
            </h2>
            <p className="text-[14px] text-white/70 mb-8 max-w-lg mx-auto">
              Dieses Framework funktioniert. Nicht weil es kompliziert ist —
              sondern weil es auf Psychologie und bewährten Mustern basiert.
              Fang mit Step 1 an. Heute noch.
            </p>
            <a
              href="#step-1"
              className="inline-flex items-center gap-2 rounded-full bg-[#D42E35] px-6 py-3 text-[14px] font-medium text-white hover:bg-[#b82530] transition-colors"
            >
              Nochmal von vorne <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#202345]/[0.06] bg-white">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <p className="text-xl font-light tracking-[0.3em] uppercase text-[#202345]">
            SUN<span className="text-[#D42E35]">X</span>CA
          </p>
          <p className="text-[12px] text-[#202345]/50 mt-2">
            Social Media. Systematisch. Viral.
          </p>
        </div>
      </footer>
    </div>
  );
}
