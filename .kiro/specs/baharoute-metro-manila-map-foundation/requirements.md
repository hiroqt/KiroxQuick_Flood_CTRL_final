# Requirements Document

## Introduction

BahaRoute is a Metro Manila / National Capital Region (NCR) flood-aware travel decision-support application. Its purpose is to help users **compare** travel routes alongside available flood information so they can make their own informed decisions. BahaRoute does **not** guarantee that any route is safe, and the user always remains the decision maker.

This specification covers **Milestone 1: Custom Metro Manila Map Foundation** — a polished, production-quality-looking, interactive, customized Metro Manila (NCR only) navigation map that serves as the foundation for future flood-aware routing capabilities. The map itself must be visually quiet so that flood information (added in later milestones) can be the prominent, foreground concern.

This milestone delivers the interactive map experience and prepares the architecture (data models, layer scaffolding, isolated fixtures) for future layers — flood susceptibility polygons, current/recent flood reports, community reports, route geometry and alternatives, route flood segments, evacuation centers, and turn-by-turn navigation — **without** implementing a full routing engine, nationwide support, or AI-based routing.

The recommended and adopted greenfield stack is React + TypeScript + Vite with MapLibre GL JS, using OpenStreetMap-derived vector tiles from a provider (e.g. MapTiler) rendered through a custom quiet BahaRoute basemap style. API keys are supplied via environment configuration and are never hardcoded or committed.

Google Maps and modern navigation applications serve as **interaction inspiration only**. BahaRoute must not clone their assets, icons, or branding, nor imply any affiliation.

## Glossary

- **BahaRoute**: The flood-aware travel decision-support application described by this specification.
- **Map_Application**: The React + TypeScript client application that renders and manages the interactive map.
- **Map_Renderer**: The MapLibre GL JS map instance responsible for rendering vector tiles and layers.
- **Basemap_Style**: The custom "quiet" BahaRoute MapLibre style definition that controls the visual appearance of the base map (roads, labels, boundaries, land, water).
- **NCR**: National Capital Region of the Philippines, comprising the cities of Caloocan, Las Piñas, Makati, Malabon, Mandaluyong, Manila, Marikina, Muntinlupa, Navotas, Parañaque, Pasay, Pasig, Pateros, Quezon City, San Juan, Taguig, and Valenzuela. The complete geographic scope of BahaRoute for this milestone.
- **Metro_Manila_Extent**: The predefined default geographic bounding box that frames the NCR.
- **Tile_Provider**: The external vector-tile service (e.g. MapTiler) that supplies OpenStreetMap-derived map data.
- **API_Key**: The credential used to authenticate requests to the Tile_Provider, supplied via environment configuration.
- **Location_Control**: The user-facing map control that requests and displays the user's current geographic location.
- **Recenter_Control**: The user-facing map control that returns the map view to the Metro_Manila_Extent.
- **Layer_Control**: The user-facing control that lists toggleable map layers and forms the foundation for future flood/route layers.
- **Current_Location_Marker**: The map marker representing the user's detected current position.
- **Origin_Marker**: The map marker representing a route's starting point.
- **Destination_Marker**: The map marker representing a route's ending point.
- **Flood_State**: A classification applied to a location or segment describing reported flood conditions. Valid values are: RED (Reported Flooding), ORANGE (Elevated Flood Exposure), YELLOW (Caution), GREEN (Recently Reported Passable), and GRAY (Unknown).
- **Flood_Susceptibility**: Historical or modeled likelihood of flooding for an area. Conceptually distinct from reported current conditions.
- **Flood_Report**: A record of current or recent reported flood conditions at a location, carrying source and timestamp metadata.
- **Community_Report**: A Flood_Report originating from a non-authoritative community source, marked UNCONFIRMED unless verified.
- **Flood_Item_Metadata**: The metadata carried by any flood-related data item: location, source, data type, updated_at, verification status, severity, depth (if available), description, and source URL (when appropriate).
- **Fixture_Data**: Demo/sample data used during development in place of real external APIs, clearly labeled and isolated for later replacement.
- **Data_Layer**: An architectural component that supplies a category of map data (e.g. flood susceptibility, flood reports, routes, evacuation centers) to the Map_Application.
- **Touch_Target**: An interactive UI element sized for reliable finger interaction on touch devices.

