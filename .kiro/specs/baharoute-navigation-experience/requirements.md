# Requirements Document

## Introduction

BahaRoute is a Metro Manila / National Capital Region (NCR) flood-aware travel decision-support application whose purpose is to help users **compare** travel routes alongside available flood information so they can make their own informed decisions. BahaRoute never guarantees that any route is safe; the user always remains the decision maker.

This specification covers the **Navigation Experience** milestone. It **extends and builds on top of the completed, verified Milestone 1 foundation** (`baharoute-metro-manila-map-foundation`), which delivered the React 18 + TypeScript + Vite application, the MapLibre GL JS rendering core, the env-based Tile_Provider API key, the custom quiet BahaRoute basemap, the flood data models (Flood_State RED/ORANGE/YELLOW/GREEN/GRAY, Flood_Susceptibility vs Flood_Report vs Community_Report, Flood_Item_Metadata, the 21,600s default recency window), the DataLayer/DataSource abstraction with FixtureDataSource and isolated demo fixtures, the LayerRegistry fixed z-order, the translucent zoom-faded susceptibility rendering and FloodPopup, the MapManager (init/destroy, 15s tile watchdog, resize, zoom clamp, recenter), the Metro_Manila_Extent, the controls (Location/Recenter/Zoom/Layer), the origin/destination markers, the overlays, the responsive 768px layout, and the accessibility work.

This milestone is a **UX-correction and evolution**: it turns the Milestone 1 "map foundation" into a polished, Metro Manila-first, flood-aware **navigation application**. It does **not** restate Milestone 1; where behavior is inherited, requirements below reference the corresponding Milestone 1 requirement (e.g. "Milestone 1 Req 2"). This document adds only the **new** requirements for default NCR framing, a navigation-app shell, destination search, route preview, explicit application/camera states, a follow-mode navigation view, a consumer-grade layer control, refined responsive behavior, a cohesive visual identity, and preservation constraints.

The **tech stack is fixed**: real React 18 + TypeScript + MapLibre GL JS, not pseudocode. All new capabilities build on the existing components and interfaces.

**Explicitly out of scope for this milestone** (and therefore stubbed or fixture-backed behind interfaces so real providers can replace them later): a real turn-by-turn routing engine, real GPS-driven movement, real geocoding, and live flood data sources. Routing, geocoding, and live-flood behavior are supplied by fixtures/stubs behind the DataLayer/DataSource abstraction (or an equivalent interface); the app must not invent authoritative routing/geocoding/flood APIs and must clearly treat demo route/geocode data as demo. A development/demo movement simulation mode may exist, but production must not fake GPS.

## Glossary

Terms defined in Milestone 1 are reused unchanged and referenced here without redefinition: **BahaRoute**, **Map_Application**, **Map_Renderer**, **Basemap_Style**, **NCR**, **Metro_Manila_Extent**, **Tile_Provider**, **API_Key**, **Location_Control**, **Recenter_Control**, **Layer_Control**, **Current_Location_Marker**, **Origin_Marker**, **Destination_Marker**, **Flood_State** (RED/ORANGE/YELLOW/GREEN/GRAY), **Flood_Susceptibility**, **Flood_Report**, **Community_Report**, **Flood_Item_Metadata**, **Fixture_Data**, **Data_Layer**, **Touch_Target**.

New terms introduced by this milestone:

