# Dynamic A-to-B flood demo

Each calculated journey with at least two usable route alternatives has exactly two simulation points across different route selections: one not-passable flood on Route A (red) and one passable flood on Route B (yellow). Route C has no injected flood demo. No route gets both conditions. Route letters refer to the original candidates; ranking and manual selection preserve each route's assigned condition.

Points use distance along each option's actual returned polyline, rather than fixed coordinates or a straight line between endpoints. Generic paths place the point at half the measured length. A matching PITX–MOA hazard retains its established position for the existing reroute scenario.

Changing endpoints or travel mode regenerates the assignments. Selecting another route replaces the preview markers with those belonging to that option. During driving, physical flood points on shared roads warn every route using that road, even if the demo marker belongs to another route option. Route cards, map labels, HUD, and voice identify the conditions as simulations, separate from current risk and official closures.

When only one usable route exists, show only a passable demo. A second condition requires a second route; do not invent another road corridor or put both on one option. Invalid and zero-length routes receive no points. If directions are unavailable, the existing direct-line fallback remains unverified road geometry.

## QA acceptance criteria

- Journeys with two or three usable options have exactly one passable and one not-passable demo on different options.
- Each option has at most one demo; the third has none.
- Assignment follows route identity when comparison reorders cards or a user switches selections.
- Points lie inside their corresponding path, including bent, reversed, short, and changed journeys.
- Drive, bike, walk, bundled and provider alternatives use the same distribution rules.
- Single-route fallback never receives both conditions.
- Preview selection replaces markers; clearing removes them.
- HUD and voice label the demo's passability explicitly.
- Demo passability does not create official closure counts.

Automated coverage: routeFloodDemo, routePlanning, MapManager, DrivingHud, RouteComparePanel, MapView, navigation, reroute, and voice tests.

## Driving alerts and flood avoidance

At 900 m, visual and voice warnings show together. The driving simulation keeps moving while the driver chooses an alternative. The warning panel contains up to three distinct road-route selections with estimated travel time, distance, and turn-off distance. The fastest available qualifying alternative appears first.

For not-passable floods, prioritize avoiding-route selections and provide search/review actions. For passable floods, also provide an explicit Continue on passable route action; the driver decides whether to go through or reroute. Never offer continuing through a not-passable flood as a selection.

Driving requests tell Mapbox to exclude the known flood locations (up to its 50-point limit); whole-polyline checks still require 50 m clearance, no reported flooding classifications, and no confirmed closures. Cycling/walking retain geometry filtering and waypoint searches. If no verified joining road exists, provide retry/review actions and keep the simulation moving; do not invent a detour.

Requests start at an upcoming road position to leave joining time while the vehicle moves. Re-evaluate the shared road branch when a response arrives and again when a driver accepts; reject missed branches and never teleport or drive backward to an old proposal. Update the geometry, directions, and estimated arrival time after acceptance. Current point reports respect expiry and resolved status.

QA covers all three route selections continuing to advance during search, passable-versus-not-passable controls, multiple alternatives ranked by time, exclusion query parameters, safe moving joins, missed branches, and the common 900 m visual/voice radius.
