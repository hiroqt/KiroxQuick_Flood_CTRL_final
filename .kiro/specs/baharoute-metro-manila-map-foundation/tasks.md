# Implementation Plan — BahaRoute Metro Manila Map Foundation

## Overview

This plan implements **Milestone 1: Custom Metro Manila Map Foundation** as the single focused, first-executable block, followed by clearly-labeled **future milestones** (Milestones 2–6) that are architecture-readiness placeholders only.

The stack is fixed by the design: **React 18 + TypeScript + Vite**, **MapLibre GL JS**, tested with **Vitest + React Testing Library + fast-check**. The design includes a **Correctness Properties** section (P1–P10), so property-based tests are included as optional sub-tasks placed close to the pure logic they validate.

Each task builds incrementally on the previous one and ends by wiring new code into the app so there is no orphaned code. Test-related sub-tasks are marked optional with `*` and MUST NOT block core implementation. Run tests single-shot (`vitest --run`), never in watch mode; run dev servers manually.

**Explicitly out of scope for Milestone 1** (deferred to future milestones, do NOT implement heavy logic): advanced routing, production traffic engine, live flood API integration, community-report submission workflows, full turn-by-turn navigation, AI routing, arbitrary safety scores, nationwide support (_Requirements: 16.4, 16.5_).

---

## Tasks

### Milestone 1 — Metro Manila Map Foundation (FIRST EXECUTABLE BLOCK)

- [x] 1. Initialize greenfield React + TypeScript + Vite project and test tooling
  - **Objective:** Scaffold a working Vite + React + TS app that builds and runs, with the full test toolchain configured.
  - **Files/components:** `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts` (or `test` block in `vite.config.ts`), `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/test/setup.ts`
  - **Dependencies/prerequisites:** none (greenfield); this is the root of all later tasks
  - **Implementation details:**
    - React 18 + TypeScript, strict mode enabled in `tsconfig`
    - Add scripts: `dev`, `build`, `preview`, `typecheck` (`tsc --noEmit`), `lint`, `test` (`vitest --run`)
    - Install & configure Vitest with `jsdom`/`happy-dom` environment, React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`), and `fast-check`
    - Configure ESLint + a formatter for the TS/React project
    - `src/App.tsx` renders a minimal shell placeholder that later tasks replace
  - **Acceptance criteria:** `npm run build` succeeds; `npm run typecheck` passes; a trivial smoke test runs green under `vitest --run`
  - **Verification/checks:** typecheck, lint, `vitest --run` (one trivial test), `npm run build`
  - _Requirements: foundation for all; testing tooling per design Testing Strategy → Tooling_

- [x] 2. Environment configuration & secure API key loading
  - [x] 2.1 Implement the env config loader and `.env.example`
    - **Objective:** Read the Tile_Provider API key from env at runtime with a typed `AppConfig` and `hasTileKey` flag; never hardcode or commit a key.
    - **Files/components:** `src/types/config.ts` (add `AppConfig`), `src/services/env.ts`, `.env.example`, `.gitignore`
    - **Dependencies/prerequisites:** Task 1
    - **Implementation details:**
      - `env.ts` reads `import.meta.env.VITE_MAPTILER_KEY`, returns `AppConfig { tileKey?: string; hasTileKey: boolean }`
      - `.env.example` documents `VITE_MAPTILER_KEY` with a **placeholder value only** (no real key)
      - Ensure `.env` / `.env.local` are gitignored; assert no hardcoded key exists in source
    - **Acceptance criteria:** with no key set, `hasTileKey === false`; with a key set, `hasTileKey === true`; `.env.example` contains only a placeholder
    - **Verification/checks:** typecheck, unit test for `hasTileKey` both states, grep confirms no hardcoded key
    - _Requirements: 17.1, 17.2, 17.3 (design → Tile provider integration & env-based API key)_

  - [x]* 2.2 Write unit tests for the env config loader
    - Test `hasTileKey` true/false paths and that a missing key does not throw
    - _Requirements: 17.1, 17.4 (design → Testing Strategy → Edge-case/failure: missing API key smoke)_

- [x] 3. Define TypeScript data models & types (architecture readiness)
  - **Objective:** Define all typed data models exactly as specified in design "Data Models" so later layers reuse them without redesign.
  - **Files/components:** `src/types/flood.ts`, `src/types/report.ts`, `src/types/route.ts`, `src/types/evacuation.ts`, `src/types/layer.ts`, `src/types/config.ts`
  - **Dependencies/prerequisites:** Task 1
  - **Implementation details:**
    - `flood.ts`: `FloodState` = exactly `'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'GRAY'`; `VerificationStatus`, `FloodDataType`, `SusceptibilityLevel`, `GeoLocation`, `FloodItemMetadata` (required: location, source, dataType, updatedAt, verificationStatus; optional: severity, depth, description, sourceUrl), `FloodSusceptibility`, `FloodReport`
    - `report.ts`: `CommunityReport` (distinct category)
    - `route.ts`: `Route`, `RouteAlternative`, `RouteFloodSegment` (per-segment `FloodState`)
    - `evacuation.ts`: `EvacuationCenter` (location, name, description)
    - `layer.ts`: `LayerId`, `DataLayerMeta`, `DataLayer<TItem>`, `LoadResult<TItem>`, `DataSource`
    - `config.ts`: `RecencyConfig`, `DEFAULT_RECENCY_WINDOW_SECONDS = 21_600`
  - **Acceptance criteria:** all types compile; `FloodState` union has exactly five members; `DEFAULT_RECENCY_WINDOW_SECONDS === 21600`
  - **Verification/checks:** typecheck; unit assertion on the default recency constant
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 14.1, 16.1, 16.2 (design → Data Models, Data-layer architecture)_

