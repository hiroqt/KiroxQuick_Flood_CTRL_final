// src/layers/reportMarkersLayer.ts
//
// Renders two point layers so their LayerControl toggles are real:
//   - communityReports  → unconfirmed community flood reports (circle markers)
//   - officialClosures   → official/admin CONFIRMED_NOT_PASSABLE barangays
//
// Both are current-condition overlays that sit ABOVE the barangay risk fill so
// the specific points read on top. Colors come from the reserved current-risk
// palette. Community reports are clearly unconfirmed; closures are clearly
// official/manual-demo confirmations (see the fixtures' source labels).

import { APP_LAYER_SLOT, LayerRegistry, type MapLayerSpec } from './LayerRegistry';
import { CURRENT_RISK_COLORS } from '../map/basemap/colorTokens';
import type { CommunityReport } from '../types/report';
import type { OfficialStatus } from '../types/risk';
import { barangayInfoByPsgc } from '../data/geojson/ncrBarangays';
import { reportLifecycleStage } from '../services/reportLifecycle';
import {
  COMMUNITY_DEPTH_ICON_KEYS,
  COMMUNITY_BADGE_ICON_ID,
  COMMUNITY_HITBOX_ICON_ID,
  communityIconId,
  registerCommunityImages,
  type ImageRegistryMap,
} from './communityReportIcon';

export type { MapLayerSpec };

export const COMMUNITY_REPORTS_SOURCE_ID = 'communityReports';
export const COMMUNITY_REPORTS_LAYER_ID = 'communityReports' as const;
/** Companion layers for the community marker (badge + forgiving click target). */
export const COMMUNITY_REPORTS_BADGE_LAYER_ID = 'communityReports-badge' as const;
export const COMMUNITY_REPORTS_HITBOX_LAYER_ID = 'communityReports-hitbox' as const;
export const OFFICIAL_CLOSURES_SOURCE_ID = 'officialClosures';
export const OFFICIAL_CLOSURES_LAYER_ID = 'officialClosures' as const;

/**
 * Depth → community marker COLOR (realism pass). A cool→hot ramp by observed
 * water depth; UNKNOWN is a neutral amber (never green, which could read as
 * "safe"). These are display-only and distinct from the official-closure color.
 */
export const COMMUNITY_DEPTH_COLORS = {
  ANKLE: '#f6c445', // shallow → amber/yellow
  KNEE: '#ef8a3c', // orange
  WAIST: '#e0443e', // red
  ABOVE_WAIST: '#9a1f1a', // dark red
  UNKNOWN: '#d9a441', // neutral amber (unknown depth, not "safe")
} as const;

/** Muted grey for RESOLVED community markers (cleared, historical). */
export const COMMUNITY_RESOLVED_COLOR = '#9aa0a6';

/** Minimal GeoJSON source spec (structural). */
export interface PointSourceSpec {
  type: 'geojson';
  data: GeoJSON.FeatureCollection;
}

import { resolveBarangayForPoint } from '../services/reportResolution';

/** Projects community reports to point features (skips non-locatable). */
export function communityReportsToGeoJSON(
  reports: readonly CommunityReport[],
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: reports.map((r) => {
      const { lng, lat } = r.metadata.location;
      const psgc = resolveBarangayForPoint(lng, lat);
      const barangay = psgc ? (barangayInfoByPsgc.get(psgc)?.name ?? '') : '';
      const resolved = r.lifecycle === 'RESOLVED';
      // Presentation stage drives marker opacity (deterministic in the paint via
      // this precomputed property, so no time logic lives in the style). Reuses
      // the shared lifecycle stage so marker + popup tell the SAME story.
      const stage = resolved ? 'RESOLVED' : reportLifecycleStage(r);
      const confirmations = r.confirmationCount ?? 0;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          id: r.id,
          state: r.state,
          source: r.metadata.source,
          updatedAt: r.metadata.updatedAt,
          barangay,
          // Community Report V2 lifecycle/condition fields (optional; absent on
          // V1 reports). Carried so the popup can render details and act on the
          // specific report by id.
          note: r.metadata.description ?? '',
          severity: r.severity ?? '',
          depth: r.depth ?? '',
          passability: r.passability ?? '',
          lifecycle: r.lifecycle ?? 'ACTIVE',
          confirmationCount: confirmations,
          lastConfirmedAt: r.lastConfirmedAt ?? 0,
          resolvedAt: r.resolvedAt ?? 0,
          // --- Realism-pass display props (presentation only) ---
          /** Depth bucket driving marker COLOR (observable, not subjective). */
          depthColor: communityDepthColor(r.depth, resolved),
          /** Presentation stage (FRESH/RECENT/AGING/STALE/RESOLVED) → opacity. */
          stage,
          /**
           * Which registered SVG pin icon to draw: resolved → the muted
           * variant, otherwise the depth variant (UNKNOWN fallback). This is an
           * ICON-IMAGE key — NOT a text glyph — so no emoji/font is involved.
           */
          iconKey: communityIconKey(r.depth, resolved),
          /**
           * Confirmation badge TEXT (digits only, which the Mapbox font renders
           * reliably). Empty string when there are no confirmations so the badge
           * layer's filter hides it. 9+ for anything above 9.
           */
          badgeText: badgeTextFor(confirmations),
        },
      };
    }),
  };
}