- **App_State**: The application's explicit top-level interaction mode. Exactly one App_State is active at a time. Valid values: OVERVIEW, SEARCH, ROUTE_PREVIEW, NAVIGATION.
- **Overview_State**: The App_State entered on open, framing Metro Manila for browsing flood awareness before a destination is chosen.
- **Search_State**: The App_State active while the user is entering or selecting a destination via Destination_Search.
- **Route_Preview_State**: The App_State active after a destination is selected, showing origin, destination, the selected Route, and any alternatives before navigation begins.
- **Navigation_State**: The App_State active after START, in which the map follows the user's position with navigation chrome.
- **Camera_Controller**: The component that moves the Map_Renderer camera (center, zoom, pitch, bearing) predictably according to the current App_State and camera behavior, without unrequested zoom changes.
- **Camera_Behavior**: A named camera mode the Camera_Controller applies. Valid values: RECENTER, 2D_OVERVIEW, NAVIGATION_TILT.
- **Destination_Search**: The navigation-style control that lets a user choose a Metro Manila destination by name or place rather than by coordinates or identifiers.
- **Route**: A single travel path from origin to destination, carrying geometry, an estimated time of arrival (ETA), a distance, and a Route_Flood_Context. (Extends the Milestone 1 `Route` type.)
- **Route_Alternative**: A Route offered alongside the selected Route as a secondary option.
- **Route_Flood_Context**: The flood-awareness summary attached to a Route: counts of high-susceptibility sections, count of recent flood reports along the Route, and the proportion (percentage or length) of the Route whose current condition is Unknown.
- **Nav_Instruction**: The next-maneuver guidance shown during Navigation_State (e.g. a road name and remaining distance to the maneuver).
- **Location_Follow**: The behavior, active during Navigation_State, of continuously updating the map to track the user's changing position using continuous geolocation.
- **Tilt_Mode**: The tilted-perspective camera used during navigation (non-zero pitch, heading-oriented bearing, street-level zoom). Equivalent to Camera_Behavior NAVIGATION_TILT.
- **2D_Mode**: The top-down, north-up camera used for overview and preview. Equivalent to Camera_Behavior 2D_OVERVIEW.
- **Routing_Provider**: The interface that supplies Route and Route_Alternative data. For this milestone it is fixture/stub-backed and clearly demo.
- **Geocoding_Provider**: The interface that resolves a Destination_Search query to a place and location. For this milestone it is fixture/stub-backed and clearly demo.

## Requirements

### Requirement 1: Default Metro Manila Framing on Open

**User Story:** As a Metro Manila commuter opening BahaRoute, I want the app to open framed on Metro Manila so that the NCR is immediately the visual focus.

#### Acceptance Criteria

1. WHEN the Map_Application starts, THE Map_Application SHALL enter the Overview_State.
2. WHEN the Overview_State is entered, THE Camera_Controller SHALL frame the Map_Renderer on a tuned NCR overview bounding box so that Metro Manila is centered and occupies the majority of the usable viewport area.
3. WHEN the Overview_State is framed, THE Map_Renderer SHALL keep the seventeen NCR cities within the viewport.
4. WHERE surrounding provinces (Bulacan, Rizal, Cavite, Laguna) are visible in the Overview_State, THE Map_Renderer SHALL render them only at the viewport edges such that no surrounding province occupies more viewport area than the NCR.
5. THE Map_Application SHALL NOT frame the Overview_State at a nationwide or multi-region scale.
6. THE Basemap_Style SHALL continue to render map content beyond the NCR overview bounding box and SHALL NOT hard-clip the base map exactly at the NCR boundary.

### Requirement 2: Preserve Overview Framing When Location Is Available

**User Story:** As a user who has granted location access, I want to see where I am without being zoomed into my street on open, so that I keep the Metro Manila overview.

#### Acceptance Criteria

1. WHERE geolocation permission is already granted at startup, THE Map_Application SHALL place the Current_Location_Marker at the detected position.
2. WHILE the Overview_State is active on first load, THE Camera_Controller SHALL NOT auto-zoom to the user's street-level position.
3. THE Map_Application SHALL preserve the Overview_State framing until the user activates the Recenter_Control, begins destination selection, or presses START.
4. IF geolocation permission is denied, unavailable, or times out, THEN THE Map_Application SHALL keep the Overview_State framed on the NCR overview bounding box and interactive (consistent with Milestone 1 Req 6 and Req 18).

### Requirement 3: Navigation-App Map Shell

**User Story:** As a user, I want the map to fill the screen with restrained navigation chrome, so that the app reads as a navigation tool rather than a demo.

#### Acceptance Criteria

1. THE Map_Application SHALL render the Map_Renderer as the dominant full-screen visual element.
2. THE Map_Application SHALL NOT reserve a large blank header area above the map.
3. THE Map_Application SHALL NOT display an oversized "BahaRoute" heading and SHALL present product identity only as restrained navigation chrome.
4. THE Map_Application SHALL present all primary controls as intentionally styled floating controls with rounded shapes rather than browser-default control styling.

### Requirement 4: No Developer-Facing Controls or Terminology in the Primary UI

**User Story:** As a normal user, I want to see only human-readable controls and labels, so that the interface is not cluttered with developer or debug details.

#### Acceptance Criteria

1. THE Map_Application SHALL NOT display a raw checkbox list of layers in the primary UI.
2. THE Map_Application SHALL NOT display plain "On"/"Off" text as the layer-state affordance in the primary UI.
3. THE Map_Application SHALL NOT display developer or debug terminology or internal identifiers (for example "routeFloodSegments", "fixture source", or "demo geometry") in the primary UI.
4. THE Map_Application SHALL present every user-facing layer and control using a human-readable label.