- [x] 4. Implement pure flood logic (validation, classification, visual mapping, zoom fade)
  - [x] 4.1 Implement `validateFloodMetadata` and `classifyFloodState`
    - **Objective:** Pure functions that gate metadata and classify `FloodState` against the recency window, with GRAY (never "no risk") for absent/stale data and GREEN only for present-and-recent passability.
    - **Files/components:** `src/layers/floodClassification.ts`
    - **Dependencies/prerequisites:** Task 3
    - **Implementation details:**
      - `validateFloodMetadata`: returns true iff location, source, dataType, updatedAt, verificationStatus all present
      - `classifyFloodState(report, now, recency)`: returns a value strictly within the five-value set; GREEN iff passability present AND `(now - updatedAt) <= windowSeconds` (window edge inclusive); absent report OR `(now - updatedAt) > window` → GRAY
    - **Acceptance criteria:** GRAY for undefined report; GREEN at exact window edge, not at window+1
    - **Verification/checks:** typecheck, unit tests for edge/GRAY/GREEN cases
    - _Requirements: 12.3, 12.6, 12.7, 13.4 (design → Validation & classification logic)_

  - [x]* 4.2 Property test — classification yields a valid Flood_State
    - **Property 1: Classification always yields a valid Flood_State**
    - **Validates: Requirements 12.1, 13.4**
    - Tag: `// Feature: baharoute-metro-manila-map-foundation, Property 1: ...`; ≥100 iterations

  - [x]* 4.3 Property test — required metadata gates acceptance and projection
    - **Property 2: Required metadata gates acceptance and projection**
    - **Validates: Requirements 12.3**
    - ≥100 iterations; random present/missing metadata fields

  - [x]* 4.4 Property test — GREEN only for present-and-recent passability
    - **Property 3: GREEN is assigned only for present-and-recent passability**
    - **Validates: Requirements 12.6, 12.5**
    - ≥100 iterations; ages around window incl. exact edge and W+1

  - [x]* 4.5 Property test — absent/stale is GRAY, never "no risk"
    - **Property 4: Absent or stale information is GRAY, never "no risk"**
    - **Validates: Requirements 12.7, 13.4**
    - ≥100 iterations; absent reports + ages beyond window

  - [x] 4.6 Implement susceptibility color mapping and state-label mapping
    - **Objective:** Map `SusceptibilityLevel` → translucent color token, and `FloodState` → approved display label ("Unknown" for GRAY, never "no risk"/"safe"/"clear").
    - **Files/components:** `src/layers/visualMapping.ts`, `src/map/basemap/colorTokens.ts` (color tokens referenced here)
    - **Dependencies/prerequisites:** Task 3, Task 6 (colorTokens can be stubbed then finalized)
    - **Implementation details:** `susceptibilityColor(level)`; `floodStateLabel(state)` restricted to approved vocabulary
    - **Acceptance criteria:** GRAY → "Unknown"; no label contains "safe"/"clear"/"no risk"
    - **Verification/checks:** typecheck, unit tests over all five states and three levels
    - _Requirements: 13.1, 13.4 (design → Susceptibility classification → visual mapping)_

  - [x]* 4.7 Property test — state labels stay within approved vocabulary
    - **Property 5: State labels stay within the approved vocabulary**
    - **Validates: Requirements 13.4, 13.1**
    - ≥100 iterations over all five FloodState values

  - [x]* 4.8 Property test — susceptibility vs report treatments are mutually exclusive
    - **Property 6: Susceptibility and report visual treatments are mutually exclusive**
    - **Validates: Requirements 12.2, 14.1**
    - ≥100 iterations over all `FloodDataType` values

  - [x] 4.9 Implement the zoom-opacity fade function
    - **Objective:** Pure evaluator for susceptibility `fill-opacity` as a non-increasing function of zoom (prominent ~z10, faded ~z15–17).
    - **Files/components:** `src/layers/zoomOpacity.ts`
    - **Dependencies/prerequisites:** Task 3
    - **Implementation details:** linear-interpolation stops `{10:0.45, 13:0.30, 15:0.12, 17:0.06}`; expose an evaluator usable in tests and to build the MapLibre paint expression
    - **Acceptance criteria:** for `z1 < z2`, `opacity(z1) >= opacity(z2)`
    - **Verification/checks:** typecheck, unit tests at stop points and between stops
    - _Requirements: 2.1, 12.2 (design → Zoom-dependent visual dominance)_

  - [x]* 4.10 Property test — susceptibility opacity is non-increasing as zoom increases
    - **Property 8: Susceptibility opacity is non-increasing as zoom increases**
    - **Validates: Requirements 2.1, 12.2**
    - ≥100 iterations over pairs of in-range zoom levels