## Requirements

### Requirement 1: Load the Interactive Metro Manila Map

**User Story:** As a Metro Manila commuter, I want an interactive map to load centered on the NCR, so that I have a foundation for comparing travel routes.

#### Acceptance Criteria

1. WHEN the Map_Application starts, THE Map_Renderer SHALL initialize using the custom Basemap_Style.
2. WHEN the Map_Renderer initializes, THE Map_Application SHALL frame the viewport on the full Metro_Manila_Extent with the map center inside that extent.
3. THE Map_Application SHALL restrict the default map framing to the NCR and SHALL NOT frame the initial view on areas outside Metro Manila.
4. WHEN vector tiles are successfully retrieved from the Tile_Provider, THE Map_Renderer SHALL render the base map within the visible viewport.
5. WHILE the base map tiles are loading, THE Map_Application SHALL display a loading indicator, and WHEN the base map has rendered, THE Map_Application SHALL dismiss the loading indicator.
6. IF the base map tiles have not loaded within 15 seconds, THEN THE Map_Application SHALL display a message that the map could not load and SHALL NOT crash.

### Requirement 2: Custom Quiet BahaRoute Basemap Style

**User Story:** As a user comparing flood conditions, I want the base map to look visually quiet, so that flood information added later stands out as the prominent concern.

#### Acceptance Criteria

1. THE Basemap_Style SHALL render land, water, roads, boundaries, and labels using base feature colors whose saturation does not exceed 30%.
2. THE Basemap_Style SHALL reserve saturated colors (saturation greater than 30%) for flood information layers and SHALL NOT apply those reserved colors to base map features.
3. THE Basemap_Style SHALL be defined as a MapLibre GL JS style asset within the Map_Application source so that its appearance can be modified without changing rendering logic.
4. WHERE the Tile_Provider supplies OpenStreetMap-derived data, THE Basemap_Style SHALL present that data through the custom BahaRoute appearance rather than a default provider appearance.
5. THE Map_Application SHALL NOT copy, embed, or reproduce assets, icons, or branding from Google Maps or other navigation applications.

### Requirement 3: City Boundaries and Place Labels

**User Story:** As a user navigating the NCR, I want to see city boundaries and place labels, so that I can orient myself within Metro Manila.

#### Acceptance Criteria

1. WHERE city boundary data for the NCR is available, THE Map_Renderer SHALL display city boundaries for the seventeen NCR jurisdictions named in the Glossary.
2. THE Map_Renderer SHALL display city and place labels for locations within the Metro_Manila_Extent.
3. IF city boundary data is unavailable, THEN THE Map_Application SHALL render the map without boundaries, keep the map interactive, and SHALL NOT display an error to the user.
4. THE Map_Renderer SHALL render place labels using the low-contrast treatment defined by the Basemap_Style.

### Requirement 4: Road Hierarchy Rendering

**User Story:** As a user planning a trip, I want roads shown by their importance, so that I can distinguish major routes from minor streets.

#### Acceptance Criteria

1. THE Map_Renderer SHALL render roads in three hierarchy tiers: minor roads, major roads, and expressways.
2. THE Basemap_Style SHALL render each road hierarchy tier with a distinct, ordered line width such that expressways are wider than major roads and major roads are wider than minor roads.
3. WHEN the user changes the zoom level, THE Map_Renderer SHALL adjust which road hierarchy tiers are visible according to per-tier minimum zoom levels defined by the Basemap_Style.

### Requirement 5: Pan, Zoom, and Responsive Resizing

**User Story:** As a user exploring the map, I want to pan, zoom, and have the map fit my screen, so that I can inspect areas of interest on any device.

#### Acceptance Criteria

