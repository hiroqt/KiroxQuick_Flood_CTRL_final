import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom does not implement URL.createObjectURL / revokeObjectURL. Importing
// mapbox-gl runs module-level init that references createObjectURL to set up
// its web worker, which would throw under jsdom. These no-op shims let modules
// that statically import mapbox-gl (e.g. MapManager, mapboxMarkerFactory) load
// in tests; the unit tests never construct a real WebGL map (they inject a fake
// map factory) so no real WebGL is required.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:baharoute-test';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => undefined;
}

// jsdom does not implement matchMedia; mapbox-gl touches it during module init
// on some paths. A minimal no-match stub keeps a static `import 'mapbox-gl'`
// from throwing under jsdom. Kept intentionally minimal (no real media query
// evaluation) since tests never render a real map.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Ensure the DOM is reset between tests to avoid cross-test leakage.
afterEach(() => {
  cleanup();
});
