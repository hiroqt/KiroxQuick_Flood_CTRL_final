# Flood Semantics & Safety Language

BahaRoute is decision *support*, not a safety guarantee. These rules are enforced across UI copy, data, and tests.

## Flood states

`RED`, `ORANGE`, `YELLOW`, `GREEN`, `GRAY` — exactly five, no more.

- `RED / ORANGE / YELLOW` describe reported current conditions of increasing concern.
- `GREEN` is a current-condition state meaning "recently reported passable" — it requires present, recent passability data. Green never appears on a susceptibility layer.
- `GRAY` = **Unknown**. It is never rendered or described as safe, clear, passable, or "no risk." Absence of a flood fill is not evidence of safety.

## Susceptibility vs. current conditions

- **Susceptibility** (`HIGH`/`MODERATE`/`LOW`) is historical/modeled exposure. It does not confirm current or recent flooding.
- **Reports** (flood reports, route segments, markers) describe current/recent conditions.
- These two are kept distinct in types, layers, and popups. A high-susceptibility area is not a claim that it is flooded now; a low-susceptibility area is not a claim that it is safe now.

## Two susceptibility surfaces

- **Hazard-shaped susceptibility polygons** — waterway/low-lying hazard geometry; the authoritative hazard footprint in this model.
- **Per-city susceptibility summary** — a labeled modeled summary value drawn on the administrative silhouette. Administrative boundaries are boundaries, not flood-risk geometry.

## Prohibited language & patterns

Never, anywhere in the product:

- "Safest Route", "Safest", "Guaranteed Safe", "100% Safe", "No Risk", "Clear", or any arbitrary numeric safety score.
- Treating `GRAY`/Unknown as safe or passable.
- Presenting community reports as confirmed — they are `UNCONFIRMED` unless verified.
- Claiming nationwide coverage — scope is NCR-only.

## Verification

Community and other reports carry `verificationStatus`. Anything not `VERIFIED` is surfaced as `UNCONFIRMED`, and popups show source, last-updated time, and a disclaimer.
