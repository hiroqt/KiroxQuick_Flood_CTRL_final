# Implementation Plan: BahaRoute Navigation Experience

## Overview

This plan turns the completed, verified Milestone 1 foundation (`baharoute-metro-manila-map-foundation`) into a polished, Metro Manila-first, flood-aware navigation application. It is a UX-correction and evolution, not a rewrite. It follows the design's Existing-Code Preservation map exactly:

- **REUSE (unchanged):** the Mapbox GL JS rendering core, `metroManilaExtent`, quiet basemap style + color tokens, `ErrorBoundary`, Location/Recenter/Zoom controls, markers, all overlays, `LayerRegistry`, `installFloodSusceptibility` + `susceptibilityPopup`, `floodClassification`/`visualMapping`/`zoomOpacity`, `DataLayer`/`DataSource` + fixtures, `env`, `geolocation.requestLocation`, all `types/*`.
- **EXTEND (additive, non-breaking):** `MapManager` / `MinimalMap` (add `flyTo`/`easeTo`/`setPitch`/`setBearing`), `App.tsx` (remove `<h1>` header, host the app-state provider), `MapView.tsx` (state-driven chrome, keep seams), `layout.css` (search/sheet/nav/trip/layer-panel tokens).
- **REPLACE / REDESIGN:** `LayerControl.tsx` (raw checkbox list → consumer panel), keeping the `onToggle → LayerRegistry.setVisibility` wiring.
- **NEW:** `src/state/appState.ts`, `src/camera/CameraController.ts` + `overviewFraming.ts`, `src/services/GeocodingProvider.ts` / `RoutingProvider.ts` / `locationFollow.ts`, `src/layers/routeFloodContext.ts`, and the `search/`, `route/`, `navigation/` component folders.

Scope guards enforced throughout: Metro Manila / NCR only (no nationwide support); no "safe route" / "safest" / "guaranteed safe" / arbitrary numeric safety score anywhere; GRAY "Unknown" never becomes "No Risk"/"Safe"/"Clear"; Community_Report content is marked UNCONFIRMED; routing/geocoding/live-flood are fixture/stub-backed behind interfaces and labeled demo; production never fabricates GPS. All Milestone 1 tests must stay green.

Tasks are ordered in a dependency-safe priority order (Milestone A first). Property-test sub-tasks are optional (marked with `*`), placed next to the pure logic they validate, tagged `// Feature: baharoute-navigation-experience, Property N: ...`, and run at minimum 100 iterations with fast-check.

> **Provider migration note (done, Milestone A context):** The map provider was migrated MapLibre GL JS + MapTiler → **Mapbox GL JS** (direct `mapbox-gl`). This updated the access-token env var (`VITE_MAPTILER_KEY` → `VITE_MAPBOX_ACCESS_TOKEN`) and the basemap provider (hand-authored OpenMapTiles style → stock `mapbox://styles/mapbox/light-v11`). Product logic, flood semantics, the `MapManager` camera abstraction, and the Metro Manila default framing are unchanged. See design.md → "Map provider" and "Licensing / billing". No milestone structure or Milestone B work is affected.

## Tasks

### Milestone A — Metro Manila default framing correction

- [ ] 1. Add tuned NCR overview framing constant
  - **Objective:** Provide a single tuned NCR overview bounding box + fit options so the app opens with Metro Manila centered and dominant, provinces only at the edges, and no hard clip of the basemap.
  - **Files/components affected:** NEW `src/camera/overviewFraming.ts`; REUSE `src/map/metroManilaExtent.ts` (`METRO_MANILA_EXTENT`/`METRO_MANILA_BOUNDS`).
  - **Dependencies/prerequisites:** Milestone 1 `metroManilaExtent` present.
  - **Implementation details:** Export `OVERVIEW_FIT_PADDING` (px padding, e.g. 24), `OVERVIEW_BOUNDS` derived from `METRO_MANILA_EXTENT` (optionally slightly tightened so the NCR is dominant without hard-clipping the base map beyond the box), and `overviewFitOptions(): { padding: number; duration: number }`. No camera side effects here — pure constants/helpers.
  - **Acceptance criteria:** `OVERVIEW_BOUNDS` frames the 17 NCR cities; padding keeps NCR as the majority of the viewport; basemap still renders beyond the box (no hard clip).
  - **Verification/checks:** `tsc --noEmit`; eslint; unit test asserting bounds/padding shape and that bounds are derived from the NCR extent.
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_
  - _Design: CameraController → `overviewFraming.ts`; Project structure (NEW)_

  - [ ]* 1.1 Write unit test for overview framing constant
    - **Objective:** Assert `OVERVIEW_BOUNDS`/`OVERVIEW_FIT_PADDING`/`overviewFitOptions()` shape and NCR-derived values.
    - **Files/components affected:** NEW `src/camera/overviewFraming.test.ts`.
    - **Implementation details:** Assert bounds are within/derived from `METRO_MANILA_EXTENT`, padding is a positive number, `overviewFitOptions()` returns `{ padding, duration }`.
    - **Acceptance criteria:** Test passes; no reliance on WebGL.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 1.2, 1.3, 1.4_
    - _Design: CameraController → `overviewFraming.ts`_

- [ ] 2. Extend MapManager with camera methods for framing
  - **Objective:** Add additive, no-op-safe camera pass-throughs so a future CameraController can drive framing without duplicating MapManager.
  - **Files/components affected:** EXTEND `src/map/MapManager.ts` (`MinimalMap` interface + `MapManager` methods).
  - **Dependencies/prerequisites:** Task 1 (framing constant available for the OVERVIEW fit).
  - **Implementation details:** Add optional `flyTo?`, `easeTo?`, `setPitch?`, `setBearing?` to `MinimalMap`; add guarded `flyTo()/easeTo()/setPitch()/setBearing()` on `MapManager` that delegate to the map (guarded like the existing `recenter()`), plus a `fitBounds`-based overview framing method using `overviewFitOptions()`. Preserve existing lifecycle, watchdog, resize, and zoom-clamp behavior unchanged.
  - **Acceptance criteria:** New methods are additive and non-breaking; existing MapManager tests stay green; calling camera methods when the map lacks them is a safe no-op.
  - **Verification/checks:** `tsc --noEmit`; eslint; existing `MapManager.test.ts` remains green.
  - _Requirements: 1.2, 10.5_
  - _Design: CameraController → MapManager extension; Preservation map (EXTEND MapManager)_

  - [ ]* 2.1 Write unit tests for MapManager camera extensions
    - **Objective:** Verify delegation and no-op-safety of the new camera methods.
    - **Files/components affected:** EXTEND `src/map/MapManager.test.ts`.
    - **Implementation details:** Use a fake minimal map recording calls; assert `flyTo/easeTo/setPitch/setBearing` delegate; assert no throw when the map omits a method.
    - **Acceptance criteria:** Tests pass; Milestone 1 MapManager tests untouched and green.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 1.2, 10.5_
    - _Design: CameraController → MapManager extension_

