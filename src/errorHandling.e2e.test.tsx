// src/errorHandling.e2e.test.tsx
//
// Task 18 — Graceful error-handling wiring (end-to-end).
//
// A consolidated end-to-end suite that proves each row of the design "Error
// Handling" table is wired so the app stays usable and never crashes. Each
// describe block maps to one failure path:
//
//   1. Missing API key            → App shell + ConfigIncomplete, no map, no init (Req 17.4)
//   2. Tile provider failure/15s  → ErrorMessage, app + controls interactive     (Req 1.6, 18.1, 18.5)
//   3. Malformed GeoJSON source   → skip malformed, project remaining, no throw   (Req 18.2)
//   4. Empty flood data layer     → well-formed empty FeatureCollection, no error (Req 18.3)
//   5. Geolocation denied/        → correct message, control stays interactive    (Req 6.3, 6.4,
//      unavailable/20s timeout                                                       6.5, 18.4)
//
// Everything runs under jsdom with injected fakes — no real WebGL map, no real
// navigator.geolocation, and no secrets. The fakes mirror the seams already
// exercised by App.test.tsx / MapView.test.tsx / geolocation.test.ts.

import { act } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import App from './App';
import { LocationControl } from './components/controls/LocationControl';
import { LOCATION_MESSAGES } from './components/controls/locationMessages';
import type { MapManagerLike } from './components/MapView';
import type { AppConfig } from './types/config';
import type { LocationResult } from './services/geolocation';

import {
  loadValidated,
  isValidSusceptibility,
  floodSusceptibilityLayer,
} from './layers/dataLayers';
import type { FloodSusceptibility } from './types/flood';

const KEY_PRESENT: AppConfig = { tileKey: 'test-key-123', hasTileKey: true, demoMode: false };
const KEY_ABSENT: AppConfig = { hasTileKey: false, demoMode: false };

/**
 * A fake MapManager that records init/destroy and exposes the callbacks passed
 * to init so a test can drive onTileFailure/onReady. getMap returns null so the
 * real susceptibility/popup integration stays skipped under jsdom.
 */
function makeFakeManager() {
  const init = vi.fn();
  const destroy = vi.fn();
  const manager: MapManagerLike = {
    init,
    destroy,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    recenter: vi.fn(),
    getMap: vi.fn(() => null),
  };
  return { manager, init, destroy };
}

/** Reads the onTileFailure callback the MapView handed to the fake init. */
function tileFailureCallback(init: ReturnType<typeof vi.fn>) {
  const options = init.mock.calls[0][0];
  return options.onTileFailure as (reason: 'timeout' | 'error') => void;
}