### Requirement 5: Flood Awareness Visible by Default

**User Story:** As a user, I want flood information visible as soon as the app opens, so that the flood-awareness purpose is immediately clear.

#### Acceptance Criteria

1. WHEN the Overview_State is entered, THE Map_Renderer SHALL display the navigation basemap together with the Flood_Susceptibility layer rendered as a semi-transparent, zoom-dependent overlay (reusing Milestone 1 translucent zoom-faded behavior).
2. WHILE the Flood_Susceptibility overlay is displayed in the Overview_State, THE Map_Renderer SHALL keep roads, waterways, city labels, and boundaries readable underneath the overlay.
3. THE Map_Application SHALL NOT enter the Overview_State with all flood layers disabled such that only a plain basemap is shown.
4. WHERE current or recent flood information is available, THE Map_Renderer SHALL display that current/recent information in the Overview_State in addition to Flood_Susceptibility.

### Requirement 6: Susceptibility and Current Conditions Remain Distinct

**User Story:** As a user weighing risk, I want historical susceptibility to look different from current conditions, so that I do not confuse modeled exposure with reported flooding.

#### Acceptance Criteria

1. THE Map_Renderer SHALL render Flood_Susceptibility as translucent polygons and SHALL render current/recent conditions as road segments or markers, so that the two concepts are visually distinct.
2. THE Map_Application SHALL treat Flood_Susceptibility and current/recent Flood_Report data as distinct concepts (consistent with Milestone 1 Req 12.2).
3. THE Map_Renderer SHALL NOT use administrative city boundaries as flood-risk polygons unless the flood dataset supplies those geometries.

### Requirement 7: Flood State Vocabulary and Labels

**User Story:** As a user, I want clear, consistent flood-state labels, so that I understand what each color means and know that absence of a report is not safety.

#### Acceptance Criteria

1. THE Map_Application SHALL label Flood_Susceptibility states as RED "High", ORANGE "Moderate", and YELLOW "Low".
2. THE Map_Application SHALL label current/recent Flood_State values as RED "Flooding Reported", ORANGE "Elevated Exposure — Caution", YELLOW "Caution", GREEN "Recently Reported Passable", and GRAY "Unknown".
3. THE Map_Application SHALL assign GREEN "Recently Reported Passable" only when passability evidence exists and is within the recency window (consistent with Milestone 1 Req 12.6).
4. WHERE current flood information for a location is absent, THE Map_Application SHALL represent that location as GRAY "Unknown" and SHALL NOT represent it as "No Risk", "Safe", or "Clear" (consistent with Milestone 1 Req 13.4).

### Requirement 8: Destination Search

**User Story:** As a user, I want to search for where I am going by name, so that I can pick a Metro Manila destination without knowing coordinates.

#### Acceptance Criteria

1. THE Map_Application SHALL present a prominent navigation-style Destination_Search with prompt text such as "Where are you going?" over the map.
2. THE Destination_Search SHALL let the user select a Metro Manila destination without entering latitude/longitude, raw GeoJSON, or internal route identifiers.
3. WHEN the Destination_Search returns results, THE Map_Application SHALL prioritize Metro Manila destinations ahead of destinations outside the NCR.
4. IF the user searches for a destination far outside the NCR, THEN THE Map_Application SHALL display a message that BahaRoute's flood-aware coverage is focused on Metro Manila and SHALL NOT claim nationwide coverage.
5. WHEN the user activates the Destination_Search, THE Map_Application SHALL enter the Search_State.
6. WHEN the user selects a destination, THE Map_Application SHALL transition from the Search_State (or Overview_State) to the Route_Preview_State.
7. THE Geocoding_Provider that resolves Destination_Search queries SHALL be fixture/stub-backed for this milestone, and THE Map_Application SHALL treat its results as demo data (consistent with Milestone 1 Req 15).

### Requirement 9: Route Preview

**User Story:** As a user, I want to preview my route with alternatives and flood context before I start, so that I can choose which way to go.

#### Acceptance Criteria