- [ ] 3. Frame overview on startup without auto-zooming to user
  - **Objective:** On startup the app enters OVERVIEW and `fitBounds` to the tuned NCR overview; if location permission is granted, place the current-location marker but do NOT auto-zoom to the user's street.
  - **Files/components affected:** EXTEND `src/components/MapView.tsx` and `src/map/MapManager.ts` (minimally); REUSE `src/services/geolocation.ts`, `src/components/markers/markerManager.ts`.
  - **Dependencies/prerequisites:** Tasks 1, 2.
  - **Implementation details:** On map ready, apply the overview framing. Call `requestLocation`; on success, set the current-location marker via `MarkerManager` origin without changing the camera; keep overview framing on denied/unavailable/timeout. Preserve overview until recenter/search/START.
  - **Acceptance criteria:** Startup shows NCR overview; granted location adds a marker but framing stays overview; degraded geolocation keeps a usable, interactive overview.
  - **Verification/checks:** `tsc --noEmit`; eslint; component tests with injected fakes.
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 21.1_
  - _Design: CameraController framing (OVERVIEW); Error Handling (geolocation degradation)_

  - [ ]* 3.1 Write component tests for startup framing + no auto-zoom
    - **Objective:** Assert overview-on-start, marker-without-zoom on granted location, and overview retained on degradation.
    - **Files/components affected:** EXTEND `src/components/MapView.test.tsx` (or NEW startup test).
    - **Implementation details:** Inject fake geolocation source returning granted/denied/unavailable; assert overview fit is applied and camera is not moved to street zoom when location is granted.
    - **Acceptance criteria:** All three paths pass without WebGL.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 2.1, 2.2, 2.4, 21.1_
    - _Design: CameraController framing (OVERVIEW); Error Handling_

- [ ] 4. Checkpoint — framing correction
  - Ensure all tests pass (including all Milestone 1 tests), typecheck and lint are clean. Ask the user if questions arise.

### Milestone B — Full-screen navigation shell

- [ ] 5. Remove oversized header and host the app-state shell
  - **Objective:** Remove the oversized `<h1>`/blank header so the map is the dominant full-screen element; host the app-state provider shell; present product identity as restrained chrome only.
  - **Files/components affected:** EXTEND `src/App.tsx` (remove `<header><h1>`, wrap with the app-state provider once it exists in Milestone D — for now introduce the shell layout and a small wordmark placeholder), EXTEND `src/components/MapView.tsx` (full-viewport map container).
  - **Dependencies/prerequisites:** Milestone A complete.
  - **Implementation details:** Delete the oversized heading and reserved header area; make the map container occupy the main viewport; add a restrained wordmark chrome element (small, not an oversized heading). Keep `ErrorBoundary` and config-check wiring intact.
  - **Acceptance criteria:** No oversized heading and no blank header band; map is dominant; wordmark is restrained chrome.
  - **Verification/checks:** `tsc --noEmit`; eslint; existing `App.test.tsx`/`MapView.test.tsx` updated and green.
  - _Requirements: 3.1, 3.2, 3.3, 19.1_
  - _Design: Navigation Shell Architecture_

- [ ] 6. Style controls as rounded floating controls
  - **Objective:** Present all primary controls as intentionally styled rounded floating controls (not browser defaults) with a clean BahaRoute identity, preserving safe-area behavior.
  - **Files/components affected:** EXTEND `src/styles/layout.css`; EXTEND `src/components/MapView.tsx` control cluster (class wiring only); REUSE control components.
  - **Dependencies/prerequisites:** Task 5.
  - **Implementation details:** Add layout.css tokens/classes for rounded floating controls; apply them to the existing Zoom/Recenter/Location cluster. Keep the 768px breakpoint, focus ring, and safe-area insets from Milestone 1. No control logic changes.
  - **Acceptance criteria:** Controls render as rounded floating chrome; safe-area behavior preserved; no browser-default control styling in primary UI.
  - **Verification/checks:** `tsc --noEmit`; eslint; component/structural tests asserting the styled control classes.
  - _Requirements: 3.4, 19.1_
  - _Design: Navigation Shell Architecture; Responsive Behavior_

  - [ ]* 6.1 Write shell + control-styling tests
    - **Objective:** Assert no oversized heading / no blank header, map is dominant, and controls carry the floating-control classes.
    - **Files/components affected:** EXTEND `src/App.test.tsx`, `src/components/MapView.test.tsx`.
    - **Implementation details:** Assert absence of an oversized `<h1>` header block; assert the map container class marks it dominant; assert control cluster uses the rounded floating classes.
    - **Acceptance criteria:** Tests pass; existing shell tests updated and green.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
    - _Design: Navigation Shell Architecture_

### Milestone C — Consumer layer control

