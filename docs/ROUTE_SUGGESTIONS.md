# Route suggestion validation

Suggestions represent different road corridors, not different names for the
same road. The planner compares each route against every route already kept.
It applies the same checks to provider routes and bundled demo routes.

## Road diversity

- Invalid, non-finite, out-of-range or zero-length geometry is rejected.
- Each path is sampled about every 50 m, capped at 240 samples per route.
- Samples within 35 m of the other path count as the same corridor. Vertex
  density, coordinate noise and ETA labels cannot create another suggestion.
- At least one path must have a different-road length of 10% of the shorter
  path, with a minimum of 75 m and a maximum required difference of 500 m.
- Every pair of displayed routes must meet that rule. Shared endpoints and
  common approach roads are allowed.
- The planner offers up to three meaningful choices. It does not add duplicate
  routes to fill three cards. Bounded shaping-point searches seek additional
  real provider paths when fewer than three are available.

These distances are configurable policy heuristics, not a guarantee of
independent roads. Road overlap estimates use local projected geometry, not
road IDs; nearby parallel roads can be treated as the same corridor.

## Flood evidence

Historical susceptibility is background context and does not establish current
flooding. Current risk uses the existing rainfall, reports, closure and demo
hazard signals. Route exposure lengths are estimated in 250 m intervals using
the interval midpoint's barangay classification. Unknown coverage is measured
separately; it never counts as zero exposure. Demo hazards affect their
containing interval, not a measured flood footprint.

Routes with equal current labels, report and closure counts, data quality and
similar exposure distances/proportions are described as having the same flood
assessment. This comparison allows less than 250 m of length difference and
less than two percentage points of exposure/unknown coverage difference.
It does not invent a flood advantage to differentiate cards.

## Selection and decision support

The recommended route has verified zero detected exposure and the shortest ETA
and travel time among qualifying candidates. Distance breaks equal-time ties.
Route B remains the unlabeled selection fallback if no recommendation qualifies;
a confirmed closure still blocks Start.

When all current assessments are equal, the panel states that there is no
measured flood advantage. Alternatives show their different-road distance,
shared-corridor estimate and time/distance difference from the named comparison route. Cards stay in A, B, C order
regardless of which route is recommended or selected.
A slower, longer route with the same flood assessment is an alternate corridor,
not a better flood choice. When information is incomplete, the panel says so.
