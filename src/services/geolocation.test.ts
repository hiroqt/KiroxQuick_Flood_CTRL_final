// src/services/geolocation.test.ts
//
// Verifies the geolocation service maps every outcome to the correct
// discriminated result, never throws, treats a missing source as unavailable,
// and honors the 20s timeout — all with an injected fake source so nothing
// depends on a real navigator.geolocation under jsdom (Req 6.2–6.5, 18.4).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GEOLOCATION_TIMEOUT_MS,
  requestLocation,
  type GeolocationSource,
} from './geolocation';

/** Builds a fake position with the given coordinates. */
function fakePosition(lng: number, lat: number): GeolocationPosition {
  return {
    coords: {
      longitude: lng,
      latitude: lat,
      accuracy: 1,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  } as GeolocationPosition;
}

/** A source that immediately reports success with the given coordinates. */
function grantingSource(lng: number, lat: number): GeolocationSource {
  return {
    getCurrentPosition: (success) => success(fakePosition(lng, lat)),
  };
}

/** A source that immediately reports an error with the given code. */
function erroringSource(code: number): GeolocationSource {
  return {
    getCurrentPosition: (_success, error) =>
      error?.({ code } as GeolocationPositionError),
  };
}

describe('requestLocation', () => {
  it('returns granted with coordinates on success (Req 6.2)', async () => {
    const result = await requestLocation({
      source: grantingSource(121.0, 14.6),
    });
    expect(result).toEqual({ status: 'granted', lng: 121.0, lat: 14.6 });
  });

  it('maps PERMISSION_DENIED (code 1) to denied (Req 6.3)', async () => {
    const result = await requestLocation({ source: erroringSource(1) });
    expect(result).toEqual({ status: 'denied' });
  });

  it('maps POSITION_UNAVAILABLE (code 2) to unavailable (Req 6.4)', async () => {
    const result = await requestLocation({ source: erroringSource(2) });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('maps TIMEOUT (code 3) to timeout (Req 6.5)', async () => {
    const result = await requestLocation({ source: erroringSource(3) });
    expect(result).toEqual({ status: 'timeout' });
  });

  it('returns unavailable when no source is provided and navigator lacks geolocation (Req 6.4)', async () => {
    // jsdom's navigator has no geolocation, so the default source resolves to
    // undefined → unavailable.
    const result = await requestLocation({ source: undefined });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('returns unavailable when the source object lacks getCurrentPosition', async () => {
    const result = await requestLocation({
      source: {} as GeolocationSource,
    });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('never throws even when the source throws synchronously', async () => {
    const throwingSource: GeolocationSource = {
      getCurrentPosition: () => {
        throw new Error('boom');
      },
    };
    await expect(
      requestLocation({ source: throwingSource }),
    ).resolves.toEqual({ status: 'unavailable' });
  });

  describe('timeout path (Req 6.5)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns timeout when the source never calls back within the window', async () => {
      // A source that never invokes any callback.
      const silentSource: GeolocationSource = {
        getCurrentPosition: () => undefined,
      };

      const promise = requestLocation({ source: silentSource });
      // Nothing has resolved before the window elapses.
      await vi.advanceTimersByTimeAsync(GEOLOCATION_TIMEOUT_MS - 1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toEqual({ status: 'timeout' });
    });

    it('honors a custom timeoutMs', async () => {
      const silentSource: GeolocationSource = {
        getCurrentPosition: () => undefined,
      };
      const promise = requestLocation({
        source: silentSource,
        timeoutMs: 5_000,
      });
      await vi.advanceTimersByTimeAsync(5_000);
      await expect(promise).resolves.toEqual({ status: 'timeout' });
    });

    it('resolves with the success result and does not later time out', async () => {
      const promise = requestLocation({
        source: grantingSource(121.0, 14.6),
      });
      await expect(promise).resolves.toEqual({
        status: 'granted',
        lng: 121.0,
        lat: 14.6,
      });
      // Advancing past the timeout must not change or re-settle the result.
      await vi.advanceTimersByTimeAsync(GEOLOCATION_TIMEOUT_MS + 1);
      await expect(promise).resolves.toEqual({
        status: 'granted',
        lng: 121.0,
        lat: 14.6,
      });
    });
  });
});