- [ ] 7. Redesign LayerControl into an on-demand consumer panel
  - **Objective:** Replace the raw checkbox layer list with a compact floating button that opens a small menu on demand, using human-readable labels only, keeping the `onToggle → LayerRegistry.setVisibility` wiring.
  - **Files/components affected:** REPLACE/REDESIGN `src/components/controls/LayerControl.tsx`; REUSE `src/layers/LayerRegistry.ts`, `src/layers/dataLayers.ts` (`DataLayerMeta.label`); EXTEND `src/styles/layout.css` (layer-panel tokens).
  - **Dependencies/prerequisites:** Milestone B (shell/control styling).
  - **Implementation details:** Render a floating button that toggles a small panel (closed by default). Map `LayerId → friendly label` ("Flood susceptibility", "Recent flood reports", "Community reports", "Evacuation centers"). Use styled toggle switches with labels — no raw checkbox list, no plain "On"/"Off" text as the affordance, no internal ids in the primary UI. Keep `onToggle(id, visible)` calling `LayerRegistry.setVisibility`. Susceptibility visible by default; optional layers (community reports, evacuation centers, detailed route layers) start hidden.
  - **Acceptance criteria:** Panel closed by default and opens on demand; human labels only; toggles still drive `setVisibility`; susceptibility on by default; optional layers hidden.
  - **Verification/checks:** `tsc --noEmit`; eslint; component tests.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 16.1, 16.2, 16.3, 16.4, 16.5_
  - _Design: Consumer Layer Control Redesign_

  - [ ]* 7.1 Write LayerControl consumer-panel tests
    - **Objective:** Assert closed-by-default/opens-on-demand, human labels, toggle wiring, and no raw checkbox / "On-Off" / internal ids in primary UI.
    - **Files/components affected:** EXTEND `src/components/controls/LayerControl.test.tsx`.
    - **Implementation details:** Assert panel hidden initially; opens on button activation; friendly labels present; a spy `onToggle`/`setVisibility` is called; forbidden affordances/ids absent from the DOM.
    - **Acceptance criteria:** Tests pass; keyboard-accessible open/close.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 16.2, 16.3_
    - _Design: Consumer Layer Control Redesign_

- [ ] 8. Checkpoint — shell and layer control
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone D — App state machine + camera modes

- [ ] 9. Implement the pure App_State machine
  - **Objective:** Provide the typed `AppState` union and pure `transition`/`canTransition` as the single source of truth for interaction mode.
  - **Files/components affected:** NEW `src/state/appState.ts`.
  - **Dependencies/prerequisites:** none (pure module).
  - **Implementation details:** Define `AppStateName`, `AppEvent`, `AppState`, `INITIAL_APP_STATE` (name OVERVIEW, `navTransitionInProgress: false`, `priorState: null`). Implement `transition` (no-op returns the SAME reference; invalid events rejected/unchanged; `priorState` bookkeeping on NAVIGATION entry/exit; `navTransitionInProgress` guard set on START and cleared by `START_TRANSITION_DONE`) and `canTransition`.
  - **Acceptance criteria:** Initial state OVERVIEW; exactly one state active; no-op/blocked/invalid return identical reference; return-to-prior yields recorded `priorState`.
  - **Verification/checks:** `tsc --noEmit`; eslint; example unit tests + property tests below.
  - _Requirements: 10.1, 10.2, 10.6, 10.7, 11.7, 11.8_
  - _Design: App State Architecture_

  - [ ]* 9.1 Property test: state stays within the four-state set
    - **Objective:** For any event sequence from initial state, `state.name ∈ {OVERVIEW, SEARCH, ROUTE_PREVIEW, NAVIGATION}`.
    - **Files/components affected:** NEW `src/state/appState.property.test.ts`.
    - **Implementation details:** `// Feature: baharoute-navigation-experience, Property 1: App_State stays within the closed four-state set`; fast-check random `AppEvent[]` folds; ≥100 iterations.
    - **Validates:** Requirements 10.1, 10.2.
    - _Design: Correctness Properties → Property 1_

  - [ ]* 9.2 Property test: no-op transitions return the same reference
    - **Objective:** Same-target/blocked/invalid events (incl. START while in-progress) return the identical `AppState` reference.
    - **Files/components affected:** EXTEND `src/state/appState.property.test.ts`.
    - **Implementation details:** `// Feature: baharoute-navigation-experience, Property 2: No-op transitions return the same state reference`; ≥100 iterations.
    - **Validates:** Requirements 10.6, 11.7.
    - _Design: Correctness Properties → Property 2_

  - [ ]* 9.3 Property test: returning to prior state restores framing context
    - **Objective:** After NAVIGATION entered from S, EXIT/CANCEL yields `name === priorState`.
    - **Files/components affected:** EXTEND `src/state/appState.property.test.ts`.
    - **Implementation details:** `// Feature: baharoute-navigation-experience, Property 3: Returning to a prior state restores that state's framing context`; ≥100 iterations.
    - **Validates:** Requirements 10.7, 11.8.
    - _Design: Correctness Properties → Property 3_

  - [ ]* 9.4 Write example unit tests for transitions
    - **Objective:** Cover concrete edges: initial OVERVIEW, valid path OVERVIEW→SEARCH→ROUTE_PREVIEW→NAVIGATION, invalid START from OVERVIEW, double-START guard.
    - **Files/components affected:** NEW `src/state/appState.test.ts`.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 10.1, 10.2, 11.7_
    - _Design: App State Architecture_

- [ ] 10. Wrap the state machine in a React reducer/context provider
  - **Objective:** Hold the pure machine in a React reducer/context so chrome renders per state.
  - **Files/components affected:** NEW `src/state/appState.tsx` (or provider within `src/state/`); EXTEND `src/App.tsx` to mount the provider.
  - **Dependencies/prerequisites:** Task 9; Milestone B shell.
  - **Implementation details:** Reducer delegating to `transition`; context exposing state + dispatch. Mount provider in `App.tsx` around `MapView`.
  - **Acceptance criteria:** Provider exposes current state + dispatch; initial render is OVERVIEW.
  - **Verification/checks:** `tsc --noEmit`; eslint; component test that dispatch drives state and no-ops don't change reference.
  - _Requirements: 10.1, 10.2, 10.6_
  - _Design: App State Architecture (React reducer/context)_