- [x] 5. Checkpoint — pure logic verified
  - Ensure all tests pass, ask the user if questions arise.
  - **Verification/checks:** `vitest --run`, typecheck, lint

- [x] 6. Custom quiet BahaRoute basemap style asset & color tokens
  - **Objective:** Author the quiet BahaRoute MapLibre style as an editable source asset with a muted (saturation ≤ 30%) palette; reserve saturated colors for flood layers; preserve roads/waterways/labels/boundaries; render a 3-tier road hierarchy.
  - **Files/components:** `src/map/basemap/BahaRouteStyle.ts`, `src/map/basemap/colorTokens.ts`
  - **Dependencies/prerequisites:** Task 2 (key injected into style sources at runtime)
  - **Implementation details:**
    - `colorTokens`: base features saturation ≤ 30%; a separate reserved (>30% saturation) set used only by flood layers
    - Style defines land, water, roads, boundaries, labels; place labels use a low-contrast treatment
    - Road hierarchy in three tiers (minor/major/expressway) with ordered `line-width` (expressway > major > minor) via zoom-interpolated width, and per-tier `minzoom`
    - `minzoom`/`maxzoom` defined on the style; provider tile source injected at runtime from env (no hardcoded key)
    - No Google Maps / third-party navigation assets, icons, or branding
  - **Acceptance criteria:** every base feature color has saturation ≤ 30%; no reserved color applied to base features; three ordered road widths present
  - **Verification/checks:** typecheck; unit/build check asserting base-feature saturation ≤ 30% and road-width ordering
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.4, 4.1, 4.2, 4.3 (design → Custom quiet Basemap_Style asset)_

  - [x]* 6.1 Write unit/build check for the basemap saturation & road-hierarchy rules
    - Assert every base-map feature color has saturation ≤ 30%, no reserved (>30%) color on base features, and expressway > major > minor widths
    - _Requirements: 2.1, 2.2, 4.2 (design → Testing Strategy → Unit/example: basemap saturation rule)_

