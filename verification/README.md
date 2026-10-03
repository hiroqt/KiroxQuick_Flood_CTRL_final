# Migration verification

The application was migrated from `/Users/arnel/KiroxQuick_Flood-CTRL`, including
its uncommitted changes and new route-validation files. Destination-only
application files were removed to match that source.
The source's local runtime configuration was copied into the destination's
ignored `.env.local`; credentials are not included in version control.

Run from the destination repository root:

```sh
npm ci
npm ci --prefix verification
npm exec --prefix verification -- playwright install chromium
npm run parity --prefix verification
npm test --prefix verification
npm test
npm run build
npm run lint
```

The source folder also needs its dependencies installed (`npm ci` there).
Set `MIGRATION_SOURCE=/absolute/path/to/source` to compare a different checkout.
Ports 5190–5195 must be available. Servers and browser contexts are closed after
the test, including on failure.

`parity.mjs` compares the complete application file inventory and SHA-256 hashes,
detecting missing, extra, and changed files. It excludes Git metadata, installed
dependencies, generated builds/coverage/logs, local environment and editor
settings, and this added verification directory. The root package files and
application code remain identical to the source.

`e2e.mjs` first checks file parity, then launches both applications in real
headless Chromium at 1440×900 and 390×844. It asserts expected behavior and
compares displayed content, control values/states, historical risk colors, and
panel widths across both folders for:

- NCR, city, and barangay historical exploration, risk filtering, and breadcrumb reset.
- Map layers, nearby-area context, and Escape-to-close behavior.
- Offline PITX–MOA search, route comparison, selected-route state, and return to search.
- Missing API token and map-provider failure with working layer controls.
- Absence of unhandled browser errors.

External services are intercepted with a minimal Mapbox style and deterministic
503 responses. The map itself uses the real Mapbox renderer and WebGL. These
checks verify application parity without relying on live provider data; they
do not validate live Mapbox tiles, real-time rainfall, or all possible journeys.

Historical migration validation: **239 application files identical; 750 tests passing in
74 suites; production build successful; six browser parity scenarios passing.**
Lint reports zero errors and the source's existing React Fast Refresh warning
in `RouteComparePanel.tsx`.

The pre-migration backup and file-change manifest are stored locally at
`/var/folders/10/ttcxvgts33z863v903g2m07c0000gn/T/kiroxquick-final-before-migration-c7bjmw21`.

## Current feature validation

The feature update passes **953 tests in 99 suites**, the production build
(including TypeScript checks), and lint with zero errors and one React Fast
Refresh warning. Vite also reports large output chunks. The historical migration
counts above describe the earlier migration, not this feature update.

This checkout now differs from the original migration source, so comparing it
against that source fails the intentional byte-for-byte parity assertion. Use a
matching source snapshot for migration checks. For current-checkout browser smoke
coverage without claiming cross-checkout parity, run:

```sh
MIGRATION_SOURCE="$PWD" npm test --prefix verification
```

Current-checkout smoke validation passed all six scenarios (map, missing key,
and provider failure at desktop and mobile widths). The controls menu is opened
before interacting with layers.

Browser scenarios enter `/#map` explicitly to bypass the new landing page.
They use intercepted external services and do not verify live provider behavior.