- [ ] 11. Implement CameraController as the single camera writer
  - **Objective:** Implement the single component that moves the camera per App_State with named behaviors (2D_OVERVIEW / NAVIGATION_TILT / RECENTER).
  - **Files/components affected:** NEW `src/camera/CameraController.ts`; REUSE `src/camera/overviewFraming.ts`; EXTEND consumption of `MapManager` camera methods (Task 2).
  - **Dependencies/prerequisites:** Tasks 1, 2, 9.
  - **Implementation details:** `CameraController(map: CameraMap)`; `applyStateFraming(state, ctx)`: OVERVIEW/SEARCH → `fitBounds(OVERVIEW_BOUNDS, overviewFitOptions())`, pitch 0, north-up; ROUTE_PREVIEW → `fitBounds` over origin+destination+routes, pitch 0; NAVIGATION → `flyTo` toward user within 2000ms, pitch 45–60, zoom 16–18. `recenter(ctx)`, `toggle2DTilt()` (pitch 0 ↔ nav pitch), `followUser(pos, heading?)` (`easeTo` maintaining nav framing). Bearing order: heading → `routeDirection` → north-up. If `supportsTilt() === false`, keep pitch 0 and never force tilt. No extra zoom writes beyond the state's framing.
  - **Acceptance criteria:** Correct camera calls per state; single writer; tilt fallback honored; no unrequested zoom changes.
  - **Verification/checks:** `tsc --noEmit`; eslint; example tests against a fake `CameraMap`.
  - _Requirements: 1.2, 2.3, 9.3, 10.3, 10.4, 10.5, 11.2, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - _Design: Camera Controller; App_State ↔ Camera_Behavior mapping_

  - [ ]* 11.1 Write CameraController example tests with a fake CameraMap
    - **Objective:** Assert per-state camera calls, 2D/tilt toggle, bearing fallback order, and tilt-unsupported 2D fallback; assert no extra zoom writes.
    - **Files/components affected:** NEW `src/camera/CameraController.test.ts`.
    - **Implementation details:** Fake `CameraMap` records `fitBounds/flyTo/easeTo/setPitch/setBearing`; assert OVERVIEW/SEARCH fitBounds(OVERVIEW_BOUNDS), ROUTE_PREVIEW fit over origin+dest+routes, NAVIGATION flyTo pitch 45–60/zoom 16–18; assert `supportsTilt()===false` keeps pitch 0.
    - **Acceptance criteria:** All camera-behavior assertions pass without WebGL.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 10.4, 10.5, 11.2, 11.5, 12.1, 12.5, 12.6_
    - _Design: Camera Controller_

- [ ] 12. Wire state-to-camera in MapView
  - **Objective:** On App_State entry, call `CameraController.applyStateFraming`; ensure no-op/invalid transitions do not move the camera.
  - **Files/components affected:** EXTEND `src/components/MapView.tsx`; consumes Task 10 provider + Task 11 controller.
  - **Dependencies/prerequisites:** Tasks 10, 11.
  - **Implementation details:** Subscribe to state changes; construct `CameraController` from the MapManager camera surface; apply framing on entry; skip when the transition returned the same reference (no-op). Route the existing Recenter control through `CameraController.recenter`.
  - **Acceptance criteria:** State entry drives framing within timing budget; no-op/invalid transitions issue no camera call; recenter routed via controller.
  - **Verification/checks:** `tsc --noEmit`; eslint; component test asserting framing-on-entry and no camera call on no-op.
  - _Requirements: 10.4, 10.5, 10.6, 10.7, 2.3_
  - _Design: Navigation Shell Architecture; Camera Controller_

- [ ] 13. Checkpoint — state machine and camera
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone E — Search experience

- [ ] 14. Implement GeocodingProvider with fixture NCR-first ranking
  - **Objective:** Provide the `GeocodingProvider` interface and a `FixtureGeocodingProvider` with demo Metro Manila places (plus a few out-of-NCR) that ranks NCR results first and flags out-of-NCR queries.
  - **Files/components affected:** NEW `src/services/GeocodingProvider.ts`; REUSE `src/map/metroManilaExtent.ts` (`isWithinMetroManila`/NCR bbox), `src/types/*`.
  - **Dependencies/prerequisites:** none.
  - **Implementation details:** Define `GeocodePlace` (with `withinNCR`, `isDemo: true`), `GeocodeResults` (`places` NCR-first, `outOfNCRQuery`), `GeocodingProvider.search(query)`. `FixtureGeocodingProvider` holds demo places (e.g. Makati CBD, Quezon City Circle, Manila City Hall) + a few out-of-NCR; ranks `withinNCR` first; sets `outOfNCRQuery` when only far-outside results match. No latitude/longitude or GeoJSON surfaced.
  - **Acceptance criteria:** NCR results precede non-NCR; `outOfNCRQuery` set appropriately; results carry `isDemo`.
  - **Verification/checks:** `tsc --noEmit`; eslint; property + unit tests.
  - _Requirements: 8.2, 8.3, 8.4, 8.7, 21.3, 21.4, 21.5_
  - _Design: Search Architecture_

  - [ ]* 14.1 Property test: search results prioritize NCR ahead of non-NCR
    - **Objective:** After ranking, every `withinNCR===true` place precedes every `withinNCR===false` place.
    - **Files/components affected:** NEW `src/services/GeocodingProvider.property.test.ts`.
    - **Implementation details:** `// Feature: baharoute-navigation-experience, Property 4: Search results prioritize Metro Manila ahead of non-NCR`; random mixed `GeocodePlace[]`; ≥100 iterations.
    - **Validates:** Requirements 8.3.
    - _Design: Correctness Properties → Property 4_

- [ ] 15. Implement DestinationSearch component
  - **Objective:** Render a prominent "Where are you going?" search over the map; activating dispatches `ACTIVATE_SEARCH`; selecting dispatches `SELECT_DESTINATION`; show the out-of-NCR message and demo labeling.
  - **Files/components affected:** NEW `src/components/search/DestinationSearch.tsx`; EXTEND `src/components/MapView.tsx` (mount in OVERVIEW/SEARCH); consumes Task 10 provider + Task 14 provider.
  - **Dependencies/prerequisites:** Tasks 10, 14.
  - **Implementation details:** Prompt "Where are you going?"; on focus/activate dispatch `ACTIVATE_SEARCH`; render results with NCR prioritization visible and demo labeling; on `outOfNCRQuery` show a message that flood-aware coverage is focused on Metro Manila (never claim nationwide coverage); on selection dispatch `SELECT_DESTINATION`. No lat/lng or GeoJSON input fields.
  - **Acceptance criteria:** Activation/selection drive the correct state transitions; NCR prioritization surfaced; honest out-of-NCR message; demo-labeled results.
  - **Verification/checks:** `tsc --noEmit`; eslint; component tests.
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 21.5_
  - _Design: Search Architecture_

  - [ ]* 15.1 Write DestinationSearch component tests
    - **Objective:** Assert prioritization surfaced, out-of-NCR message (no "nationwide"), demo labeling, and ACTIVATE_SEARCH/SELECT_DESTINATION dispatches.
    - **Files/components affected:** NEW `src/components/search/DestinationSearch.test.tsx`.
    - **Implementation details:** Inject a fake provider; assert NCR-first order in the list, out-of-NCR message present with no nationwide wording, demo label present, dispatch spies fire on activate/select; assert no lat/lng or GeoJSON inputs.
    - **Acceptance criteria:** Tests pass; keyboard-accessible.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7_
    - _Design: Search Architecture; Testing Strategy (Search flow)_

