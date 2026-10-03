// src/components/controls/locationMessages.ts
//
// User-facing status messages for LocationControl (Req 6.3–6.6). Kept in their
// own module so the component file only exports components (react-refresh) and
// so tests can assert the exact copy. Messages are deliberately free of
// "safe"/"clear"/"no risk"/score language (Req 13).

export const LOCATION_MESSAGES = {
  /** Permission denied (Req 6.3). */
  denied: 'Location access was denied',
  /** Geolocation unavailable in this environment (Req 6.4). */
  unavailable: 'Location is unavailable',
  /** Request did not resolve within the timeout window (Req 6.5). */
  timeout: 'Location could not be determined',
  /** Detected position outside the Metro_Manila_Extent (Req 6.6). */
  outsideNcr: 'BahaRoute currently supports Metro Manila (NCR) only',
} as const;
