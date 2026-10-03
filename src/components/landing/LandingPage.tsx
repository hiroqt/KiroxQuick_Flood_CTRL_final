import { lazy, Suspense, useEffect, useState } from 'react';
import floodCtrlLogo from '../../assets/flood-ctrl-logo.png';
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
    <main className="landing-page h-dvh overflow-y-auto bg-[#eef4fc] text-[#0f2d52] selection:bg-[#cfe0fb]">
      <div className="mx-auto flex min-h-dvh max-w-[1600px] flex-col px-6 md:px-12 lg:px-20">
        <header className="flex items-center justify-between border-b border-[#d4e0f0] py-6 md:py-7">
          <a
            href="/"
            aria-label="Flood-CTRL home"
            className="flex items-center"
          >
            <img
              src={floodCtrlLogo}
              alt="Flood-CTRL"
              className="h-8 w-auto md:h-9"
            />
          </a>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-[#5b6b82] md:block">
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
            <div className="mb-7 flex md:mb-8 items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#2f6fd0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1a73e8]" />
              Made for Metro Manila
            </div>
            <h1
              id="hero-title"
              className="text-[clamp(42px,5.3vw,78px)] font-medium leading-[1.16] tracking-[-0.045em]"
            >
              <span className="block">Know the flood.</span>{' '}
              <span className="block">Find your</span>{' '}
              <span className="block tracking-normal text-[#1a73e8]">way forward.</span>
            </h1>
            <p className="mt-7 md:mt-8 max-w-[335px] text-[15px] leading-[1.75] text-[#4f6079]">
              See flood risks. Compare routes.
              <br />
              Make a more informed trip across NCR.
            </p>
            <button
              onClick={start}
              disabled={assembling}
              className="mt-6 md:mt-8 flex min-h-14 items-center justify-between gap-12 rounded-sm bg-[#0f2d52] px-6 text-sm font-medium text-[#eef4fc] transition-colors hover:bg-[#1a56db] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1a73e8] disabled:cursor-wait disabled:opacity-60"
            >
              {assembling ? 'Putting NCR together…' : 'Explore the flood map'}
              <Arrow />
            </button>
            <p className="mt-4 font-mono text-[10px] tracking-wide text-[#6b7a90]">
              17 cities & municipalities. One clearer picture.
            </p>
            <div className="mt-6 md:mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#d4e0f0] pt-5 text-[11px] text-[#44557a]">
              <span>01 / Flood insights</span>
              <span>02 / Route comparison</span>
            </div>
          </div>
          <figure
            className="relative m-0 h-[300px] min-w-0 md:h-[min(66vh,680px)]"
            aria-label="An interactive three-dimensional model of Metro Manila with city boundaries and an illustrative travel route"
          >
            <div className="absolute left-5 top-0 z-10 font-mono text-[9px] uppercase tracking-[0.16em] text-[#6b7a90]">
              National Capital Region{' '}
              <span className="ml-4 text-[#9aabc4]">14.60° N / 121.03° E</span>
            </div>
            <div
              className={
                assembling ? 'landing-assembly fixed inset-0 z-50 bg-[#eef4fc]' : 'absolute inset-0'
              }
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center font-mono text-xs text-[#2f6fd0]">
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
            <span className="pointer-events-none absolute right-3 top-14 font-mono text-[10px] text-[#2f6fd0]">
              N ↑
            </span>
            <span className="pointer-events-none absolute bottom-[30%] left-3 -rotate-90 font-mono text-[9px] uppercase tracking-[0.25em] text-[#7f90aa]">
              Manila Bay
            </span>
            <figcaption className="absolute bottom-0 left-5 right-3 flex items-end justify-between border-t border-[#d4e0f0] pt-4 text-[10px] text-[#5b6b82]">
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 bg-[#1a73e8]" />
                Illustrative route
              </span>
              <span className="text-right font-mono text-[9px]">
                NCR / 3D PREVIEW
                <br />
                <span className="text-[#9aabc4]">Move your cursor to look around</span>
              </span>
            </figcaption>
          </figure>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d4e0f0] py-5 text-[10px] text-[#6b7a90]">
          <span>A little awareness goes a long way.</span>
          <span>Decision support. Always check local advisories.</span>
          <span className="font-mono">FLOOD-CTRL / NCR</span>
        </footer>
      </div>
    </main>
  );
}