- [ ] 16. Checkpoint — search experience
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone F — Route preview

- [ ] 17. Implement pure routeFloodContext computation
  - **Objective:** Provide the pure `computeRouteFloodContext` that associates a route's geometry with susceptibility polygons and flood reports via proximity/segment sampling (NOT a routing engine), reusing recency semantics.
  - **Files/components affected:** NEW `src/layers/routeFloodContext.ts`; REUSE `src/layers/floodClassification.ts` (`classifyFloodState`/recency), `src/types/*`, fixtures.
  - **Dependencies/prerequisites:** none (pure module).
  - **Implementation details:** Sample points along the route `LineString`; count a HIGH-susceptibility section when a sampled point falls inside/within a small buffer of a HIGH polygon; `recentReportCount` = reports within a proximity threshold whose age is within the recency window (reuse `classifyFloodState`); `unknownProportion` = (sampled points with neither nearby recent report nor susceptibility coverage) / (total sampled points), always in `[0,1]`. Never emit a safe/clear/score label.
  - **Acceptance criteria:** Returns `{ highSusceptibilitySections, recentReportCount, unknownProportion }`; counts non-negative integers; `unknownProportion ∈ [0,1]`; no safety wording/score.
  - **Verification/checks:** `tsc --noEmit`; eslint; property + unit tests.
  - _Requirements: 6.1, 7.4, 9.6, 9.7_
  - _Design: Route Preview Architecture → route flood-context (pure function)_

  - [ ]* 17.1 Property test: unknownProportion is a valid fraction
    - **Objective:** For any route + susceptibility + reports, `unknownProportion ∈ [0,1]`.
    - **Files/components affected:** NEW `src/layers/routeFloodContext.property.test.ts`.
    - **Implementation details:** `// Feature: baharoute-navigation-experience, Property 5: Unknown proportion is always a valid fraction`; ≥100 iterations.
    - **Validates:** Requirements 9.6.
    - _Design: Correctness Properties → Property 5_

  - [ ]* 17.2 Property test: no reports yields zero count and never a safe/clear label
    - **Objective:** With no in-threshold reports, `recentReportCount === 0` and no safety/score label field exists.
    - **Files/components affected:** EXTEND `src/layers/routeFloodContext.property.test.ts`.
    - **Implementation details:** `// Feature: baharoute-navigation-experience, Property 6: No reports yields zero count and never a "clear"/"safe" label`; ≥100 iterations.
    - **Validates:** Requirements 9.7, 7.4.
    - _Design: Correctness Properties → Property 6_

  - [ ]* 17.3 Property test: high-susceptibility count monotonic in intersecting HIGH polygons
    - **Objective:** Adding an intersecting HIGH polygon never decreases the count; a non-intersecting one leaves it unchanged; count is a non-negative integer.
    - **Files/components affected:** EXTEND `src/layers/routeFloodContext.property.test.ts`.
    - **Implementation details:** `// Feature: baharoute-navigation-experience, Property 7: High-susceptibility section count is monotonic in intersecting HIGH polygons`; ≥100 iterations.
    - **Validates:** Requirements 9.6.
    - _Design: Correctness Properties → Property 7_

- [ ] 18. Implement RoutingProvider with fixture routes
  - **Objective:** Provide the `RoutingProvider` interface and a `FixtureRoutingProvider` using existing route fixtures, producing `RouteWithContext` (with `floodContext`) and a `RoutePlan` (selected + alternatives, possibly empty).
  - **Files/components affected:** NEW `src/services/RoutingProvider.ts`; REUSE `src/data/fixtures/routes.ts` (`routeFixtures`/`routeAlternativeFixture`), `src/layers/routeFloodContext.ts`, `src/types/*`.
  - **Dependencies/prerequisites:** Task 17.
  - **Implementation details:** Define `RouteWithContext` (`route`, `etaSeconds`, `distanceMeters`, `floodContext`, `isDemo: true`) and `RoutePlan`. `FixtureRoutingProvider.plan(origin, destination)` selects one route as dominant, offers the rest as alternatives through the same interface, and attaches `computeRouteFloodContext` results.
  - **Acceptance criteria:** Returns a plan with a selected route and 0+ alternatives; results carry `isDemo`; flood context populated.
  - **Verification/checks:** `tsc --noEmit`; eslint; unit test (incl. alternative-less plan).
  - _Requirements: 9.1, 9.2, 9.6, 9.8, 21.3, 21.4, 21.5_
  - _Design: Route Preview Architecture → RoutingProvider_

  - [ ]* 18.1 Write RoutingProvider unit tests
    - **Objective:** Assert plan shape, demo flag, flood context, and alternative-less plan handling.
    - **Files/components affected:** NEW `src/services/RoutingProvider.test.ts`.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 9.2, 9.6, 9.8_
    - _Design: Route Preview Architecture_

- [ ] 19. Implement RoutePreview and RouteCard components
  - **Objective:** Render the route cards — selected route dominant, alternatives secondary — showing ETA, distance, and flood context, with no safety-score wording and not Google pixel-for-pixel.
  - **Files/components affected:** NEW `src/components/route/RoutePreview.tsx`, `src/components/route/RouteCard.tsx`; EXTEND `src/components/MapView.tsx` (mount in ROUTE_PREVIEW); REUSE markers.
  - **Dependencies/prerequisites:** Tasks 12, 18.
  - **Implementation details:** On ROUTE_PREVIEW entry, render Origin/Destination markers, the selected route (dominant) and alternatives (secondary). `RouteCard` shows ETA, distance, and Route_Flood_Context (high-susceptibility sections, recent report count, unknown proportion). No "Safest"/"Guaranteed Safe"/"100% Safe"/numeric safety score; no Google Maps pixel-for-pixel layout. Rely on Task 11/12 to fit the camera to origin+dest+routes on entry.
  - **Acceptance criteria:** Selected route dominant, alternatives secondary; ETA/distance/flood context shown; no forbidden safety wording; alternative-less plan renders.
  - **Verification/checks:** `tsc --noEmit`; eslint; component tests.
  - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7_
  - _Design: Route Preview Architecture_

  - [ ]* 19.1 Write RoutePreview/RouteCard component tests
    - **Objective:** Assert cards render, flood context shown, no safety wording, and alternative-less plan renders.
    - **Files/components affected:** NEW `src/components/route/route.test.tsx`.
    - **Implementation details:** Inject a fake plan; assert dominant vs secondary styling markers, ETA/distance/flood-context fields, absence of forbidden strings ("safest"/"guaranteed safe"/score), and single-route rendering.
    - **Acceptance criteria:** Tests pass; keyboard-accessible.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 9.2, 9.4, 9.6, 9.7_
    - _Design: Route Preview Architecture; Testing Strategy (Route preview)_