- [x] 7. Metro_Manila_Extent constant & MapManager lifecycle
  - **Objective:** Define the NCR bounding-box constant and a `MapManager` that owns the MapLibre instance lifecycle behind a typed API.
  - **Files/components:** `src/map/metroManilaExtent.ts`, `src/map/MapManager.ts`
  - **Dependencies/prerequisites:** Task 6 (style), Task 2 (config)
  - **Implementation details:**
    - `Metro_Manila_Extent`: predefined bounding box framing the 17 NCR jurisdictions
    - `MapManager.init(container, style, extent)`: `new maplibregl.Map({ style, bounds, minzoom, maxzoom })`; frame center inside NCR
    - Start a **15s tile watchdog**; on `load`/`idle` call `onReady` and clear watchdog; on error/timeout call `onTileFailure`
    - `ResizeObserver` → `map.resize()`; `destroy()` → `map.remove()` and clear timers; clamp zoom to style min/max
  - **Acceptance criteria:** initial framing centered inside NCR; watchdog fires exactly once on failure and is cleared on success; `destroy` releases resources
  - **Verification/checks:** typecheck, lint; unit test for extent center-in-NCR; behavior test for watchdog fire/clear
  - _Requirements: 1.2, 1.3, 5.2, 5.3, 5.5, 1.6 (design → MapManager lifecycle)_

- [x] 8. Data layer implementation & isolated demo fixtures
  - [x] 8.1 Implement `FixtureDataSource` and per-category `DataLayer`s
    - **Objective:** Implement the `DataLayer`/`DataSource` interfaces with `FixtureDataSource`, including validated `load()` (skip-malformed) and `toGeoJSON()` (empty → well-formed empty collection).
    - **Files/components:** `src/services/FixtureDataSource.ts`, `src/layers/dataLayers.ts` (per-category `DataLayer` implementations)
    - **Dependencies/prerequisites:** Task 3, Task 4.1 (validation)
    - **Implementation details:**
      - Each `LayerId` gets a `DataLayer` with `meta` (label, `isDemo: true`, `defaultVisible`), `load()` returning `LoadResult` with `skipped` count, and `toGeoJSON()`
      - `load()` never throws on malformed items; empty item list → `FeatureCollection` with empty `features`
      - No AI-generated labels; do not invent authoritative APIs
    - **Acceptance criteria:** mixed valid/malformed input returns only valid items with correct `skipped`; empty input yields empty FeatureCollection; all fixture layers report `isDemo: true`
    - **Verification/checks:** typecheck, unit tests for skip/empty behavior
    - _Requirements: 15.1, 15.3, 15.4, 15.5, 16.3, 18.2, 18.3 (design → DataLayer interface abstraction)_

  - [x] 8.2 Author the isolated, clearly-labeled demo fixtures
    - **Objective:** Provide demo fixtures for every category, isolated in `src/data/fixtures`, plausibly shaped and clearly labeled demo.
    - **Files/components:** `src/data/fixtures/boundaries.ts`, `floodSusceptibility.ts`, `floodReports.ts`, `communityReports.ts`, `routes.ts`, `routeFloodSegments.ts`, `evacuationCenters.ts`
    - **Dependencies/prerequisites:** Task 3
    - **Implementation details:**
      - `boundaries`: 17 NCR jurisdiction polygons
      - `floodSusceptibility`: **plausible flood-hazard-shaped polygons** (low-lying areas / waterways) — NOT city-boundary shapes as risk proxies; clearly labeled demo
      - reports/communityReports/routes/routeFloodSegments/evacuationCenters: minimal valid demo items
    - **Acceptance criteria:** susceptibility geometry is not a copy of boundary geometry; all fixtures marked demo
    - **Verification/checks:** typecheck; unit assertion that susceptibility geometry differs from boundary geometry
    - _Requirements: 3.1, 15.1, 15.2, 15.4 (design → Flood Map Visual Concept constraint: flood geometry ≠ city boundaries)_

  - [x]* 8.3 Property test — malformed items skipped without throwing
    - **Property 9: Malformed items are skipped without throwing**
    - **Validates: Requirements 18.2**
    - ≥100 iterations over lists mixing valid + malformed items

  - [x]* 8.4 Property test — empty layers project to a well-formed empty collection
    - **Property 10: Empty layers project to a well-formed empty collection**
    - **Validates: Requirements 18.3**
    - ≥100 iterations (or exhaustive empty case) → `type: "FeatureCollection"`, empty `features`

