// src/layers/susceptibilityPopup.ts
//
// Click/tap popup WIRING for flood-susceptibility polygons (Task 10.2; design →
// "Click/tap popup for a susceptibility area"; Req 13.3, 13.1, 13.2).
//
// This module contains ONLY the logic that connects a MapLibre map click on the
// susceptibility fill layer to the presentational <FloodPopup>. It does NOT do
// any React rendering itself — the app/MapView passes a `renderPopup` callback
// that actually mounts a maplibregl.Popup (or a React portal) containing a
// rendered <FloodPopup> with the props this module builds.
//
// Design intent encoded here:
//   - On selecting a susceptibility polygon, map its feature `properties`
//     ({ level, source, updatedAt, ... } from `dataLayers`) into FloodPopup
//     props with `dataType: 'SUSCEPTIBILITY'` so the popup shows Area, Data type
//     (Susceptibility), Susceptibility level, Source, Dataset date / last
//     updated, and the historical-exposure Disclaimer (Req 13.3). The
//     historical-exposure disclaimer and the absence of any "safe"/score
//     language come "for free" via FloodPopup's susceptibility variant.
//   - `area` is derived from a feature property (name/id) with a sensible
//     fallback, since susceptibility features may not carry an explicit name.
//   - A registration helper wires the click/tap handler onto the
//     SUSCEPTIBILITY_FILL_LAYER_ID and (optionally) toggles a pointer cursor on
//     mouseenter/leave.
//
// Everything accepts MINIMAL, structural map/feature interfaces so a FAKE map
// can be injected in tests — no real WebGL map is required (test env is jsdom).

import type { SusceptibilityLevel } from '../types/flood';
import type { FloodPopupProps } from '../components/overlays/FloodPopup';
import { SUSCEPTIBILITY_FILL_LAYER_ID } from './floodSusceptibilityLayer';

/**
 * The subset of a MapLibre feature this module reads: its `properties` bag
 * (carrying `level`, `source`, `updatedAt`, and possibly `name`) and its
 * optional top-level `id`. Kept structural so tests can pass a plain object.
 */
export interface SusceptibilityFeatureLike {
  id?: string | number;
  properties?: Record<string, unknown> | null;
}

/** A `{ lng, lat }` position, matching maplibregl.LngLat's shape. */
export interface LngLatLike {
  lng: number;
  lat: number;
}

/** The fallback shown in the popup's "Area" field when no name/id is present. */
export const SUSCEPTIBILITY_AREA_FALLBACK = 'Susceptibility area';

/** SusceptibilityLevel values accepted off feature properties. */
const VALID_LEVELS: readonly SusceptibilityLevel[] = ['HIGH', 'MODERATE', 'LOW'];