- [ ] 20. Checkpoint — route preview
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone G — START / navigation transition

- [ ] 21. Wire START transition from ROUTE_PREVIEW to NAVIGATION
  - **Objective:** On START in ROUTE_PREVIEW, check position via `requestLocation`; if available dispatch `START_NAVIGATION` + run the tilt/fly/zoom transition + begin follow; if unavailable/denied/timeout stay in ROUTE_PREVIEW with a message and no follow. Guard double-START; cancel/exit returns to prior state with framing restore.
  - **Files/components affected:** EXTEND `src/components/MapView.tsx` (START handler + wiring); REUSE `src/services/geolocation.ts`; consumes Task 10 provider, Task 11 controller, Task 22 follow (follow wiring finalized in Milestone H).
  - **Dependencies/prerequisites:** Tasks 11, 12; provides the transition Milestone H's follow attaches to.
  - **Implementation details:** START handler calls `requestLocation`; on success dispatch `START_NAVIGATION`, set `navTransitionInProgress`, run `applyStateFraming('NAVIGATION', ...)` (flyTo pitch 45–60 / zoom 16–18 within 2000ms), then `START_TRANSITION_DONE`; on failure keep ROUTE_PREVIEW, show "navigation cannot follow your position", no follow. Ignore START while `navTransitionInProgress`. Cancel/exit → `CANCEL_NAVIGATION`/`EXIT_NAVIGATION`, end follow, restore prior framing within 1000ms. Heading fallback and tilt-unsupported 2D fallback handled by the controller.
  - **Acceptance criteria:** Available position → state change + camera + follow-start; unavailable → stay + message + no follow; double-START ignored; cancel returns and ends follow.
  - **Verification/checks:** `tsc --noEmit`; eslint; component tests.
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 12.2, 12.3, 12.4, 12.6, 21.2_
  - _Design: Navigation Mode Architecture (START); Camera Controller_

  - [ ]* 21.1 Write START-transition tests
    - **Objective:** Assert state change + camera + follow-start on available position; position-unavailable path; double-START ignored; cancel returns + ends follow.
    - **Files/components affected:** NEW `src/components/navigation/startTransition.test.tsx`.
    - **Implementation details:** Inject fake geolocation + fake CameraMap + fake follow source; assert flyTo/tilt on success, message + no follow on failure, second START during transition ignored, cancel restores prior framing and stops follow.
    - **Acceptance criteria:** All paths pass without WebGL.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 11.1, 11.2, 11.6, 11.7, 11.8, 21.2_
    - _Design: Testing Strategy (START transition)_

### Milestone H — Location follow architecture

- [ ] 22. Implement locationFollow with production and simulation sources
  - **Objective:** Provide the `PositionWatchSource` interface, a production `BrowserPositionWatch` wrapping `watchPosition`, and a clearly-separate `SimulatedPositionWatch` for dev/demo (never used in production), plus `LocationFollow` start/stop/active.
  - **Files/components affected:** NEW `src/services/locationFollow.ts`; REUSE `src/services/geolocation.ts` (mirrors `requestLocation` result shape).
  - **Dependencies/prerequisites:** none for the module; used by Task 23.
  - **Implementation details:** `FollowUpdate` discriminated union (`position|denied|unavailable|timeout`) mirroring `requestLocation`; `PositionWatchSource.watch(onUpdate) → stop()`; `BrowserPositionWatch` wraps `navigator.geolocation.watchPosition`; `SimulatedPositionWatch` replays a fixture path and is kept separate from production wiring; `LocationFollow.start/stop/active`. Never fabricate GPS in production.
  - **Acceptance criteria:** Follow starts/stops; discriminated updates delivered; production uses browser source; simulation is a separate class.
  - **Verification/checks:** `tsc --noEmit`; eslint; unit tests with a fake source.
  - _Requirements: 13.1, 13.4, 13.5, 21.2, 21.3_
  - _Design: Navigation Mode Architecture → locationFollow_

  - [ ]* 22.1 Write locationFollow unit tests
    - **Objective:** Assert fake source emits positions → callback; denied/unavailable prevents follow; production vs simulation separation.
    - **Files/components affected:** NEW `src/services/locationFollow.test.ts`.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 13.1, 13.4, 13.5, 21.2_
    - _Design: Testing Strategy (Location follow)_

- [ ] 23. Wire follow updates to marker and camera
  - **Objective:** On each position update, move the current-location marker via `MarkerManager` origin and have `CameraController.followUser` maintain nav framing; 2D fallback preserved; no fake production GPS.
  - **Files/components affected:** EXTEND `src/components/MapView.tsx`; REUSE `src/components/markers/markerManager.ts`; consumes Task 11 controller + Task 22 follow.
  - **Dependencies/prerequisites:** Tasks 21, 22.
  - **Implementation details:** On `START_NAVIGATION`, start `LocationFollow` with the production `BrowserPositionWatch`; on `position` update call `MarkerManager.setOrigin` and `CameraController.followUser(pos, heading)`; on denied/unavailable end/prevent follow and surface a degraded-follow message; stop follow on cancel/exit.
  - **Acceptance criteria:** Position updates move marker + maintain camera framing; degraded paths prevent/stop follow; simulation not used in production wiring.
  - **Verification/checks:** `tsc --noEmit`; eslint; component test with a fake `PositionWatchSource`.
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 21.2_
  - _Design: Navigation Mode Architecture (follow)_

  - [ ]* 23.1 Write follow-wiring component tests
    - **Objective:** Assert marker + camera update per position; denied/unavailable prevents follow.
    - **Files/components affected:** NEW `src/components/navigation/followWiring.test.tsx`.
    - **Implementation details:** Fake `PositionWatchSource` emits positions; assert `setOrigin` and `followUser` called per update; assert follow blocked on denied/unavailable.
    - **Acceptance criteria:** Tests pass without WebGL.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 13.1, 13.2, 21.2_
    - _Design: Testing Strategy (Location follow)_

