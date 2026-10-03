/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mapbox access token. Supplied via environment, never committed. */
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Local .geojson assets are imported at build time as raw text (via Vite's
// `?raw` query) and parsed with JSON.parse in a typed loader module. This
// declaration lets TypeScript resolve those `...geojson?raw` imports.
declare module '*.geojson?raw' {
  const content: string;
  export default content;
}
