// src/data/geojson/cityNameNormalization.ts
//
// Explicit mapping from the LOCAL boundary dataset's `properties.city_norm`
// values to BahaRoute's stable city id + display name. The mapping is fully
// explicit (no fragile string manipulation) so accent/variant cases are handled
// deliberately:
//   - "QUEZON"     → Quezon City   (source omits "City")
//   - "LAS PINAS"  → Las Piñas     (source drops the ñ)
//   - "PARANAQUE"  → Parañaque     (source drops the ñ)
//
// The BahaRoute city ids match the existing `boundaryFixtures` ids so downstream
// code (LayerRegistry, popups, tests) keeps working unchanged.

/** A resolved BahaRoute city identity. */
export interface BahaRouteCity {
  /** Stable city id (matches boundaryFixtures ids). */
  id: string;
  /** Human display name (used as the popup "Area" label). */
  name: string;
}

/**
 * Explicit `city_norm` → { id, name } table for the 17 NCR jurisdictions.
 * Keys are the exact upper-cased source values found in the local dataset.
 */
export const CITY_NORM_TO_CITY: Readonly<Record<string, BahaRouteCity>> = {
  CALOOCAN: { id: 'caloocan', name: 'Caloocan' },
  'LAS PINAS': { id: 'las-pinas', name: 'Las Piñas' },
  MAKATI: { id: 'makati', name: 'Makati' },
  MALABON: { id: 'malabon', name: 'Malabon' },
  MANDALUYONG: { id: 'mandaluyong', name: 'Mandaluyong' },
  MANILA: { id: 'manila', name: 'Manila' },
  MARIKINA: { id: 'marikina', name: 'Marikina' },
  MUNTINLUPA: { id: 'muntinlupa', name: 'Muntinlupa' },
  NAVOTAS: { id: 'navotas', name: 'Navotas' },
  PARANAQUE: { id: 'paranaque', name: 'Parañaque' },
  PASAY: { id: 'pasay', name: 'Pasay' },
  PASIG: { id: 'pasig', name: 'Pasig' },
  PATEROS: { id: 'pateros', name: 'Pateros' },
  QUEZON: { id: 'quezon-city', name: 'Quezon City' },
  'SAN JUAN': { id: 'san-juan', name: 'San Juan' },
  TAGUIG: { id: 'taguig', name: 'Taguig' },
  VALENZUELA: { id: 'valenzuela', name: 'Valenzuela' },
};

/**
 * Normalizes a source `city_norm` value to a BahaRoute city identity.
 *
 * @param cityNorm - The raw `properties.city_norm` value from the dataset.
 * @returns The `{ id, name }` for a known city, or `undefined` when unknown.
 */
export function normalizeCityNorm(
  cityNorm: string,
): BahaRouteCity | undefined {
  return CITY_NORM_TO_CITY[cityNorm];
}