- [ ] 24. Checkpoint — navigation transition and follow
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone I — Navigation UI

- [ ] 25. Implement navigation chrome components
  - **Objective:** Build the navigation UI: next-maneuver banner, trip card, and nav controls; wire the active route and user marker; Exit returns to prior state.
  - **Files/components affected:** NEW `src/components/navigation/NavInstructionBanner.tsx`, `TripCard.tsx`, `NavControls.tsx`; EXTEND `src/components/MapView.tsx` (mount in NAVIGATION); REUSE markers; consumes Task 10 provider, Task 11 controller.
  - **Dependencies/prerequisites:** Tasks 21, 23.
  - **Implementation details:** `NavInstructionBanner` shows the next maneuver from fixture maneuvers (`NavInstruction { road, maneuver, remainingToManeuverMeters }`, e.g. "Continue on Commonwealth Avenue • 1.2 km"). `TripCard` shows ETA, remaining distance, estimated arrival, and Exit. `NavControls` offers recenter, 2D/tilt toggle (via `CameraController.toggle2DTilt`), layers (opens the consumer LayerControl), and a sound placeholder. Keep the selected route + current-location marker visible. Exit dispatches `EXIT_NAVIGATION`.
  - **Acceptance criteria:** Banner, trip card, and controls render during NAVIGATION; Exit returns to prior state; keyboard/accessible.
  - **Verification/checks:** `tsc --noEmit`; eslint; component tests.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 12.5_
  - _Design: Navigation Mode Architecture (nav chrome)_

  - [ ]* 25.1 Write navigation UI component tests
    - **Objective:** Assert banner, trip card (+ Exit returns), and nav controls; keyboard/accessible.
    - **Files/components affected:** NEW `src/components/navigation/navigationUI.test.tsx`.
    - **Implementation details:** Render in NAVIGATION with fake state/controller; assert banner text, trip-card fields, control presence, and Exit dispatch; assert 44×44 touch targets and focusability.
    - **Acceptance criteria:** Tests pass without WebGL.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 14.1, 14.3, 14.4, 14.5_
    - _Design: Testing Strategy (Navigation UI)_

- [ ] 26. Checkpoint — navigation UI
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone J — Flood awareness in navigation

- [ ] 27. Ensure default susceptibility and route-segment flood coloring
  - **Objective:** Keep Flood_Susceptibility visible in OVERVIEW by default (reuse install) and color route segments by `RouteFloodSegment.state` reusing existing color/label helpers.
  - **Files/components affected:** EXTEND `src/components/MapView.tsx` (overview install wiring, route-segment coloring); REUSE `src/layers/floodSusceptibilityLayer.ts` (`installFloodSusceptibility`), `src/layers/visualMapping.ts` (`FLOOD_STATE_COLORS`/`floodStateLabel`), fixtures.
  - **Dependencies/prerequisites:** Milestones A–I.
  - **Implementation details:** On ready with an integrable map, run `installFloodSusceptibility` so OVERVIEW is never a bare basemap; render route segments colored by `RouteFloodSegment.state` reusing `FLOOD_STATE_COLORS` and `floodStateLabel`; keep susceptibility translucent/zoom-faded with roads/labels readable underneath; keep susceptibility (polygons) and current conditions (segments/markers) visually distinct.
  - **Acceptance criteria:** OVERVIEW shows susceptibility (not a bare basemap); route segments colored by state via reused helpers; concepts remain distinct.
  - **Verification/checks:** `tsc --noEmit`; eslint; integration test with fakes/reused install.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3_
  - _Design: Flood Integration_

  - [ ]* 27.1 Write flood-integration tests
    - **Objective:** Assert OVERVIEW is not a bare basemap and route segments are colored by state via reused helpers.
    - **Files/components affected:** NEW `src/components/navigation/floodIntegration.test.tsx` (or extend an integration test).
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 5.1, 5.3, 6.1, 7.2_
    - _Design: Integration tests_

- [ ] 28. Implement FloodAheadNotice
  - **Objective:** Show a non-blocking flood-information-ahead notice during NAVIGATION only when relevant, including distance/road/condition/reported-time/source/verification, marking Community_Report content UNCONFIRMED, offering view-details and view-alternative, and never auto-rerouting from a single unconfirmed report.
  - **Files/components affected:** NEW `src/components/navigation/FloodAheadNotice.tsx`; EXTEND `src/components/MapView.tsx` (mount in NAVIGATION); REUSE `floodClassification`/`visualMapping`/`Disclaimer`, `routeFloodContext`.
  - **Dependencies/prerequisites:** Tasks 17, 25, 27.
  - **Implementation details:** Show only when flood info is relevant to the path ahead; include distance ahead, road, condition, reported time, source, verification status; mark Community_Report content UNCONFIRMED; offer view-details + view-alternative actions; never permanently cover the map; never auto-reroute from one unconfirmed report. Enforce Req 7 vocabulary/labels; keep Unknown as Unknown (never "No Risk"/"Safe"/"Clear").
  - **Acceptance criteria:** Notice shows required fields + UNCONFIRMED; non-blocking; no auto-reroute; correct vocabulary.
  - **Verification/checks:** `tsc --noEmit`; eslint; component tests + wording sweep.
  - _Requirements: 7.2, 7.4, 15.1, 15.2, 15.3, 15.4, 15.5, 19.3_
  - _Design: Flood Integration (flood-information-ahead notice)_

  - [ ]* 28.1 Write FloodAheadNotice + wording-sweep tests
    - **Objective:** Assert fields + UNCONFIRMED + non-blocking + no-auto-reroute, and sweep rendered chrome across states for forbidden strings (safe/safest/clear/no-risk/score); GRAY stays "Unknown".
    - **Files/components affected:** NEW `src/components/navigation/floodAhead.test.tsx`; NEW `src/components/floodWording.test.tsx` (cross-state sweep).
    - **Implementation details:** Render notice with fixture flood info; assert required fields, UNCONFIRMED for community content, view-details/view-alternative actions, and that the notice does not cover the whole map; render each state's chrome and assert absence of forbidden strings and presence of "Unknown"/UNCONFIRMED.
    - **Acceptance criteria:** Tests pass without WebGL.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 7.4, 15.2, 15.4, 15.5, 19.3_
    - _Design: Testing Strategy (Flood-information-ahead, Flood wording sweep)_