1. WHEN the Route_Preview_State is entered, THE Map_Renderer SHALL display the Origin_Marker, the Destination_Marker, a selected Route, and any Route_Alternative(s).
2. WHERE no Route_Alternative data is available, THE Map_Application SHALL display the selected Route and SHALL keep the architecture prepared to display Route_Alternative(s) through the same interface.
3. WHEN the Route_Preview_State is entered, THE Camera_Controller SHALL fit the camera to the combined extent of the origin, the destination, and the displayed Route(s) rather than remaining at the Overview_State framing.
4. THE Map_Renderer SHALL render the selected Route as visually dominant and any Route_Alternative(s) as visible but secondary.
5. THE Map_Application SHALL NOT reproduce Google Maps assets, icons, or layout pixel-for-pixel.
6. THE Map_Application SHALL display, for each Route, its ETA, its distance, and its Route_Flood_Context including the count of high-susceptibility sections, the count of recent flood reports along the Route, and the proportion of the Route whose current condition is Unknown.
7. THE Map_Application SHALL NOT display "Safest Route", "Guaranteed Safe", "100% Safe", or any arbitrary numeric safety score for a Route (consistent with Milestone 1 Req 13.1, 13.2).
8. THE Routing_Provider that supplies Route and Route_Alternative data SHALL be fixture/stub-backed for this milestone, and THE Map_Application SHALL treat its results as demo data (consistent with Milestone 1 Req 15).

### Requirement 10: Explicit Application States and Predictable Camera

**User Story:** As a user, I want the app to move through clear states with predictable camera behavior, so that the view never jumps around unexpectedly.

#### Acceptance Criteria

1. WHEN the Map_Application starts, THE Map_Application SHALL set the initial App_State to OVERVIEW.
2. THE Map_Application SHALL implement exactly the App_States OVERVIEW, SEARCH, ROUTE_PREVIEW, and NAVIGATION, with exactly one App_State active at a time.
3. THE Camera_Controller SHALL support the Camera_Behaviors RECENTER, 2D_OVERVIEW (north-up top-down), and NAVIGATION_TILT (tilted).
4. WHEN the App_State changes, THE Camera_Controller SHALL move the camera to the framing defined for the new App_State within 1000 milliseconds and SHALL NOT change the zoom to a value other than the one defined by that framing.
5. THE Camera_Controller SHALL be the single component that changes the Map_Renderer camera center, zoom, pitch, and bearing during App_State transitions.
6. WHEN a transition targets the App_State that is already active, THE Map_Application SHALL retain that App_State and THE Camera_Controller SHALL NOT change the camera.
7. WHEN the App_State returns to a previously visited App_State, THE Camera_Controller SHALL apply the same framing rules defined for that App_State's first entry.

### Requirement 11: Start Navigation Transition

**User Story:** As a user ready to travel, I want pressing START to take me into a navigation view centered on me, so that I can begin following my route.

#### Acceptance Criteria

1. WHEN the user presses START WHILE in the Route_Preview_State, THE Map_Application SHALL transition to the Navigation_State.
2. WHEN the Navigation_State is entered, THE Camera_Controller SHALL animate the camera toward the user's current position within 2000 milliseconds, apply the NAVIGATION_TILT Camera_Behavior, and set a street-level zoom between 16 and 18.
3. WHILE the Navigation_State is active, THE Map_Renderer SHALL keep the selected Route visible.
4. WHEN the Navigation_State is entered, THE Map_Application SHALL display the Nav_Instruction UI and begin Location_Follow.
5. WHEN the Navigation_State is entered, THE Camera_Controller SHALL NOT leave the camera at the Metro Manila overview framing.
6. IF the user's current position is unavailable when START is pressed, THEN THE Map_Application SHALL remain in the Route_Preview_State, display a message indicating that navigation cannot follow the user's position, and SHALL NOT enter Location_Follow (consistent with Milestone 1 Req 6 and Req 18).
7. WHEN START is pressed again WHILE the transition to the Navigation_State is in progress, THE Map_Application SHALL ignore the additional press and SHALL NOT restart the transition.
8. WHEN the user cancels navigation, THE Map_Application SHALL return to the Route_Preview_State, end Location_Follow, and restore the Route_Preview_State framing within 1000 milliseconds.

### Requirement 12: 2D and Tilted Navigation Camera

**User Story:** As a user, I want a tilted driving-style view during navigation and a flat view otherwise, so that the perspective matches what I am doing.

#### Acceptance Criteria

