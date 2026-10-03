// src/layers/historicalEvidenceLayer.ts
//
// Renders HISTORICAL flood evidence as its OWN distinct point layer — a muted
// violet/grey "archive" marker, deliberately UNLIKE the current-risk fills,
// community-report water pins, AI/web-evidence markers, and official-closure
// markers. Historical evidence is context only; this layer never participates
// in current-risk painting or official-closure state.
//
// Only EXACT/HIGH items with a resolved coordinate are plotted — APPROXIMATE /
// CITY_ONLY items are intentionally omitted from the map (surfaced in the panel
// list instead), so no fabricated point is ever shown.

import { APP_LAYER_SLOT, type MapLayerSpec } from './LayerRegistry';
import type { HistoricalFloodEvidence } from '../types/historicalEvidence';
import { mappableHistoricalEvidence } from '../services/historicalEvidenceAgent';
import type { ImageRegistryMap, MarkerImage } from './communityReportIcon';

export const HISTORICAL_EVIDENCE_SOURCE_ID = 'historicalEvidence';
export const HISTORICAL_EVIDENCE_LAYER_ID = 'historicalEvidence' as const;
export const HISTORICAL_EVIDENCE_ICON_ID = 'historical-evidence-marker';

/** Muted violet (historical) — intentionally NOT a current-severity red/orange. */
export const HISTORICAL_EVIDENCE_COLOR = '#5c6bc0';
/** Muted grey ring/border for the historical archive marker. */
export const HISTORICAL_EVIDENCE_RING = '#e8e8ef';

/** Minimal GeoJSON source spec (structural). */
export interface PointSourceSpec {
  type: 'geojson';
  data: GeoJSON.FeatureCollection;
}

/** The minimal map surface for installing the historical point layer + image. */
export interface HistoricalLayerMapAdapter extends ImageRegistryMap {
  addSource(id: string, source: PointSourceSpec): void;
  addLayer(layer: MapLayerSpec, beforeId?: string): void;
  getLayer?(id: string): unknown;
  setLayoutProperty?(id: string, name: string, value: unknown): unknown;
}

/** A GeoJSON source whose data can be replaced at runtime. */
export interface HistoricalSourceUpdateMap {
  getSource(id: string): { setData?(data: GeoJSON.FeatureCollection): void } | undefined;
}

/**
 * Projects HISTORICAL evidence to point features. ONLY mappable items
 * (EXACT/HIGH with a coordinate) are included; APPROXIMATE/CITY_ONLY are never
 * force-plotted. Each feature carries the fields the popup needs.
 */
export function historicalEvidenceToGeoJSON(
  evidence: readonly HistoricalFloodEvidence[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const e of mappableHistoricalEvidence(evidence)) {
    const [lng, lat] = e.coordinates!;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: e.id,
        title: e.title,
        city: e.city ?? '',
        locationDetail: e.locationDetail ?? '',
        floodCondition: e.floodCondition ?? '',
        reportedDepth: e.reportedDepth ?? '',
        passability: e.passability ?? 'UNKNOWN',
        precision: e.locationPrecision,
        sourceName: e.sourceName,
        sourceUrl: e.sourceUrl ?? '',
        eventLabel: e.eventLabel,
        eventDate: e.eventDate ?? '',
        publicationDate: e.publicationDate ?? '',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Builds a muted violet/grey "archive pin" icon as an RGBA buffer (no emoji,
 * no font). A rounded violet pin with a grey ring and a small white archive
 * mark (two horizontal drawers) so it reads as a historical/record marker,
 * clearly distinct from the community water teardrop and the official solid dot.
 */
export function buildHistoricalIcon(size = 26): MarkerImage {
  const w = size;
  const h = Math.round(size * 1.25);
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = w / 2;
  const r = w / 2 - 1;
  const border = Math.max(2, Math.round(size * 0.11));
  const tipY = h - 1;
  const [fr, fg, fb] = [0x5c, 0x6b, 0xc0]; // HISTORICAL_EVIDENCE_COLOR

  const set = (x: number, y: number, rr: number, gg: number, bb: number, aa: number): void => {
    const i = (y * w + x) * 4;
    data[i] = rr;
    data[i + 1] = gg;
    data[i + 2] = bb;
    data[i + 3] = aa;
  };

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const inCircle = dx * dx + dy * dy <= r * r;
      const tailHalf = (1 - (y - cy) / (tipY - cy)) * r;
      const inTail = y >= cy && Math.abs(dx) <= Math.max(0, tailHalf);
      if (!inCircle && !inTail) continue;

      const distEdge = r - Math.sqrt(dx * dx + dy * dy);
      const nearCircleEdge = inCircle && distEdge <= border;
      const nearTailEdge = inTail && Math.abs(Math.abs(dx) - Math.max(0, tailHalf)) <= border * 0.8;
      if (nearCircleEdge || nearTailEdge) {
        // Muted grey ring.
        set(x, y, 0xe8, 0xe8, 0xef, 255);
        continue;
      }

      // Archive mark: two thin white horizontal "drawer" lines near center.
      const line1 = Math.abs(y - (cy - size * 0.07)) <= Math.max(1, size * 0.035);
      const line2 = Math.abs(y - (cy + size * 0.07)) <= Math.max(1, size * 0.035);
      const withinMark = Math.abs(dx) <= size * 0.22;
      if ((line1 || line2) && withinMark) {
        set(x, y, 255, 255, 255, 255);
        continue;
      }
      set(x, y, fr, fg, fb, 255);
    }
  }
  return { width: w, height: h, data };
}

