import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { LandingPage } from './components/landing/LandingPage';
const MapApp = lazy(() => import('./App'));

export function Website() {
  const [showMap, setShowMap] = useState(() => window.location.hash === '#map');
  useEffect(() => {
    const sync = () => setShowMap(window.location.hash === '#map');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const enter = useCallback(() => {
    window.location.hash = 'map';
    setShowMap(true);
  }, []);
  if (!showMap) return <LandingPage onEnter={enter} />;
  return (
    <div className="map-page">
      <Suspense
        fallback={
          <div
            className="flex h-dvh items-center justify-center bg-[#f5f4ed] text-[#243d33]"
            role="status"
          >
            Opening BahaRoute…
          </div>
        }
      >
        <MapApp />
      </Suspense>
      <a
        href="/"
        className="map-home"
      >
        Home
      </a>
    </div>
  );
}