function isSusceptibilityLevel(value: unknown): value is SusceptibilityLevel {
  return (
    typeof value === 'string' &&
    (VALID_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * Derives the popup "Area" label from a feature. Prefers a human `name`
 * property, then a `title`, then the feature `id` (property or top-level), and
 * finally a stable fallback so the field is never blank.
 */
function deriveArea(feature: SusceptibilityFeatureLike): string {
  const props = feature.properties ?? {};

  const name = props.name;
  if (typeof name === 'string' && name.trim() !== '') {
    return name;
  }

  const title = props.title;
  if (typeof title === 'string' && title.trim() !== '') {
    return title;
  }

  const propId = props.id;
  if (typeof propId === 'string' && propId.trim() !== '') {
    return propId;
  }
  if (typeof propId === 'number' && Number.isFinite(propId)) {
    return String(propId);
  }

  const topId = feature.id;
  if (typeof topId === 'string' && topId.trim() !== '') {
    return topId;
  }
  if (typeof topId === 'number' && Number.isFinite(topId)) {
    return String(topId);
  }

  return SUSCEPTIBILITY_AREA_FALLBACK;
}

/**
 * Maps a clicked susceptibility feature's properties to {@link FloodPopupProps}.
 *
 * Always sets `dataType: 'SUSCEPTIBILITY'` so the popup renders the
 * historical-exposure Disclaimer and the Susceptibility level row (never a
 * Flood_State or any "safe"/score language). `area` is derived from name/id
 * with a fallback; `level` is read only when it is a valid SusceptibilityLevel;
 * `updatedAt` falls back to 0 (rendered as "Unknown" by FloodPopup) when absent
 * or non-numeric, and `source` falls back to an empty string.
 *
 * @param feature - The clicked susceptibility feature (structural shape).
 */
export function susceptibilityFeatureToPopupProps(
  feature: SusceptibilityFeatureLike,
): FloodPopupProps {
  const props = feature.properties ?? {};

  const level = isSusceptibilityLevel(props.level) ? props.level : undefined;

  const source = typeof props.source === 'string' ? props.source : '';

  const updatedAt =
    typeof props.updatedAt === 'number' && Number.isFinite(props.updatedAt)
      ? props.updatedAt
      : 0;

  return {
    area: deriveArea(feature),
    dataType: 'SUSCEPTIBILITY',
    level,
    source,
    updatedAt,
  };
}

/**
 * A MapLibre-style click/tap event on a layer: it carries the queried
 * `features` and the `lngLat` of the click. Kept structural for testability.
 */
export interface SusceptibilityLayerClickEvent {
  features?: SusceptibilityFeatureLike[];
  lngLat: LngLatLike;
}

/** The map events this module listens to. */
export type SusceptibilityMapEvent = 'click' | 'mouseenter' | 'mouseleave';

/**
 * The minimal MapLibre map surface needed to wire the popup: layer-scoped
 * `on`/`off` and an optional cursor setter (via `getCanvas().style`). Kept
 * structural so a FAKE map can be injected in tests — no real WebGL map needed.
 */
export interface SusceptibilityPopupMap {
  on(
    event: SusceptibilityMapEvent,
    layerId: string,
    handler: (event: SusceptibilityLayerClickEvent) => void,
  ): void;
  off(
    event: SusceptibilityMapEvent,
    layerId: string,
    handler: (event: SusceptibilityLayerClickEvent) => void,
  ): void;
  /** Optional: used to toggle the pointer cursor over susceptibility areas. */
  getCanvas?: () => { style: { cursor: string } };
}

/**
 * The callback the app/MapView provides to actually SHOW the popup. It receives
 * the mapped {@link FloodPopupProps} and the click {@link LngLatLike}, and is
 * expected to mount a maplibregl.Popup (or React portal) rendering
 * <FloodPopup {...props} /> at that position.
 */
export type RenderSusceptibilityPopup = (
  props: FloodPopupProps,
  lngLat: LngLatLike,
) => void;

/** A teardown function returned by {@link installSusceptibilityPopup}. */
export type UninstallSusceptibilityPopup = () => void;

/**
 * Wires the susceptibility click/tap popup onto a map.
 *
 * Registers a `click` handler on {@link SUSCEPTIBILITY_FILL_LAYER_ID}: when a
 * susceptibility feature is clicked, it builds the popup props via
 * {@link susceptibilityFeatureToPopupProps} and invokes `renderPopup(props,
 * lngLat)`. It also sets the cursor to `pointer` on `mouseenter` and clears it
 * on `mouseleave` (best-effort; skipped if the map exposes no canvas).
 *
 * @param map - Minimal structural map surface (real map or a test fake).
 * @param renderPopup - Callback that actually displays the popup.
 * @returns A function that removes every handler this installed.
 */
export function installSusceptibilityPopup(
  map: SusceptibilityPopupMap,
  renderPopup: RenderSusceptibilityPopup,
): UninstallSusceptibilityPopup {
  const onClick = (event: SusceptibilityLayerClickEvent): void => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }
    const props = susceptibilityFeatureToPopupProps(feature);
    renderPopup(props, event.lngLat);
  };

  const setCursor = (cursor: string): void => {
    const canvas = map.getCanvas?.();
    if (canvas) {
      canvas.style.cursor = cursor;
    }
  };

  const onMouseEnter = (): void => setCursor('pointer');
  const onMouseLeave = (): void => setCursor('');

  map.on('click', SUSCEPTIBILITY_FILL_LAYER_ID, onClick);
  map.on('mouseenter', SUSCEPTIBILITY_FILL_LAYER_ID, onMouseEnter);
  map.on('mouseleave', SUSCEPTIBILITY_FILL_LAYER_ID, onMouseLeave);

  return () => {
    map.off('click', SUSCEPTIBILITY_FILL_LAYER_ID, onClick);
    map.off('mouseenter', SUSCEPTIBILITY_FILL_LAYER_ID, onMouseEnter);
    map.off('mouseleave', SUSCEPTIBILITY_FILL_LAYER_ID, onMouseLeave);
  };
}
