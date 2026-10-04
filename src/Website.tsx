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
            className="flex h-dvh items-center justify-center bg-[#eef4fc] text-[#0f2d52]"
            role="status"
          >
            Opening Flood-CTRL…
          </div>
        }
      >
        <MapApp />
      </Suspense>
      <a href="/" className="map-home baharoute-focus-ring">
        Home
      </a>
    </div>
  );
}
