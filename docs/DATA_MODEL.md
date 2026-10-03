# Data Model

## Flood types (`src/types/flood.ts`)

- **`FloodState`**: `RED | ORANGE | YELLOW | GREEN | GRAY` — a closed set of exactly five values. `GRAY` = Unknown.
- **`VerificationStatus`**: `VERIFIED | UNCONFIRMED`.
- **`FloodDataType`**: `SUSCEPTIBILITY | REPORT | COMMUNITY_REPORT`.
- **`SusceptibilityLevel`**: `HIGH | MODERATE | LOW`.
- **`FloodItemMetadata`** (required on every item): `location` (`{ lng, lat }`), `source`, `dataType`, `updatedAt` (epoch seconds), `verificationStatus`; optional `severity`, `depth`, `description`, `sourceUrl`.
- **`FloodSusceptibility`**: modeled/historical exposure with hazard-shaped `Polygon | MultiPolygon` geometry — never a city-boundary proxy.
- **`FloodReport`**: current/recent reported condition; `passable` is present only when known and is required for `GREEN`.

Classification logic in `src/layers/floodClassification.ts` is pure and validated with property-based tests. Items missing required metadata are rejected, never projected. Times are epoch seconds throughout.

## NCR boundary data (`src/data/geojson/`)

- `metroManilaCityBoundaries.geojson` — `FeatureCollection`, 17 features (15 `Polygon`, 2 `MultiPolygon`: Caloocan and Las Piñas). Real administrative boundaries.
- `metroManilaCityBoundaries.ts` — loads and types the GeoJSON asset.
- `cityNameNormalization.ts` — explicit `city_norm → { id, name }` table for all 17 LGUs. Deliberately handles source variants: `QUEZON → Quezon City`, `LAS PINAS → Las Piñas`, `PARANAQUE → Parañaque`. Unknown/missing `city_norm` fails loudly.

## Per-city susceptibility summary (`src/data/fixtures/cityFloodSusceptibility.ts`)

A per-city modeled susceptibility summary drawn on the real administrative silhouette. Each of the 17 cities is assigned a single `HIGH`/`MODERATE`/`LOW` class (`NO GREEN`), paired with the real boundary geometry matched by normalized `city_norm`, and carries `dataType: 'SUSCEPTIBILITY'`, `UNCONFIRMED`, and a demo source label. The administrative geometry does not represent flood conditions — only the labeled summary value does.

## Fixtures (`src/data/fixtures/`)

All demo/non-authoritative: `floodSusceptibility`, `floodReports`, `communityReports`, `routes`, `routeFloodSegments`, `evacuationCenters`, `boundaries`, `cityFloodSusceptibility`. Served via `FixtureDataSource`.
