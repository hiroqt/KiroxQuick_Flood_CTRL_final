// src/types/config.ts

/**
 * Runtime application configuration derived from environment variables.
 *
 * The Tile_Provider API key is read from the environment at runtime and is
 * never hardcoded or committed to source control (Req 17.1, 17.2).
 */
export interface AppConfig {
  /** The Tile_Provider API key, present only when a non-empty key is configured. */
  tileKey?: string;
  /**
   * True only when a non-empty (non-whitespace) tile key is available.
   * Drives whether tile requests are made / the config-incomplete message
   * is shown (Req 17.4).
   */
  hasTileKey: boolean;
  /**
   * Demo Mode for hackathon presentation. When true, clearly-labeled synthetic
   * fixtures (community report, flood evidence, confirmed closure, reroute) are
   * injected and badged "DEMO". When false, NO synthetic item appears. Defaults
   * to false so production never shows demo data unless explicitly enabled.
   */
  demoMode: boolean;
}

export interface RecencyConfig {
  /** Default 21,600 seconds (6 hours), configurable (Req 12.5). */
  windowSeconds: number;
}

export const DEFAULT_RECENCY_WINDOW_SECONDS = 21_600;
