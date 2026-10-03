import { lazy, Suspense, useEffect, useState } from 'react';
const NcrScene = lazy(() => import('./NcrScene').then((module) => ({ default: module.NcrScene })));

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h16m-6-6 6 6-6 6'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [assembling, setAssembling] = useState(false);
  useEffect(() => {
    if (!assembling) return;
    // Navigation remains available if WebGL is unsupported or the scene fails to load.
    const timer = window.setTimeout(
      onEnter,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 2400,
    );
    return () => window.clearTimeout(timer);
  }, [assembling, onEnter]);
  const start = () => setAssembling(true);
  return (
    <main className="landing-page h-dvh overflow-y-auto bg-[#f5f4ed] text-[#243d33] selection:bg-[#d5dfca]">
      <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col px-6 md:px-12 lg:px-20">
        <header className="flex items-center justify-between border-b border-[#d9dcd0] py-6 md:py-7">
          <a
            href="/"
            aria-label="BahaRoute home"
            className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-1px]"
          >
            <svg width="29" height="33" viewBox="0 0 29 33" fill="none" aria-hidden="true">
              <path
                d="M8 3v25h9a7 7 0 0 0 0-14H8m0 0h7a5.5 5.5 0 0 0 0-11H8"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path d="m3 29 22-25" stroke="#e96c3b" strokeWidth="3" />
            </svg>
            BahaRoute
          </a>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[#657465] md:block">
            Flood-aware journeys. Metro Manila.
          </span>
          <button
            onClick={start}
            disabled={assembling}
            className="flex min-h-11 items-center gap-3 text-xs font-medium disabled:opacity-50"
          >
            Open map <Arrow diagonal />
          </button>
        </header>
        <section
          className="grid flex-1 items-center gap-8 py-8 md:grid-cols-[0.95fr_1.05fr] md:gap-6 md:py-10 lg:gap-10"
          aria-labelledby="hero-title"
        >
          <div className="relative z-10 max-w-[570px]">
            <div className="mb-7 flex md:mb-8 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#66785f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e96c3b]" />
              Made for Metro Manila
            </div>
            <h1
              id="hero-title"
              className="text-[clamp(42px,5.3vw,78px)] font-medium leading-[1.16] tracking-[-0.045em]"
            >
              <span className="block">Know the flood.</span>{' '}
              <span className="block">Find your</span>{' '}
              <span className="block tracking-normal text-[#738866]">way forward.</span>
            </h1>
            <p className="mt-7 md:mt-8 max-w-[335px] text-[15px] leading-[1.75] text-[#687368]">
              See flood risks. Compare routes.
              <br />
              Make a more informed trip across NCR.
            </p>
            <button
              onClick={start}
              disabled={assembling}
              className="mt-6 md:mt-8 flex min-h-14 items-center justify-between gap-12 rounded-sm bg-[#243d33] px-6 text-sm font-medium text-[#f5f4ed] transition-colors hover:bg-[#385143] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#243d33] disabled:cursor-wait disabled:opacity-60"
            >
              {assembling ? 'Putting NCR together…' : 'Explore the flood map'}
              <Arrow />
            </button>
            <p className="mt-4 font-mono text-[10px] tracking-wide text-[#7c8274]">
              17 cities & municipalities. One clearer picture.
            </p>
            <div className="mt-6 md:mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#d9dcd0] pt-5 text-[11px] text-[#56664f]">
              <span>01 / Flood insights</span>
              <span>02 / Route comparison</span>
            </div>
          </div>
          <figure
            className="relative m-0 h-[300px] min-w-0 md:h-[min(66vh,680px)]"
            aria-label="An interactive three-dimensional model of Metro Manila with city boundaries and an illustrative travel route"
          >
            <div className="absolute left-5 top-0 z-10 font-mono text-[9px] uppercase tracking-[0.16em] text-[#7b8972]">
              National Capital Region{' '}
              <span className="ml-4 text-[#a2ab95]">14.60° N / 121.03° E</span>
            </div>
            <div
              className={
                assembling ? 'landing-assembly fixed inset-0 z-50 bg-[#f5f4ed]' : 'absolute inset-0'
              }
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center font-mono text-xs text-[#738866]">
                    Preparing Metro Manila…
                  </div>
                }
              >
                <NcrScene assembling={assembling} onComplete={onEnter} />
              </Suspense>
              {assembling && (
                <p
                  role="status"
                  className="absolute bottom-12 left-0 right-0 text-center font-mono text-xs uppercase tracking-[0.18em]"
                >
                  Connecting Metro Manila
                </p>
              )}
            </div>
            <span className="pointer-events-none absolute right-3 top-14 font-mono text-[10px] text-[#738866]">
              N ↑
            </span>
            <span className="pointer-events-none absolute bottom-[30%] left-3 -rotate-90 font-mono text-[9px] uppercase tracking-[0.25em] text-[#8b9582]">
              Manila Bay
            </span>
            <figcaption className="absolute bottom-0 left-5 right-3 flex items-end justify-between border-t border-[#d9dcd0] pt-4 text-[10px] text-[#73806b]">
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 bg-[#e96c3b]" />
                Illustrative route
              </span>
              <span className="text-right font-mono text-[9px]">
                NCR / 3D PREVIEW
                <br />
                <span className="text-[#959d89]">Move your cursor to look around</span>
              </span>
            </figcaption>
          </figure>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d9dcd0] py-5 text-[10px] text-[#7b8273]">
          <span>A little awareness goes a long way.</span>
          <span>Decision support. Always check local advisories.</span>
          <span className="font-mono">BAHAROUTE / NCR</span>
        </footer>
      </div>
    </main>
  );
}