1. WHEN the user performs a pan gesture or drag, THE Map_Renderer SHALL translate the map view to follow the gesture.
2. WHEN the user performs a zoom gesture, scroll, or activates a zoom control, THE Map_Renderer SHALL change the map zoom level within the Basemap_Style minimum and maximum zoom bounds.
3. WHEN the browser viewport dimensions change, THE Map_Renderer SHALL resize the rendered map to fill its container while preserving aspect ratio without visual distortion.
4. THE Map_Application SHALL provide on-screen zoom-in and zoom-out controls that meet the Touch_Target size requirement.
5. WHEN the user activates zoom-in at maximum zoom or zoom-out at minimum zoom, THE Map_Renderer SHALL keep the current zoom level and SHALL NOT enter an error state.

### Requirement 6: Current Location Detection and Control

**User Story:** As a commuter, I want to find my current location on the map, so that I can plan routes relative to where I am.

#### Acceptance Criteria

1. THE Map_Application SHALL provide a Location_Control that requests the user's current geographic location.
2. WHEN the user activates the Location_Control AND location permission is granted, THE Map_Application SHALL place a Current_Location_Marker at the detected position and center the map on that position.
3. IF the user denies location permission, THEN THE Map_Application SHALL display a message stating that location access was denied and SHALL keep the map centered on the Metro_Manila_Extent and interactive.
4. IF geolocation is unavailable in the current environment, THEN THE Map_Application SHALL display a message stating that location is unavailable and SHALL keep the map interactive.
5. IF a location request does not resolve within 20 seconds, THEN THE Map_Application SHALL stop waiting, display a message that location could not be determined, and keep the map interactive.
6. WHERE the detected location falls outside the Metro_Manila_Extent, THE Map_Application SHALL display the Current_Location_Marker and SHALL inform the user that BahaRoute currently supports the NCR only.

### Requirement 7: Recenter Control

**User Story:** As a user who has panned away, I want to recenter the map, so that I can return to the Metro Manila view quickly.

#### Acceptance Criteria

1. THE Map_Application SHALL provide a Recenter_Control.
2. WHEN the user activates the Recenter_Control, THE Map_Renderer SHALL return the map view to the Metro_Manila_Extent within 1000 milliseconds.
3. WHEN the user activates the Recenter_Control WHILE the map view already matches the Metro_Manila_Extent, THE Map_Renderer SHALL keep the map framed on the Metro_Manila_Extent and SHALL NOT enter an error state.

### Requirement 8: Origin and Destination Markers

**User Story:** As a user planning a trip, I want to set origin and destination markers, so that I can prepare to compare routes between two points.

#### Acceptance Criteria

1. THE Map_Application SHALL support placing exactly one Origin_Marker and one Destination_Marker on the map at a time.
2. WHEN an Origin_Marker is placed, THE Map_Renderer SHALL render it differing from the Destination_Marker in shape or icon in addition to any color, and SHALL NOT distinguish the two markers by color alone.
3. WHEN a Destination_Marker is placed, THE Map_Renderer SHALL render it differing from the Origin_Marker in shape or icon in addition to any color, and SHALL NOT distinguish the two markers by color alone.
4. WHEN an Origin_Marker is placed WHILE an Origin_Marker already exists, THE Map_Renderer SHALL move the existing Origin_Marker to the new position rather than create a second Origin_Marker; the same behavior SHALL apply to the Destination_Marker.
5. THE Origin_Marker and Destination_Marker SHALL each carry an accessible text label identifying its role as origin or destination.

### Requirement 9: Layer Control Foundation

**User Story:** As a user, I want a layer control, so that I can toggle map layers and rely on it for flood and route layers in future milestones.

#### Acceptance Criteria

1. THE Map_Application SHALL provide a Layer_Control that lists every available Data_Layer, with one toggleable entry per Data_Layer.
2. WHEN the user toggles a layer entry in the Layer_Control to the visible state, THE Map_Renderer SHALL show the corresponding Data_Layer within 500 milliseconds; WHEN the user toggles a layer entry to the hidden state, THE Map_Renderer SHALL hide the corresponding Data_Layer within 500 milliseconds.
3. WHERE no Data_Layers are available, THE Layer_Control SHALL display an empty list and SHALL NOT display an error.
4. THE Layer_Control SHALL expose every Data_Layer through the same toggle interaction, so that flood, route, and evacuation-center Data_Layers are added as additional entries without introducing a different interaction for any layer.
5. THE Layer_Control SHALL present each layer entry with a text label and a control state that is perceivable without color, and SHALL NOT rely on color alone to identify a layer or convey its on/off state.