/** The registered icon key for a report (resolved → muted; else depth variant). */
export function communityIconKey(depth: string | undefined, resolved: boolean): string {
  if (resolved) return 'RESOLVED';
  switch (depth) {
    case 'ANKLE':
    case 'KNEE':
    case 'WAIST':
    case 'ABOVE_WAIST':
      return depth;
    default:
      return 'UNKNOWN';
  }
}

/** Confirmation badge text: '' when 0, '1'..'9', or '9+' above 9. */
export function badgeTextFor(count: number): string {
  if (count <= 0) return '';
  if (count > 9) return '9+';
  return String(count);
}

/**
 * Maps a report's observed DEPTH to its marker color (realism pass). Deeper
 * water reads hotter; unknown depth is a neutral amber (never green/"safe");
 * resolved is muted grey. This is a DISPLAY mapping only — it does not change
 * the risk model (severity is still derived separately in reportLifecycle).
 */
export function communityDepthColor(
  depth: string | undefined,
  resolved: boolean,
): string {
  if (resolved) return COMMUNITY_RESOLVED_COLOR;
  switch (depth) {
    case 'ABOVE_WAIST':
      return COMMUNITY_DEPTH_COLORS.ABOVE_WAIST;
    case 'WAIST':
      return COMMUNITY_DEPTH_COLORS.WAIST;
    case 'KNEE':
      return COMMUNITY_DEPTH_COLORS.KNEE;
    case 'ANKLE':
      return COMMUNITY_DEPTH_COLORS.ANKLE;
    default:
      return COMMUNITY_DEPTH_COLORS.UNKNOWN;
  }
}

/**
 * Projects official confirmations to point features at their barangay centroid.
 * Only `notPassable` confirmations that resolve to a known barangay are shown.
 */
