// src/services/geolocation.ts
//
// Geolocation service (design → Components table: LocationControl, Req 6; Error
// Handling table). Wraps the browser Geolocation API behind a small, typed,
// never-throwing function that returns a discriminated result. Two independent
// timers exist in the app; this file owns the 20s geolocation timeout (Req 6.5),
// separate from the 15s tile watchdog in MapManager.
//
// Testability: the geolocation source is dependency-injected (default
// `navigator.geolocation`) so tests can supply a fake without relying on a real
// `navigator.geolocation` under jsdom (which does not implement it).

/** How long to wait for a position before giving up (Req 6.5). */
export const GEOLOCATION_TIMEOUT_MS = 20_000;

/**
 * The discriminated outcome of a location request. `requestLocation` never
 * throws — every failure mode maps to one of these statuses (design → Error
 * Handling table, Req 6.3–6.5, 18.4).
 */
export type LocationResult =
  | { status: 'granted'; lng: number; lat: number }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'timeout' };

/**
 * The minimal subset of the browser `Geolocation` API this service uses. Kept
 * structurally typed so tests can inject a fake with only `getCurrentPosition`.
 */
export interface GeolocationSource {
  getCurrentPosition(
    success: (position: GeolocationPosition) => void,
    error?: (err: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): void;
}

/** Options for {@link requestLocation}. */
export interface RequestLocationOptions {
  /**
   * The geolocation source to use. Defaults to `navigator.geolocation` when
   * available. If the resolved source is undefined, the result is
   * `'unavailable'` (Req 6.4).
   */
  source?: GeolocationSource;
  /** Timeout in ms before returning `'timeout'` (Req 6.5). Default 20,000. */
  timeoutMs?: number;
  /** Request a high-accuracy fix from the device. Forwarded to the source. */
  enableHighAccuracy?: boolean;
}

/**
 * Resolves the default geolocation source: the browser's
 * `navigator.geolocation` when present, otherwise `undefined` (which the caller
 * maps to `'unavailable'`, Req 6.4). Reading it defensively means this never
 * throws in environments (like jsdom) where `navigator.geolocation` is missing.
 */
function resolveDefaultSource(): GeolocationSource | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const geo = (navigator as Navigator & { geolocation?: GeolocationSource })
    .geolocation;
  return geo ?? undefined;
}

/**
 * Requests the user's current position, returning a discriminated
 * {@link LocationResult}. Never throws and never rejects — all outcomes,
 * including permission denial, unavailability, and timeout, resolve to a status:
 *
 * - `granted` with `lng`/`lat` on success (Req 6.2).
 * - `denied` when the user denies permission (PERMISSION_DENIED, Req 6.3).
 * - `unavailable` when geolocation is missing or the position is unavailable
 *   (POSITION_UNAVAILABLE, Req 6.4).
 * - `timeout` when no fix arrives within `timeoutMs` (Req 6.5).
 *
 * A single internal timer guards the timeout so the promise always settles even
 * if the underlying source never invokes a callback. The first outcome wins;
 * later callbacks are ignored.
 */
export async function requestLocation(
  options: RequestLocationOptions = {},
): Promise<LocationResult> {
  const source = options.source ?? resolveDefaultSource();

  // Missing geolocation entirely → unavailable (Req 6.4). No timer started.
  if (!source || typeof source.getCurrentPosition !== 'function') {
    return { status: 'unavailable' };
  }

  const timeoutMs = options.timeoutMs ?? GEOLOCATION_TIMEOUT_MS;

  return new Promise<LocationResult>((resolve) => {
    let settled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const settle = (result: LocationResult): void => {
      if (settled) return;
      settled = true;
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      resolve(result);
    };

    // Own 20s timeout so we stop waiting even if the source never calls back
    // (Req 6.5). This is independent of any timeout the source may honor.
    timerId = setTimeout(() => settle({ status: 'timeout' }), timeoutMs);

    const onSuccess = (position: GeolocationPosition): void => {
      settle({
        status: 'granted',
        lng: position.coords.longitude,
        lat: position.coords.latitude,
      });
    };

    const onError = (err: GeolocationPositionError): void => {
      settle({ status: mapErrorCode(err) });
    };

    try {
      source.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        timeout: timeoutMs,
      });
    } catch {
      // A source that throws synchronously is treated as unavailable rather
      // than propagating — requestLocation never throws (Req 6.4, 18.4).
      settle({ status: 'unavailable' });
    }
  });
}

/**
 * Maps a `GeolocationPositionError.code` to a failure status:
 * PERMISSION_DENIED → `denied` (Req 6.3), TIMEOUT → `timeout` (Req 6.5), and
 * POSITION_UNAVAILABLE (or any other code) → `unavailable` (Req 6.4).
 */
function mapErrorCode(
  err: GeolocationPositionError,
): 'denied' | 'unavailable' | 'timeout' {
  // Use the well-known numeric constants directly (1/2/3) so this does not
  // depend on the GeolocationPositionError class existing at runtime (it does
  // not under jsdom).
  switch (err?.code) {
    case 1: // PERMISSION_DENIED
      return 'denied';
    case 3: // TIMEOUT
      return 'timeout';
    case 2: // POSITION_UNAVAILABLE
    default:
      return 'unavailable';
  }
}