- [x] 9. LayerRegistry with fixed z-order
  - **Objective:** Implement a `LayerRegistry` that inserts MapLibre layers in the fixed top→bottom z-order from the design so future layers slot in predictably.
  - **Files/components:** `src/layers/LayerRegistry.ts`
  - **Dependencies/prerequisites:** Task 7 (MapManager), Task 8 (DataLayers)
  - **Implementation details:**
    - Fixed order (top→bottom): UI markers > flood reports > route highlights > road flood-condition segments > flood susceptibility polygons > boundaries > labels > roads > buildings > parks > water > background
    - Use `map.addLayer(layer, beforeId)` to enforce order; expose add/remove/setVisibility per `LayerId`
  - **Acceptance criteria:** layers appear in the specified relative order; toggling visibility does not reorder
  - **Verification/checks:** typecheck, unit test asserting insertion order/`beforeId` sequence
  - _Requirements: 9.1, 9.4 (design → Map layer ordering & z-index strategy)_

- [x] 10. Metro Manila flood-susceptibility polygon rendering + popup
  - [x] 10.1 Render translucent, zoom-faded susceptibility polygons over the readable basemap
    - **Objective:** Render color-coded, semi-transparent susceptibility polygons over the basemap with roads/waterways/labels/boundaries visible underneath, distinct from report symbols/segments.
    - **Files/components:** `src/layers/floodSusceptibilityLayer.ts` (MapLibre fill layer def), wired via `LayerRegistry`
    - **Dependencies/prerequisites:** Task 4.6 (color), Task 4.9 (zoom opacity), Task 9 (registry), Task 8 (fixtures)
    - **Implementation details:**
      - Translucent fill: High→translucent red, Moderate→translucent orange, Low→translucent yellow, each with a non-color cue (hatch/icon/label)
      - `fill-opacity` uses the zoom-interpolated expression from Task 4.9 (prominent ~z10, de-emphasized ~z15–17)
      - Susceptibility rendered as **area polygons** kept visually distinct from current/recent reports (symbols/segments)
    - **Acceptance criteria:** polygons visible at overview zoom and faded at street level; base features remain visible underneath; non-color cue present per level
    - **Verification/checks:** typecheck; unit test of the built paint expression stops; manual map-load/viewport check at z10 vs z16
    - _Requirements: 12.2, 2.1, 11.4 (design → Flood Map Visual Concept)_

  - [x] 10.2 Implement the susceptibility click/tap popup
    - **Objective:** On selecting a susceptibility polygon, show a popup with Area, Data type (Susceptibility), Susceptibility level, Source, Dataset date/last updated, and the historical-exposure disclaimer.
    - **Files/components:** `src/components/overlays/FloodPopup.tsx`, wiring in the susceptibility layer/MapView
    - **Dependencies/prerequisites:** Task 10.1
    - **Implementation details:** popup fields per design; disclaimer states susceptibility is historical/modeled exposure and does not confirm current flooding; no "safe"/score language
    - **Acceptance criteria:** popup shows all required fields and the disclaimer; contains no "safe"/score text
    - **Verification/checks:** typecheck; component test asserting fields + disclaimer + absence of banned language
    - _Requirements: 13.3, 13.1, 13.2 (design → Click/tap popup for a susceptibility area)_

- [x] 11. MapView React wrapper & app shell
  - **Objective:** Build the `MapView` React component that mounts the container and delegates to `MapManager`, plus the App shell with config check, error boundary, and layout.
  - **Files/components:** `src/components/MapView.tsx`, `src/App.tsx`, `src/components/ErrorBoundary.tsx`
  - **Dependencies/prerequisites:** Task 7 (MapManager), Task 2 (config)
  - **Implementation details:**
    - App shell checks `hasTileKey`: if missing, render shell + config-incomplete message and do NOT init tiles
    - `MapView` mounts container `div`, calls `MapManager.init` on mount and `destroy` on unmount, forwards `onReady`/`onTileFailure`
    - React error boundary wraps the map subtree so render errors show a message, not a blank crash
  - **Acceptance criteria:** with key present, map initializes; with key absent, shell renders and no tile request is made; render error is caught
  - **Verification/checks:** typecheck, lint; component test for missing-key shell path; manual map-load check with a real key
  - _Requirements: 1.1, 1.4, 17.4 (design → Missing-key handling, Architecture)_

- [~] 12. Checkpoint — map renders with susceptibility layer
  - Ensure all tests pass, ask the user if questions arise.
  - **Verification/checks:** `vitest --run`, typecheck, lint, `npm run build`, manual map-load at overview and street zoom