1. WHILE the App_State is OVERVIEW, SEARCH, or ROUTE_PREVIEW, THE Camera_Controller SHALL keep the camera in 2D_Mode (top-down, north-up).
2. WHILE the Navigation_State is active, THE Camera_Controller SHALL support Tilt_Mode with a camera pitch between 45 and 60 degrees and a street-level zoom.
3. WHERE device heading is available during the Navigation_State, THE Camera_Controller SHALL orient the camera bearing to the user's or route's heading.
4. IF device heading is unavailable during the Navigation_State, THEN THE Camera_Controller SHALL orient the camera bearing to the route direction, or to north-up when route direction is unavailable.
5. THE Map_Application SHALL provide a control that switches the camera between 2D_Mode and Tilt_Mode.
6. IF tilt is unsupported by the current environment, THEN THE Camera_Controller SHALL keep the camera in 2D_Mode and SHALL NOT force a tilt.

### Requirement 13: Location Follow and Movement

**User Story:** As a user in navigation, I want the map to follow me as I move, so that my position and remaining trip stay current.

#### Acceptance Criteria

1. WHILE the Navigation_State is active, THE Map_Application SHALL track the user's position using continuous geolocation (watchPosition or an equivalent continuous source).
2. WHEN the user's tracked position changes, THE Map_Application SHALL update the Current_Location_Marker position, keep the selected Route and destination direction visible, and maintain the Navigation_State zoom, pitch, and bearing.
3. WHERE trip-progress data is available, THE Map_Application SHALL update the remaining distance, ETA, and trip progress as the user's position changes.
4. THE Map_Application SHALL NOT fabricate GPS positions in production.
5. WHERE a development or demo movement simulation mode is enabled, THE Map_Application SHALL drive Location_Follow from simulated positions and SHALL keep that mode separate from production behavior.

### Requirement 14: Navigation UI

**User Story:** As a user navigating, I want a clear next-maneuver banner, a trip card, and reachable controls, so that I can follow directions at a glance.

#### Acceptance Criteria

1. WHILE the Navigation_State is active, THE Map_Application SHALL display a top next-maneuver area showing the Nav_Instruction (for example "Continue on Commonwealth Avenue • 1.2 km").
2. WHILE the Navigation_State is active, THE Map_Renderer SHALL display the Current_Location_Marker, the selected Route, the Route_Flood_Context, and the destination direction.
3. WHILE the Navigation_State is active, THE Map_Application SHALL display floating controls for recenter, 2D/tilt toggle, layers, and a sound placeholder.
4. WHILE the Navigation_State is active, THE Map_Application SHALL display a compact bottom card showing ETA, remaining distance, estimated arrival, and an Exit-navigation action.
5. WHEN the user activates Exit-navigation, THE Map_Application SHALL leave the Navigation_State and return to the Route_Preview_State or the Overview_State.

### Requirement 15: Flood-Information-Ahead During Navigation

**User Story:** As a user driving toward a flood, I want a relevant heads-up with details, so that I can decide what to do without being forced into a reroute.

#### Acceptance Criteria

1. WHILE the Navigation_State is active, THE Map_Application SHALL display a flood-information-ahead notice only when flood information is relevant to the path ahead.
2. WHEN a flood-information-ahead notice is displayed, THE Map_Application SHALL include the distance ahead, the road, the condition, the reported time, the source, and the verification status, marking Community_Report content as UNCONFIRMED (consistent with Milestone 1 Req 14).
3. WHEN a flood-information-ahead notice is displayed, THE Map_Application SHALL offer a view-details action and a view-alternative action.
4. THE flood-information-ahead notice SHALL NOT permanently cover the map.
5. THE Map_Application SHALL NOT automatically reroute based solely on a single unconfirmed Community_Report.

### Requirement 16: Consumer-Grade Layer Control

**User Story:** As a user, I want a compact, readable layer control that stays out of the way, so that I can adjust layers without a cluttered checkbox panel.

#### Acceptance Criteria

1. THE Map_Application SHALL replace the raw checkbox layer list with a compact navigation-style layer control (consistent with the Layer_Control interface from Milestone 1 Req 9).
2. THE layer control SHALL open only when the user requests it and SHALL NOT remain permanently displayed over the map.
3. THE layer control SHALL present each layer using a human-readable label such as "Flood susceptibility", "Recent flood reports", "Community reports", or "Evacuation centers", and SHALL NOT display internal identifiers.
4. WHEN the Overview_State is entered, THE layer control SHALL show the Flood_Susceptibility layer as visible, together with relevant current flood information where available.
5. WHERE optional layers (community reports, evacuation centers, detailed route layers) exist, THE Map_Application MAY start those layers hidden by default.