### Requirement 10: Mobile and Desktop Layouts

**User Story:** As a mobile and desktop user, I want the map interface to adapt to my device, so that controls are usable and unobstructed.

#### Acceptance Criteria

1. WHILE the viewport width is less than 768 CSS pixels, THE Map_Application SHALL arrange all interactive controls within the lower two-thirds of the viewport height so that they are reachable for touch interaction.
2. WHILE the viewport width is 768 CSS pixels or greater, THE Map_Application SHALL arrange controls so that no control overlaps another control and each control is fully visible within the viewport.
3. THE Map_Application SHALL respect mobile safe-area insets so that no interactive control is rendered within a device notch or system-bar inset region.
4. WHILE the viewport width is less than 768 CSS pixels, THE Map_Application SHALL size every interactive Touch_Target to a minimum of 44 by 44 CSS pixels.

### Requirement 11: Accessible Interaction States

**User Story:** As a user relying on assistive technology or keyboard navigation, I want accessible controls, so that I can operate the map without a mouse or color perception.

#### Acceptance Criteria

1. THE Map_Application SHALL make every map control operable using the keyboard alone, including reaching the control via keyboard navigation and activating it.
2. WHEN a map control receives keyboard focus, THE Map_Application SHALL display a visible focus indicator whose boundary has a contrast ratio of at least 3:1 against adjacent colors.
3. THE Map_Application SHALL provide an accessible text label for each map control.
4. THE Map_Application SHALL convey status and category information using icons, text, or patterns in addition to color, and SHALL NOT rely on color alone.
5. THE Map_Application SHALL render text and interactive controls with a contrast ratio meeting WCAG 2.1 AA (at least 4.5:1 for normal text and 3:1 for large text and interactive component boundaries).

### Requirement 12: Flood Data Model Readiness (Architecture Only)

**User Story:** As a developer preparing for future milestones, I want defined flood data models, so that flood layers can be added without redesigning the data foundation.

#### Acceptance Criteria

1. THE Map_Application SHALL define a Flood_State type whose values are exactly RED (Reported Flooding), ORANGE (Elevated Flood Exposure), YELLOW (Caution), GREEN (Recently Reported Passable), and GRAY (Unknown).
2. THE Map_Application SHALL model Flood_Susceptibility as a data type distinct from Flood_Report, so that historical or modeled susceptibility is never represented as current reported conditions.
3. THE Map_Application SHALL require every Flood_Report and Flood_Susceptibility item to carry Flood_Item_Metadata including location, source, data type, updated_at, and verification status, and SHALL reject any such item missing one or more of these fields.
4. WHERE severity, depth, description, or source URL are available for a flood item, THE Map_Application SHALL include those fields in the Flood_Item_Metadata.
5. THE Map_Application SHALL define a recency window as a configurable duration with a default of 21,600 seconds (6 hours).
6. THE Map_Application SHALL assign the GREEN (Recently Reported Passable) state only when passability information is present and the difference between the current time and its updated_at is within the recency window.
7. WHERE flood condition information for a location is absent, or the difference between the current time and its updated_at exceeds the recency window, THE Map_Application SHALL represent that location as GRAY (Unknown) and SHALL NOT represent it as having no flood risk.

### Requirement 13: Safety Framing and Language Constraints

**User Story:** As a user making my own travel decisions, I want BahaRoute to avoid guaranteeing safety, so that I understand I remain the decision maker.

#### Acceptance Criteria

1. THE Map_Application SHALL NOT label any route as "Safe Route" or otherwise state that a route is safe.
2. THE Map_Application SHALL NOT display a numeric safety score for any route or location.
3. WHERE flood information is presented, THE Map_Application SHALL accompany it with a disclaimer that the information supports decisions and is not a safety guarantee.
4. THE Map_Application SHALL display Flood_State values using the RED, ORANGE, YELLOW, GREEN, and GRAY vocabulary defined in the Glossary and SHALL NOT substitute a "no risk", "safe", or "clear" designation for the GRAY (Unknown) state.