/** Registers the historical marker image (hasImage-guarded, style-reload safe). */
export function registerHistoricalEvidenceImage(map: ImageRegistryMap, size = 26): void {
  if (map.hasImage(HISTORICAL_EVIDENCE_ICON_ID)) return;
  map.addImage(HISTORICAL_EVIDENCE_ICON_ID, buildHistoricalIcon(size), { pixelRatio: 2 });
}

/**
 * Builds the historical-evidence symbol layer: the muted violet archive pin.
 * Reduced opacity so it reads as quiet/background context, not an active alert.
 */
export function buildHistoricalEvidenceLayer(): MapLayerSpec {
  return {
    id: HISTORICAL_EVIDENCE_LAYER_ID,
    type: 'symbol',
    slot: APP_LAYER_SLOT,
    source: HISTORICAL_EVIDENCE_SOURCE_ID,
    layout: {
      'icon-image': HISTORICAL_EVIDENCE_ICON_ID,
      'icon-size': 1,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-opacity': 0.9,
    },
  };
}

/**
 * Installs the historical-evidence overlay (image + source + layer), hidden by
 * default (opt-in). Added directly on the map (not a registry app-layer) so it
 * stays an independent historical context overlay.
 */
export function installHistoricalEvidence(
  map: HistoricalLayerMapAdapter,
  evidence: readonly HistoricalFloodEvidence[],
): void {
  registerHistoricalEvidenceImage(map);
  map.addSource(HISTORICAL_EVIDENCE_SOURCE_ID, {
    type: 'geojson',
    data: historicalEvidenceToGeoJSON(evidence),
  });
  map.addLayer(buildHistoricalEvidenceLayer());
  try {
    map.setLayoutProperty?.(HISTORICAL_EVIDENCE_LAYER_ID, 'visibility', 'none');
  } catch {
    // Best-effort hide.
  }
}

/** Toggles the historical-evidence layer visibility. */
export function setHistoricalEvidenceVisibility(
  map: { setLayoutProperty?(id: string, name: string, value: unknown): unknown; getLayer?(id: string): unknown },
  visible: boolean,
): void {
  try {
    if (map.getLayer?.(HISTORICAL_EVIDENCE_LAYER_ID) !== undefined) {
      map.setLayoutProperty?.(HISTORICAL_EVIDENCE_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    }
  } catch {
    // Best-effort.
  }
}

/** Replaces the historical-evidence source data at runtime (e.g. after filtering). */
export function updateHistoricalEvidenceSource(
  map: HistoricalSourceUpdateMap,
  evidence: readonly HistoricalFloodEvidence[],
): void {
  map.getSource(HISTORICAL_EVIDENCE_SOURCE_ID)?.setData?.(historicalEvidenceToGeoJSON(evidence));
}

/** Re-registers the historical image after a style reload (hasImage-guarded). */
export function reregisterHistoricalEvidenceImage(map: ImageRegistryMap): void {
  registerHistoricalEvidenceImage(map);
}
