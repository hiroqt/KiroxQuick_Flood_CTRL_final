// src/services/env.ts
import type { AppConfig } from '../types/config';

/**
 * The subset of the Vite env we read. Kept minimal and injectable so the
 * loader can be unit-tested without relying on the global `import.meta.env`
 * (Req 17.1 — design: Tile provider integration & env-based API key).
 */
export interface TileEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
}

/**
 * Reads the Mapbox access token from the environment and returns a typed
 * {@link AppConfig}.
 *
 * The token is trimmed; `hasTileKey` is true only when a non-empty,
 * non-whitespace token is present. Never throws when the token is missing so
 * the app shell can still render and gate tile requests on `hasTileKey`
 * (Req 17.4). The {@link AppConfig} shape is unchanged: `tileKey` now holds the
 * Mapbox access token and `hasTileKey` reflects its presence.
 *
 * @param env - Env source to read from. Defaults to Vite's `import.meta.env`.
 */
export function loadConfig(env: TileEnv = import.meta.env): AppConfig {
  const raw = env.VITE_MAPBOX_ACCESS_TOKEN;
  const tileKey = typeof raw === 'string' ? raw.trim() : '';

  if (tileKey.length > 0) {
    return { tileKey, hasTileKey: true };
  }

  return { hasTileKey: false };
}