- [x] 13. Map controls
  - [x] 13.1 Implement `LocationControl` and geolocation service
    - **Objective:** Request geolocation; on grant place `Current_Location_Marker` and center; handle denied/unavailable/20s timeout/out-of-NCR.
    - **Files/components:** `src/components/controls/LocationControl.tsx`, `src/services/geolocation.ts`, current-location marker
    - **Dependencies/prerequisites:** Task 11 (MapView), Task 7 (extent)
    - **Implementation details:** grant → marker + center; denied → "location access denied" message, stay on extent; unavailable → "location unavailable"; 20s timeout → "could not be determined"; out-of-NCR → show marker + "NCR only" message; map stays interactive in all cases
    - **Acceptance criteria:** each branch shows the correct message and keeps the map interactive
    - **Verification/checks:** typecheck; component tests for denied/unavailable/timeout/out-of-NCR
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 18.4 (design → Components table, Error Handling)_

  - [x] 13.2 Implement `RecenterControl`
    - **Objective:** Return the map to `Metro_Manila_Extent` within 1000 ms; no-op safe when already framed.
    - **Files/components:** `src/components/controls/RecenterControl.tsx`
    - **Dependencies/prerequisites:** Task 11
    - **Acceptance criteria:** recenter animates back ≤1000 ms; activating when already framed does not error
    - **Verification/checks:** typecheck; behavior test for recenter + no-op-safe
    - _Requirements: 7.1, 7.2, 7.3 (design → Components table)_

  - [x] 13.3 Implement `ZoomControls`
    - **Objective:** On-screen zoom in/out clamped at style min/max, ≥44×44 touch targets.
    - **Files/components:** `src/components/controls/ZoomControls.tsx`
    - **Dependencies/prerequisites:** Task 11
    - **Acceptance criteria:** zoom past min/max keeps level with no error; buttons ≥44×44
    - **Verification/checks:** typecheck; behavior test for clamping
    - _Requirements: 5.4, 5.5 (design → Components table)_

  - [x] 13.4 Implement `LayerControl`
    - **Objective:** List every `DataLayer` uniformly; toggle show/hide within 500 ms; empty list shows no error; state conveyed with text + non-color cue.
    - **Files/components:** `src/components/controls/LayerControl.tsx`
    - **Dependencies/prerequisites:** Task 9 (registry), Task 8 (DataSource.listLayers)
    - **Acceptance criteria:** each layer listed with the same toggle interaction; toggling updates visibility ≤500 ms; empty list renders no error; on/off state has a non-color cue
    - **Verification/checks:** typecheck; component tests for listing/toggle/empty/non-color state
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5 (design → Components table)_

  - [x]* 13.5 Component tests for controls accessibility
    - Each control keyboard-focusable/activatable, has an accessible label, shows a visible focus ring
    - _Requirements: 11.1, 11.2, 11.3 (design → Testing Strategy → Component tests)_

- [x] 14. Origin & Destination markers
  - [x] 14.1 Implement `OriginMarker` / `DestinationMarker`
    - **Objective:** Support exactly one origin and one destination; distinct shape/icon (not color alone); re-place moves the existing marker; accessible role labels.
    - **Files/components:** `src/components/markers/OriginMarker.tsx`, `src/components/markers/DestinationMarker.tsx`, marker manager in MapView
    - **Dependencies/prerequisites:** Task 11
    - **Implementation details:** MapLibre HTML `Marker` overlays with DOM nodes for labels/focus; distinct shape/icon in addition to any color; placing a second origin/destination moves the existing one
    - **Acceptance criteria:** never more than one of each; re-place repositions; markers distinguishable without color; each carries an accessible role label
    - **Verification/checks:** typecheck; component tests for single-instance/reposition/shape-distinction/label
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5 (design → Components table)_

  - [x]* 14.2 Component tests for markers
    - Exactly one origin and one destination; re-placing moves existing; distinct shape/icon and accessible role label
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5 (design → Testing Strategy → Component tests: Markers)_