- [ ] 29. Checkpoint — flood awareness in navigation
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone K — Responsive polish

- [ ] 30. Extend layout.css for state-driven responsive chrome
  - **Objective:** Add tokens/classes for the search bar, bottom sheets, nav banner, trip card, and layer panel; mobile-first map-dominant with bottom sheets and safe-area handling and no overlapping controls; desktop map-dominant with optional left panel and no permanent sidebar / GIS dashboard.
  - **Files/components affected:** EXTEND `src/styles/layout.css`; class wiring in the search/route/navigation components as needed.
  - **Dependencies/prerequisites:** Milestones B–J (components exist to style).
  - **Implementation details:** Keep the 768px breakpoint, focus ring, safe-area, and 44×44 tokens from Milestone 1. Add classes: mobile floats search at top, route options as bottom sheets/cards, ROUTE_PREVIEW stays map-dominant, NAVIGATION shows banner top + compact bottom trip card, controls thumb-reachable and non-overlapping; desktop keeps map dominant with an optional left panel. No permanent sidebar, no raw checkbox panel, no squeezed desktop layout, no analytics/GIS dashboard.
  - **Acceptance criteria:** Structural classes present per state; CSS honors 768px, safe-area, and 44×44; no forbidden layouts.
  - **Verification/checks:** `tsc --noEmit`; eslint; structural + CSS-contract tests.
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 18.1, 18.2, 18.3_
  - _Design: Responsive Behavior_

  - [ ]* 30.1 Write responsive structural + CSS-contract tests
    - **Objective:** Assert per-state structural classes (search top, bottom sheets, nav banner top, trip card bottom) and the CSS contract (768px, safe-area, 44×44).
    - **Files/components affected:** EXTEND `src/components/responsiveLayout.test.tsx`.
    - **Verification/checks:** `vitest --run`.
    - _Requirements: 17.1, 17.2, 17.4, 17.5, 18.2_
    - _Design: Testing Strategy (Responsive layout)_

- [ ] 31. Checkpoint — responsive polish
  - Ensure all tests pass, typecheck and lint are clean. Ask the user if questions arise.

### Milestone L — Final integration and visual verification

- [ ] 32. Final quality-gate integration checkpoint
  - **Objective:** Confirm the whole feature integrates cleanly and all quality gates pass with Milestone 1 preserved.
  - **Files/components affected:** whole repo (no new production code beyond wiring fixes surfaced by gates).
  - **Dependencies/prerequisites:** Milestones A–K complete.
  - **Implementation details:** Run `tsc --noEmit`, `eslint`, `vitest --run` (all Milestone 1 tests must stay green), and `vite build`. Confirm `.env.local` is ignored and no API key is committed. Fix any integration issues surfaced (no orphaned code; every new module is wired into a consumer).
  - **Acceptance criteria:** Typecheck, lint, full test suite, and production build all pass; `.env.local` ignored; no key committed.
  - **Verification/checks:** `tsc --noEmit`; `eslint`; `vitest --run`; `vite build`; `git check-ignore .env.local`.
  - _Requirements: 20.1, 20.2, 20.3_
  - _Design: Testing Strategy (Smoke / gate)_

- [ ] 33. Final manual browser visual verification (MANUAL — not automatable)
  - **Objective:** Manually verify the visual experience that jsdom/CI cannot cover (requires a real MapTiler key + WebGL).
  - **Files/components affected:** none (manual verification against the running app).
  - **Dependencies/prerequisites:** Task 32.
  - **Implementation details:** This task is explicitly MANUAL and cannot be automated in jsdom/CI. With a valid `VITE_MAPTILER_KEY`, the user runs `npm run dev` in their own terminal and checks: default Metro Manila framing (NCR dominant, 17 cities in view, provinces only at edges, no hard clip); search-first UX ("Where are you going?", NCR results first, honest out-of-NCR message); route preview (selected dominant, alternatives secondary, ETA/distance/flood context, no safety-score wording); START transition (tilt pitch 45–60, zoom 16–18, follows); tilted/2D navigation toggle; flood visibility (translucent susceptibility over readable basemap, distinct concepts); mobile behavior (map-dominant, thumb-reachable, safe-area, no overlap).
  - **Acceptance criteria:** All checklist items visually confirmed by the user against the running app.
  - **Verification/checks:** Manual browser walkthrough per the design's Visual Verification Strategy. (Do not run the dev server as part of automation — the user runs it manually.)
  - _Requirements: 1, 8, 9, 11, 12, 13, 14, 15, 5, 6, 17, 19, 20_
  - _Design: Visual Verification Strategy (manual)_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Property-test sub-tasks live next to the pure logic they validate (`appState.ts`, `GeocodingProvider.ts` ranking, `routeFloodContext.ts`), are tagged `// Feature: baharoute-navigation-experience, Property N: ...`, and run at minimum 100 iterations with fast-check.
- Each task references specific requirement sub-clauses and the design section it implements for traceability.
- Milestones are ordered dependency-safe (A first). Checkpoints between milestones validate incrementally and require all Milestone 1 tests to stay green.
- Preservation is a first-class goal: REUSE unchanged, EXTEND additively, REDESIGN only `LayerControl`, and NEW modules behind interfaces — no unnecessary rewrites.
- Scope guards: Metro Manila / NCR only (no nationwide support); no "safe route"/"safest"/"guaranteed safe"/arbitrary numeric safety score; GRAY "Unknown" never becomes "No Risk"/"Safe"/"Clear"; Community_Report content marked UNCONFIRMED; routing/geocoding/flood are demo-labeled fixtures behind interfaces; production never fabricates GPS.
- Task 33 is explicitly manual and requires a real MapTiler key + WebGL; it is not part of the automated suite. Long-running commands (`npm run dev`) are run manually by the user, not by automation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "9.1", "9.2", "9.3", "9.4", "14.1", "17.1", "17.2", "17.3", "22.1"] },
    { "id": 1, "tasks": ["2.1", "11.1", "18.1"] },
    { "id": 2, "tasks": ["3.1", "6.1"] },
    { "id": 3, "tasks": ["7.1", "15.1", "19.1"] },
    { "id": 4, "tasks": ["21.1", "23.1", "25.1"] },
    { "id": 5, "tasks": ["27.1", "28.1", "30.1"] }
  ]
}
```