### Requirement 17: Mobile-First Responsive Layout

**User Story:** As a mobile user, I want a map-dominant layout with thumb-reachable controls, so that I can use BahaRoute one-handed.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768 CSS pixels, THE Map_Application SHALL size the Map_Renderer to occupy nearly the full screen.
2. WHILE the viewport width is less than 768 CSS pixels, THE Map_Application SHALL float the Destination_Search at the top and present route options as bottom sheets or cards.
3. WHILE the viewport width is less than 768 CSS pixels AND the Route_Preview_State is active, THE Map_Application SHALL keep the layout map-dominant.
4. WHILE the viewport width is less than 768 CSS pixels AND the Navigation_State is active, THE Map_Application SHALL display the Nav_Instruction at the top and the ETA/remaining-distance card as a compact bottom card.
5. WHILE the viewport width is less than 768 CSS pixels, THE Map_Application SHALL place floating controls within thumb reach, respect safe-area insets, and SHALL NOT overlap controls (consistent with Milestone 1 Req 10).
6. THE Map_Application SHALL NOT display a permanent sidebar, a raw checkbox panel, or a desktop layout squeezed into a phone viewport.

### Requirement 18: Desktop Layout

**User Story:** As a desktop user, I want a larger map with an optional side panel, so that I have room to read routes while the map stays central.

#### Acceptance Criteria

1. WHILE the viewport width is 768 CSS pixels or greater, THE Map_Application MAY display a left panel for search and route options alongside a large map.
2. WHILE the viewport width is 768 CSS pixels or greater, THE Map_Application SHALL keep the Map_Renderer as the dominant element.
3. THE Map_Application SHALL NOT present an analytics or GIS dashboard layout.

### Requirement 19: Cohesive Visual Identity and Safety Framing

**User Story:** As a user, I want a clean, distinct BahaRoute look that never promises safety, so that the app feels trustworthy and its own.

#### Acceptance Criteria

1. THE Map_Application SHALL present a transport/navigation visual system with a light neutral map, clear route colors, restrained chrome, rounded floating controls, compact bottom sheets, readable contrast, and controlled flood colors.
2. THE Map_Application SHALL NOT copy Google Maps branding, icons, or layout, and SHALL NOT reproduce a MapLibre demo appearance or a GIS dashboard appearance.
3. THE Map_Application SHALL preserve the Milestone 1 safety-framing constraints: no safety guarantee, no arbitrary safety score, GRAY "Unknown" never becomes "No Risk", and Community_Report content is marked UNCONFIRMED (consistent with Milestone 1 Req 13 and Req 14).

### Requirement 20: Preserve Milestone 1 Functionality and Quality Gates

**User Story:** As a maintainer, I want this correction to keep Milestone 1 working and to pass all quality gates, so that nothing regresses.

#### Acceptance Criteria

1. THE Map_Application SHALL preserve the Milestone 1 functionality, data models, tests, accessibility work, and env handling.
2. THE Map_Application SHALL pass TypeScript type checking, linting, the test suite, and a production build.
3. THE Map_Application SHALL NOT commit an API_Key to source control and SHALL keep `.env.local` ignored (consistent with Milestone 1 Req 17).

### Requirement 21: Graceful Degradation and Stubbed Providers

**User Story:** As a user in imperfect conditions, I want the app to degrade gracefully and to be honest that route and flood data are demo, so that I still get a usable, trustworthy experience.

#### Acceptance Criteria

1. IF geolocation is denied, unavailable, or times out, THEN THE Map_Application SHALL keep a usable Overview_State (consistent with Milestone 1 Req 6 and Req 18).
2. IF geolocation is denied, unavailable, or times out, THEN THE Map_Application SHALL prevent entry into Location_Follow and SHALL communicate that navigation cannot follow the user's position.
3. THE Map_Application SHALL supply routing, geocoding, and live-flood data through fixture-backed or stub-backed implementations behind interfaces so that real providers can replace them without changing consuming components (consistent with Milestone 1 Req 15.3).
4. THE Map_Application SHALL NOT invent authoritative routing, geocoding, or flood APIs (consistent with Milestone 1 Req 15.5).
5. WHEN demo route or geocode data is displayed, THE Map_Application SHALL clearly identify that content as demo data (consistent with Milestone 1 Req 15.2, 15.4).