export function officialClosuresToGeoJSON(
  officials: readonly OfficialStatus[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const o of officials) {
    if (!o.notPassable) continue;
    const info = barangayInfoByPsgc.get(o.psgc);
    if (!info) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [info.centroid[0], info.centroid[1]] },
      properties: {
        psgc: o.psgc,
        source: o.source,
        note: o.note ?? '',
        barangay: info.name,
        updatedAt: o.confirmedAt,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * The minimal map surface for installing point layers. Includes the image
 * registry surface + a raw `addLayer` so the community marker can register its
 * SVG icons and add its companion badge/hitbox layers (which are not
 * registry-managed app layers).
 */
export interface PointLayerMapAdapter extends ImageRegistryMap {
  addSource(id: string, source: PointSourceSpec): void;
  addLayer(layer: MapLayerSpec, beforeId?: string): void;
  getLayer?(id: string): unknown;
}

/** A GeoJSON source whose data can be replaced at runtime (Mapbox-compatible). */
export interface UpdatableGeoJSONSource {
  setData(data: GeoJSON.FeatureCollection): void;
}

/** The minimal map surface for refreshing an installed point source. */
export interface PointSourceUpdateMap {
  getSource(id: string): UpdatableGeoJSONSource | undefined;
}

/**
 * Replaces the community-reports source data at runtime so a newly submitted
 * report appears without reinstalling the layer. Reuses the same projection as
 * the initial install ({@link communityReportsToGeoJSON}); a no-op if the source
 * is not present yet. Visibility is untouched — the caller decides whether to
 * reveal the layer.
 */
export function updateCommunityReportsSource(
  map: PointSourceUpdateMap,
  reports: readonly CommunityReport[],
): void {
  const source = map.getSource(COMMUNITY_REPORTS_SOURCE_ID);
  if (!source) return;
  source.setData(communityReportsToGeoJSON(reports));
}

/**
 * Opacity by presentation stage — fresher reads stronger, stale reads faint,
 * resolved is muted. A Mapbox `match` on the precomputed `stage` property so the
 * style is deterministic (no time logic in paint) and testable. Stale reports
 * stay RENDERABLE (just faded), never removed.
 */
const STAGE_OPACITY: (readonly [string, number])[] = [
  ['FRESH', 1.0],
  ['RECENT', 0.85],
  ['AGING', 0.85],
  ['STALE', 0.7],
  ['RESOLVED', 0.75],
];

/** Builds the Mapbox `match` expression for stage → opacity. */
function stageOpacityExpr(): unknown {
  const expr: unknown[] = ['match', ['get', 'stage']];
  for (const [stage, op] of STAGE_OPACITY) expr.push(stage, op);
  expr.push(0.85); // default
  return expr;
}

/** `match` expression: feature `iconKey` → the registered SVG pin image id. */
function iconImageExpr(): unknown {
  const expr: unknown[] = ['match', ['get', 'iconKey']];
  for (const key of COMMUNITY_DEPTH_ICON_KEYS) expr.push(key, communityIconId(key));
  expr.push(communityIconId('UNKNOWN')); // default fallback
  return expr;
}

/**
 * Builds the community-reports marker layer (realism pass, SVG icons). It is a
 * SYMBOL layer whose `icon-image` is a project-owned, pre-rendered WATER
 * TEARDROP PIN (depth-colored, white border, water-wave glyph) — NO emoji and
 * NO text glyph, so it renders deterministically regardless of the font stack.
 * Opacity is driven by the presentation stage.
 *
 * Deliberately a DIFFERENT shape language from the official-closure marker (a
 * bold SOLID filled circle), so a community report never resembles an official
 * closure or a Mapbox POI pictogram.
 */
export function buildCommunityReportsLayer(): MapLayerSpec {
  return {
    id: COMMUNITY_REPORTS_LAYER_ID,
    type: 'symbol',
    slot: APP_LAYER_SLOT,
    source: COMMUNITY_REPORTS_SOURCE_ID,
    layout: {
      'icon-image': iconImageExpr(),
      'icon-size': 1,
      'icon-anchor': 'bottom', // the teardrop tip sits on the point
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'symbol-z-order': 'source',
    },
    paint: {
      'icon-opacity': stageOpacityExpr() as never,
    },
  };
}

/**
 * Builds the confirmation-badge layer: a small circular badge icon with the
 * numeric count on top, offset to the pin's top-right. Filtered so it renders
 * ONLY when `badgeText` is non-empty (confirmationCount > 0). Digits render
 * reliably in the Mapbox font (the earlier bug was the emoji, not numbers).
 */
export function buildCommunityReportsBadgeLayer(): MapLayerSpec {
  return {
    id: COMMUNITY_REPORTS_BADGE_LAYER_ID,
    type: 'symbol',
    slot: APP_LAYER_SLOT,
    source: COMMUNITY_REPORTS_SOURCE_ID,
    filter: ['!=', ['get', 'badgeText'], ''],
    layout: {
      'icon-image': COMMUNITY_BADGE_ICON_ID,
      'icon-size': 1,
      'icon-anchor': 'center',
      'icon-offset': [12, -34], // top-right of the pin
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'text-field': ['get', 'badgeText'],
      'text-size': 11,
      'text-offset': [12 / 11, -34 / 11],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': '#ffffff',
      'icon-opacity': stageOpacityExpr() as never,
      'text-opacity': stageOpacityExpr() as never,
    },
  };
}

/**
 * Builds a transparent, larger hit-target layer under the pin so the marker is
 * easy to tap even on small/high-DPI screens. Carries the same feature props,
 * so clicking it opens the same report as clicking the visible pin.
 */
export function buildCommunityReportsHitboxLayer(): MapLayerSpec {
  return {
    id: COMMUNITY_REPORTS_HITBOX_LAYER_ID,
    type: 'symbol',
    slot: APP_LAYER_SLOT,
    source: COMMUNITY_REPORTS_SOURCE_ID,
    layout: {
      'icon-image': COMMUNITY_HITBOX_ICON_ID,
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': 0, // invisible, but still hit-tested for clicks
    },
  };
}

/** Builds the official-closures marker layer spec. */
export function buildOfficialClosuresLayer(): MapLayerSpec {
  return {
    id: OFFICIAL_CLOSURES_LAYER_ID,
    type: 'circle',
    slot: APP_LAYER_SLOT,
    source: OFFICIAL_CLOSURES_SOURCE_ID,
    paint: {
      'circle-radius': 7,
      'circle-color': CURRENT_RISK_COLORS.CONFIRMED_NOT_PASSABLE.hex,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
      'circle-opacity': 0.95,
    },
  };
}

/**
 * Installs the community-report and official-closure point layers. Both start
 * HIDDEN (visibility 'none') so they are opt-in via the LayerControl; the
 * primary current-risk fill is the default active layer.
 */
export function installReportMarkers(
  map: PointLayerMapAdapter,
  registry: LayerRegistry,
  reports: readonly CommunityReport[],
  officials: readonly OfficialStatus[],
): void {
  // Register the project-owned SVG marker images BEFORE adding the icon layer
  // (hasImage-guarded so it is safe if a style reload already restored them).
  registerCommunityImages(map);

  map.addSource(COMMUNITY_REPORTS_SOURCE_ID, {
    type: 'geojson',
    data: communityReportsToGeoJSON(reports),
  });
  map.addSource(OFFICIAL_CLOSURES_SOURCE_ID, {
    type: 'geojson',
    data: officialClosuresToGeoJSON(officials),
  });

  // The base community pin is registry-managed (its LayerControl toggle). The
  // badge + hitbox are companion layers added directly ABOVE the base pin; they
  // follow the base layer's visibility (see setCommunityReportsVisibility).
  registry.addAppLayer(buildCommunityReportsLayer());
  try {
    // Hitbox first (below the visible pin), then badge (above the pin).
    map.addLayer(buildCommunityReportsHitboxLayer(), COMMUNITY_REPORTS_LAYER_ID);
    map.addLayer(buildCommunityReportsBadgeLayer());
  } catch {
    // Companion layers are best-effort; the base pin still renders + is clickable.
  }
  registry.addAppLayer(buildOfficialClosuresLayer());

  // Opt-in overlays: hidden by default.
  setCommunityReportsVisibility(map, registry, false);
  registry.setVisibility(OFFICIAL_CLOSURES_LAYER_ID, false);
}

/**
 * Toggles the community marker + its companion badge/hitbox layers together so
 * they never desync. The base pin goes through the registry (which owns the
 * app-layer visibility); the companions are toggled via `setLayoutProperty`.
 */
export function setCommunityReportsVisibility(
  map: {
    setLayoutProperty?(id: string, name: string, value: unknown): unknown;
    getLayer?(id: string): unknown;
  },
  registry: LayerRegistry,
  visible: boolean,
): void {
  registry.setVisibility(COMMUNITY_REPORTS_LAYER_ID, visible);
  const value = visible ? 'visible' : 'none';
  for (const id of [COMMUNITY_REPORTS_HITBOX_LAYER_ID, COMMUNITY_REPORTS_BADGE_LAYER_ID]) {
    try {
      if (map.getLayer?.(id) !== undefined) map.setLayoutProperty?.(id, 'visibility', value);
    } catch {
      // Best-effort; a missing companion layer is a safe no-op.
    }
  }
}

/**
 * Re-registers the community marker images after a style reload. Mapbox drops
 * custom images on a full style reload; call this on `styledata`/`style.load`
 * (hasImage-guarded, so it never throws a duplicate-image error).
 */
export function reregisterCommunityImages(map: ImageRegistryMap): void {
  registerCommunityImages(map);
}

// ---------------------------------------------------------------------------
// Click popups for the report + closure markers (Phase 2, Req 10).
// ---------------------------------------------------------------------------

/** A minimal lng/lat pair (structural, Mapbox-compatible). */
export interface LngLatLike {
  lng: number;
  lat: number;
}

/** Props the render callback receives for a clicked marker. */
export interface ReportPopupData {
  kind: 'community' | 'official';
  /** Report id (community only) — needed to act on the specific report. */
  id?: string;
  state?: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'GRAY';
  barangay?: string;
  note?: string;
  updatedAt: number | null;
  source: string;
  // Community Report V2 lifecycle/condition fields (community only).
  severity?: string;
  depth?: string;
  passability?: string;
  lifecycle?: string;
  confirmationCount?: number;
  lastConfirmedAt?: number | null;
  resolvedAt?: number | null;
}

interface MarkerClickEvent {
  features?: Array<{ properties?: Record<string, unknown> | null }>;
  lngLat: LngLatLike;
}

/** The minimal map surface needed to wire marker popups. */
export interface ReportPopupMap {
  on(
    event: 'click' | 'mouseenter' | 'mouseleave',
    layerId: string,
    handler: (event: MarkerClickEvent) => void,
  ): void;
  off(
    event: 'click' | 'mouseenter' | 'mouseleave',
    layerId: string,
    handler: (event: MarkerClickEvent) => void,
  ): void;
  getCanvas?: () => { style: { cursor: string } };
}

/** Callback that shows a report/closure popup. */
export type RenderReportPopup = (data: ReportPopupData, lngLat: LngLatLike) => void;

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Wires click popups for the community-report and official-closure marker
 * layers. Community reports render as unconfirmed; closures as official. Returns
 * a teardown fn.
 */
export function installReportPopups(
  map: ReportPopupMap,
  render: RenderReportPopup,
): () => void {
  const onCommunity = (e: MarkerClickEvent): void => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    render(
      {
        kind: 'community',
        id: str(p.id) || undefined,
        state: (p.state as ReportPopupData['state']) ?? undefined,
        barangay: str(p.barangay) || undefined,
        note: str(p.note) || undefined,
        updatedAt: num(p.updatedAt),
        source: str(p.source),
        severity: str(p.severity) || undefined,
        depth: str(p.depth) || undefined,
        passability: str(p.passability) || undefined,
        lifecycle: str(p.lifecycle) || undefined,
        confirmationCount: num(p.confirmationCount) ?? 0,
        lastConfirmedAt: num(p.lastConfirmedAt),
        resolvedAt: num(p.resolvedAt) || null,
      },
      e.lngLat,
    );
  };
  const onOfficial = (e: MarkerClickEvent): void => {
    const p = e.features?.[0]?.properties;
    if (!p) return;
    render(
      {
        kind: 'official',
        barangay: str(p.barangay) || undefined,
        note: str(p.note) || undefined,
        updatedAt: num(p.updatedAt),
        source: str(p.source),
      },
      e.lngLat,
    );
  };
  const setCursor = (c: string): void => {
    const canvas = map.getCanvas?.();
    if (canvas) canvas.style.cursor = c;
  };
  const enter = (): void => setCursor('pointer');
  const leave = (): void => setCursor('');

  // Clicking the pin, the badge, OR the invisible hit-target all open the same
  // report — the badge is never an independent clickable identity.
  const communityLayerIds = [
    COMMUNITY_REPORTS_LAYER_ID,
    COMMUNITY_REPORTS_BADGE_LAYER_ID,
    COMMUNITY_REPORTS_HITBOX_LAYER_ID,
  ];
  for (const id of communityLayerIds) map.on('click', id, onCommunity);
  map.on('click', OFFICIAL_CLOSURES_LAYER_ID, onOfficial);
  for (const id of [...communityLayerIds, OFFICIAL_CLOSURES_LAYER_ID]) {
    map.on('mouseenter', id, enter);
    map.on('mouseleave', id, leave);
  }

  return () => {
    for (const id of communityLayerIds) map.off('click', id, onCommunity);
    map.off('click', OFFICIAL_CLOSURES_LAYER_ID, onOfficial);
    for (const id of [...communityLayerIds, OFFICIAL_CLOSURES_LAYER_ID]) {
      map.off('mouseenter', id, enter);
      map.off('mouseleave', id, leave);
    }
  };
}