// ---------------------------------------------------------------------------
// Row 1 — Missing API key at startup (Req 17.4)
// ---------------------------------------------------------------------------
describe('Error Handling — missing API key (Req 17.4)', () => {
  it('renders the shell + ConfigIncomplete, mounts no map, and never calls init', () => {
    const { manager, init } = makeFakeManager();

    expect(() =>
      render(
        <App
          config={KEY_ABSENT}
          mapViewProps={{ createMapManager: () => manager }}
        />,
      ),
    ).not.toThrow();

    // Shell still renders.
    expect(
      screen.getByRole('heading', { name: /baharoute/i }),
    ).toBeInTheDocument();

    // Config-incomplete alert is shown.
    const alert = screen.getByTestId('config-incomplete');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('role', 'alert');

    // No map container is mounted → no tile request is made.
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
    expect(init).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Row 2 — Tile provider fails / 15s timeout (Req 1.6, 18.1, 18.5)
// ---------------------------------------------------------------------------
describe('Error Handling — tile provider failure / timeout (Req 1.6, 18.1, 18.5)', () => {
  it('shows the ErrorMessage on a timeout while the app + controls stay interactive', () => {
    const { manager, init } = makeFakeManager();

    render(
      <App
        config={KEY_PRESENT}
        mapViewProps={{ createMapManager: () => manager }}
      />,
    );

    // The map mounted and init ran; loading is showing before failure.
    expect(init).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Fire the watchdog timeout the way MapManager would.
    const onTileFailure = tileFailureCallback(init);
    act(() => onTileFailure('timeout'));

    // Error is announced, loading dismissed, and the app stays interactive:
    // container + control cluster remain present.
    const error = screen.getByTestId('error-message');
    expect(error).toBeInTheDocument();
    expect(error).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('map-controls')).toBeInTheDocument();
  });

  it('shows the ErrorMessage on a provider error and does not crash', () => {
    const { manager, init } = makeFakeManager();

    render(
      <App
        config={KEY_PRESENT}
        mapViewProps={{ createMapManager: () => manager }}
      />,
    );

    const onTileFailure = tileFailureCallback(init);
    expect(() => act(() => onTileFailure('error'))).not.toThrow();

    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByTestId('map-controls')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Row 3 — Malformed GeoJSON source (Req 18.2)
// ---------------------------------------------------------------------------
describe('Error Handling — malformed GeoJSON source (Req 18.2)', () => {
  it('skips malformed items, keeps the valid ones, counts skipped, and never throws', () => {
    // A fixture list mixing valid susceptibility polygons with malformed items.
    const validItem: FloodSusceptibility = {
      id: 'sus-good',
      level: 'HIGH',
      geometry: { type: 'Polygon', coordinates: [[[121, 14.5], [121.1, 14.5], [121.1, 14.6], [121, 14.5]]] },
      metadata: {
        location: { lng: 121, lat: 14.5 },
        source: 'DEMO — e2e test',
        dataType: 'SUSCEPTIBILITY',
        updatedAt: 1_700_000_000,
        verificationStatus: 'UNCONFIRMED',
      },
    };
    const candidates: unknown[] = [
      validItem,
      // malformed: valid metadata but no geometry
      {
        id: 'sus-nogeo',
        level: 'LOW',
        metadata: {
          location: { lng: 121, lat: 14.5 },
          source: 'DEMO',
          dataType: 'SUSCEPTIBILITY',
          updatedAt: 1_700_000_000,
          verificationStatus: 'UNCONFIRMED',
        },
      },
      // malformed: not an object
      null,
      // malformed: missing all metadata
      { id: 'sus-empty' },
      // a second valid item
      { ...validItem, id: 'sus-good-2' },
    ];

    let result!: ReturnType<typeof loadValidated<FloodSusceptibility>>;
    expect(() => {
      result = loadValidated<FloodSusceptibility>(
        candidates,
        isValidSusceptibility,
        true,
      );
    }).not.toThrow();

    // Only the valid subset survives; the rest are counted as skipped.
    expect(result.items.map((s) => s.id)).toEqual(['sus-good', 'sus-good-2']);
    expect(result.skipped).toBe(3);
    expect(result.items.length + result.skipped).toBe(candidates.length);

    // Projecting the surviving items yields a valid FeatureCollection.
    const gj = floodSusceptibilityLayer.toGeoJSON(result.items);
    expect(gj.type).toBe('FeatureCollection');
    expect(gj.features).toHaveLength(2);
    for (const feature of gj.features) {
      expect(feature.type).toBe('Feature');
      expect(feature.geometry).toBeTruthy();
    }
  });

  it('never throws even when EVERY item is malformed', () => {
    const allBad: unknown[] = [null, undefined, 7, 'x', {}, { metadata: {} }];
    let result!: ReturnType<typeof loadValidated<FloodSusceptibility>>;
    expect(() => {
      result = loadValidated<FloodSusceptibility>(
        allBad,
        isValidSusceptibility,
        true,
      );
    }).not.toThrow();
    expect(result.items).toHaveLength(0);
    expect(result.skipped).toBe(allBad.length);

    // toGeoJSON over the (empty) survivors is still a well-formed collection.
    const gj = floodSusceptibilityLayer.toGeoJSON(result.items);
    expect(gj).toEqual({ type: 'FeatureCollection', features: [] });
  });
});

// ---------------------------------------------------------------------------
// Row 4 — Empty flood data layer (Req 18.3)
// ---------------------------------------------------------------------------
describe('Error Handling — empty flood data layer (Req 18.3)', () => {
  it('toGeoJSON([]) returns a well-formed empty FeatureCollection with no throw', () => {
    let gj!: GeoJSON.FeatureCollection;
    expect(() => {
      gj = floodSusceptibilityLayer.toGeoJSON([]);
    }).not.toThrow();
    expect(gj).toEqual({ type: 'FeatureCollection', features: [] });
    expect(gj.type).toBe('FeatureCollection');
    expect(Array.isArray(gj.features)).toBe(true);
    expect(gj.features).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Row 5 — Geolocation denied / unavailable / 20s timeout (Req 6.3, 6.4, 6.5, 18.4)
// ---------------------------------------------------------------------------
describe('Error Handling — geolocation failures keep the map interactive (Req 6.3, 6.4, 6.5, 18.4)', () => {
  const cases: Array<{
    status: Exclude<LocationResult['status'], 'granted'>;
    message: string;
    label: string;
  }> = [
    { status: 'denied', message: LOCATION_MESSAGES.denied, label: 'permission denied' },
    { status: 'unavailable', message: LOCATION_MESSAGES.unavailable, label: 'unavailable' },
    { status: 'timeout', message: LOCATION_MESSAGES.timeout, label: '20s timeout' },
  ];

  it.each(cases)(
    'shows the correct message and keeps the button enabled on $label',
    async ({ status, message }) => {
      const requestLocation = vi.fn(
        async (): Promise<LocationResult> => ({ status }),
      );
      const user = userEvent.setup();

      render(<LocationControl requestLocation={requestLocation} />);

      const button = screen.getByRole('button', { name: /show my location/i });
      // Activating must not throw.
      await user.click(button);

      // The correct status message renders in an alert region.
      const msg = await screen.findByTestId('location-message');
      expect(msg).toHaveTextContent(message);
      expect(msg).toHaveAttribute('role', 'alert');

      // The control (and therefore the map) stays interactive: the button is
      // still enabled after the failure.
      expect(button).toBeEnabled();
      expect(requestLocation).toHaveBeenCalledTimes(1);
    },
  );

  it('does not surface any banned safety language in the messages', () => {
    const banned = /\b(safe|clear|no risk)\b/i;
    for (const { message } of cases) {
      expect(message).not.toMatch(banned);
    }
  });
});