- [x] 15. Overlays & safety messaging
  - [x] 15.1 Implement overlay/messaging components
    - **Objective:** Implement `LoadingIndicator`, `ConfigIncomplete`, `ErrorMessage`, `DemoDataBadge`, and `Disclaimer` with safety-framed language.
    - **Files/components:** `src/components/overlays/LoadingIndicator.tsx`, `ConfigIncomplete.tsx`, `ErrorMessage.tsx`, `DemoDataBadge.tsx`, `Disclaimer.tsx`
    - **Dependencies/prerequisites:** Task 11
    - **Implementation details:** loading shown while tiles load and dismissed on render; config-incomplete when key missing; error message on tile failure/timeout; demo-data badge visible when fixtures shown; disclaimer accompanies flood info; no "safe"/"clear"/numeric-score text; GRAY labeled "Unknown", never "no risk"
    - **Acceptance criteria:** each overlay renders in its condition; no banned safety language anywhere
    - **Verification/checks:** typecheck; component tests incl. assertion that no "safe"/score text appears
    - _Requirements: 1.5, 13.1, 13.2, 13.3, 13.4, 15.2, 17.4 (design → Components table)_

  - [x] 15.2 Wire loading/error/demo overlays into MapView
    - **Objective:** Connect `MapManager` `onReady`/`onTileFailure` and DataSource `isDemo` to the overlays.
    - **Files/components:** `src/components/MapView.tsx`, `src/App.tsx`
    - **Dependencies/prerequisites:** Task 15.1, Task 11, Task 7
    - **Acceptance criteria:** loading dismissed on ready; error shown on failure; demo badge shown when demo layers present
    - **Verification/checks:** typecheck; behavior test for loading→ready and failure→error
    - _Requirements: 1.5, 1.6, 15.2, 18.1 (design → MapManager lifecycle, Error Handling)_

- [-] 16. Responsive layout
  - **Objective:** Implement the 768px breakpoint layout: mobile controls in the lower two-thirds, desktop non-overlapping/fully visible, safe-area insets, ≥44×44 touch targets.
  - **Files/components:** `src/styles/layout.css` (CSS custom properties + media query), control container components
  - **Dependencies/prerequisites:** Task 13, Task 14, Task 15
  - **Implementation details:** CSS custom-property token set switches placement at the 768px media query; `env(safe-area-inset-*)` padding; mobile targets ≥44×44
  - **Acceptance criteria:** <768px controls in lower two-thirds with ≥44×44 targets and safe-area padding; ≥768px controls non-overlapping and fully visible
  - **Verification/checks:** typecheck/lint; component/layout test at mobile & desktop widths; manual viewport check
  - _Requirements: 10.1, 10.2, 10.3, 10.4 (design → Responsive layout strategy)_

- [x] 17. Accessibility hardening
  - **Objective:** Ensure keyboard operability, visible focus ≥3:1, accessible labels, WCAG AA contrast, and non-color-alone status across all controls.
  - **Files/components:** shared focus-ring token in `src/styles`, control components, `Disclaimer`/status components
  - **Dependencies/prerequisites:** Tasks 13–16
  - **Implementation details:** real focusable elements in tab order; dedicated focus-ring token (≥3:1); accessible names on all controls; text ≥4.5:1, large text/boundaries ≥3:1; status via icon/text/pattern in addition to color
  - **Acceptance criteria:** every control reachable and activatable by keyboard with a visible focus ring; no status conveyed by color alone
  - **Verification/checks:** typecheck; component a11y tests for focus/label/keyboard; note that full WCAG conformance needs manual AT review
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5 (design → Accessibility strategy)_

- [x] 18. Graceful error-handling wiring (end-to-end)
  - **Objective:** Wire all failure paths so the app stays usable: missing key, tile failure/15s timeout, denied/unavailable/20s geolocation, malformed GeoJSON skip-and-continue, empty flood layer.
  - **Files/components:** `src/App.tsx`, `src/components/MapView.tsx`, `src/services/geolocation.ts`, `src/services/FixtureDataSource.ts`, overlays
  - **Dependencies/prerequisites:** Tasks 7, 8, 11, 13.1, 15
  - **Implementation details:** connect each failure from the design Error Handling table to its message/behavior; base map and controls stay interactive where the failure permits
  - **Acceptance criteria:** each failure path shows the correct message and does not crash; malformed sources skipped and remaining layers still render; empty layer renders with no error
  - **Verification/checks:** typecheck; edge-case tests for missing-key (smoke), tile timeout, geolocation denied/unavailable/timeout, malformed GeoJSON, empty layer
  - _Requirements: 17.4, 1.6, 18.1, 18.2, 18.3, 6.3, 6.4, 6.5, 18.4, 18.5 (design → Error Handling)_