### Requirement 14: Community Report Distinction (Architecture Only)

**User Story:** As a user weighing information, I want community reports to look distinct from official information, so that I can judge their reliability.

#### Acceptance Criteria

1. THE Map_Application SHALL model Community_Report as a distinct category from authoritative Flood_Report data.
2. WHEN a Community_Report is displayed, THE Map_Renderer SHALL render it differing from authoritative or official flood information in shape, icon, or border in addition to any color.
3. WHERE a Community_Report has verification status other than verified, THE Map_Application SHALL mark the report as UNCONFIRMED.
4. THE Map_Application SHALL indicate the UNCONFIRMED status using text or an icon in addition to any color treatment.

### Requirement 15: Demo and Fixture Data Isolation

**User Story:** As a developer, I want demo data clearly labeled and isolated, so that it can be swapped for real APIs later without confusing users.

#### Acceptance Criteria

1. THE Map_Application SHALL source all pre-real-API flood, route, and evacuation-center content from Fixture_Data.
2. WHEN Fixture_Data is displayed, THE Map_Application SHALL show a visible label identifying the content as demo or fixture data.
3. THE Map_Application SHALL isolate Fixture_Data behind a Data_Layer interface so that a real API source can replace it without changing consuming components.
4. THE Map_Application SHALL NOT present Fixture_Data as authoritative or verified information.
5. THE Map_Application SHALL NOT invent authoritative flood APIs and SHALL NOT apply artificial-intelligence-generated labels to flood data.

### Requirement 16: Route and Evacuation-Center Architecture Readiness (Architecture Only)

**User Story:** As a developer preparing later milestones, I want route and evacuation-center data structures scaffolded, so that routing and evacuation features can be added on this foundation.

#### Acceptance Criteria

1. THE Map_Application SHALL define data types for route geometry, a collection of route alternatives, and per-route flood segments where each segment carries a Flood_State.
2. THE Map_Application SHALL define a data type for evacuation centers that carries at least location, name, and description.
3. THE Map_Application SHALL expose route and evacuation-center Data_Layers through the same Data_Layer interface used by other layers.
4. THE Map_Application SHALL scope route and evacuation-center support to the NCR and SHALL NOT implement nationwide routing in this milestone.
5. THE Map_Application SHALL NOT implement a full turn-by-turn navigation engine or AI-based routing in this milestone.

### Requirement 17: Secure API Key and Environment Configuration

**User Story:** As a developer deploying BahaRoute, I want API keys handled through environment configuration, so that no secrets are committed and setup is documented.

#### Acceptance Criteria

1. THE Map_Application SHALL read the Tile_Provider API_Key from an environment variable at runtime.
2. THE Map_Application SHALL NOT contain a hardcoded API_Key in any source-controlled file.
3. THE Map_Application SHALL provide an example environment configuration file that documents the required API_Key variable and contains a placeholder value only.
4. IF the API_Key is missing at startup, THEN THE Map_Application SHALL render its application shell, display a message explaining that map configuration is incomplete, SHALL NOT request tiles, and SHALL NOT crash.

### Requirement 18: Graceful Handling of Data and Service Failures

**User Story:** As a user, I want the application to fail gracefully, so that I still get a usable interface when data or services are unavailable.

#### Acceptance Criteria

1. IF the Tile_Provider fails to return tiles, THEN THE Map_Application SHALL display a message indicating the map could not load and SHALL NOT terminate.
2. IF a GeoJSON data source is malformed, THEN THE Map_Application SHALL skip the malformed source and continue rendering the remaining map without an uncaught error.
3. WHERE a flood Data_Layer contains no items, THE Map_Renderer SHALL render an empty layer and THE Map_Application SHALL NOT display an error.
4. IF location permission is denied or geolocation is unavailable, THEN THE Map_Application SHALL keep the map centered on the Metro_Manila_Extent and its controls operable.
5. WHEN any failure defined in this requirement occurs, THE Map_Application SHALL keep the base map and its controls interactive where the failure does not prevent it.