- [x] 19. Milestone 1 quality gate — final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - **Objective (gate):** map loads reliably and stays usable on desktop/mobile; flood susceptibility visible at overview and de-emphasized at street level; historical susceptibility visually distinct from current reports; no missing-data shown as "No Risk".
  - **Verification/checks:** `vitest --run` (unit + property + component), typecheck, lint, `npm run build`; manual map-load/viewport checks at overview (~z10) and street level (~z15–17) on mobile and desktop widths
  - _Requirements: Milestone 1 acceptance across Req 1–18_

---

### Future Milestones (OPTIONAL — architecture-readiness only; do NOT implement heavy logic)

These milestones are deferred. Only add scaffolding/interfaces that keep Milestone 1 architecture ready; do not implement routing engines, live APIs, submission workflows, turn-by-turn navigation, AI routing, or safety scores.

- [ ]* 20. Milestone 2 — Flood susceptibility polish (FUTURE)
  - Legend component (per-level color + hatch + text), source/date metadata surfacing in UI, standing disclaimer placement
  - Architecture-readiness only; reuse existing `visualMapping`, `FloodPopup`, `Disclaimer`
  - _Requirements: 11.4, 13.3, 15.2 (design → Flood Map Visual Concept, Accessibility strategy)_

- [ ]* 21. Milestone 3 — Current/recent flood reports rendering (FUTURE)
  - Render `floodReports` as symbols/segments distinct from susceptibility; verification badge; `communityReports` marked UNCONFIRMED with text/icon and distinct shape/border
  - No community-report submission workflow
  - _Requirements: 12.2, 14.1, 14.2, 14.3, 14.4 (design → Property 7; Components table)_

- [ ]* 22. Milestone 4 — Route display (FUTURE)
  - Render fixture `routes`/`RouteAlternative` lines with origin/destination, ETA/distance info cards; fixtures clearly labeled demo
  - Geometry display only; no routing engine
  - _Requirements: 16.1, 16.4, 16.5, 15.2 (design → Data Models, Data-layer architecture)_

- [ ]* 23. Milestone 5 — Flood-aware route context (FUTURE)
  - Explainable spatial comparison of route geometry vs flood layers to annotate `routeFloodSegments`; no AI, no arbitrary safety score
  - _Requirements: 16.1, 13.1, 13.2 (design → Data Models: RouteFloodSegment)_

- [ ]* 24. Milestone 6 — Navigation prototype UI (FUTURE)
  - Prototype UI shell: Start, next-maneuver placeholder, ETA, exit, flood-info-ahead indicator
  - UI prototype only; no turn-by-turn navigation engine
  - _Requirements: 16.5 (design → Overview: out of scope)_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; the model MUST NOT implement `*` sub-tasks and MUST implement non-`*` sub-tasks.
- Property-based test sub-tasks map 1:1 to design properties P1–P10, run ≥100 iterations, and are tagged `// Feature: baharoute-metro-manila-map-foundation, Property {n}: {text}`.
- Property P7 (community-report UNCONFIRMED marking) is implemented and property-tested in future Milestone 3 where community reports are rendered; the type/flag foundation exists in Milestone 1 (Task 3).
- Each task references specific requirements and design sections for traceability.
- Checkpoints (Tasks 5, 12, 19) ensure incremental validation.
- Run tests single-shot (`vitest --run`); run dev servers manually — do not start watchers from tasks.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3", "8.2"] },
    { "id": 1, "tasks": ["2.2", "4.1", "4.9", "6", "8.1"] },
    { "id": 2, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "4.10", "6.1", "7", "8.3", "8.4"] },
    { "id": 3, "tasks": ["4.7", "4.8", "9", "11"] },
    { "id": 4, "tasks": ["10.1", "13.1", "13.2", "13.3", "13.4", "14.1", "15.1"] },
    { "id": 5, "tasks": ["10.2", "13.5", "14.2", "15.2", "16"] },
    { "id": 6, "tasks": ["17", "18"] },
    { "id": 7, "tasks": ["20", "21", "22", "23", "24"] }
  ]
}
```
