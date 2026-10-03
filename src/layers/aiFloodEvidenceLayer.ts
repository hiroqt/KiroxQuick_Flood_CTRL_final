// src/layers/aiFloodEvidenceLayer.ts
//
// Renders AI-discovered web flood evidence as its OWN point layer, visually
// DISTINCT from community reports and official closures so a reader never
// mistakes an unofficial news signal for an official confirmation. Mirrors the
// structure of reportMarkersLayer.ts (source id == layer id, toGeoJSON / build
// / install / popup, tiny structural adapters) and keeps evidence in its own
// source — never folded into current-risk or historical feature-state.
//
// Evidence markers use a distinct CYAN/TEAL diamond-ish circle with a dashed
// white ring. STALE evidence is drawn fainter. Demo/synthetic evidence is drawn
// the same but carries a `synthetic` property the popup surfaces as "DEMO".

import { APP_LAYER_SLOT, LayerRegistry, type MapLayerSpec } from './LayerRegistry';
import type { FloodEvidence } from '../types/evidence';

export type { MapLayerSpec };

export const AI_FLOOD_EVIDENCE_SOURCE_ID = 'aiFloodEvidence';
export const AI_FLOOD_EVIDENCE_LAYER_ID = 'aiFloodEvidence' as const;

/** Distinct marker color for AI web evidence (teal) — not a flood-risk color. */
export const AI_EVIDENCE_COLOR = '#0d9488';

/** Minimal GeoJSON source spec (structural). */
export interface PointSourceSpec {
  type: 'geojson';
  data: GeoJSON.FeatureCollection;
}

/**
 * Projects evidence to point features. ONLY evidence with resolved coordinates
 * is placed on the map; location-unresolved evidence is intentionally omitted
 * (it is surfaced in the UI list, but never force-plotted at a fake point).
 */
export function evidenceToGeoJSON(
  evidence: readonly FloodEvidence[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const e of evidence) {
    if (!e.coordinates) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.coordinates[0], e.coordinates[1]] },
      properties: {
        id: e.id,
        eventType: e.eventType,
        confidence: e.confidence,
        status: e.status,
        synthetic: e.isSynthetic ? 1 : 0,
        sourceName: e.sourceName,
        sourceUrl: e.sourceUrl,
        summary: e.summary,
        city: e.city ?? '',
        barangay: e.barangay ?? '',
        publishedAt: e.publishedAt ?? '',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** The minimal map surface for installing point layers. */
export interface PointLayerMapAdapter {
  addSource(id: string, source: PointSourceSpec): void;
}

/** A GeoJSON source whose data can be replaced at runtime (Mapbox-compatible). */
export interface PointSourceUpdateMap {
  getSource(id: string): { setData?(data: GeoJSON.FeatureCollection): void } | undefined;
}

/**
 * Builds the AI web-evidence circle layer. Deliberately distinct from reports
 * (small, state-colored) and closures (large, dark-ringed): a teal fill with a
 * dashed-look thin white ring. STALE items are drawn fainter via opacity so a
 * data-quality state is visible, never silently dropped.
 */
export function buildAiFloodEvidenceLayer(): MapLayerSpec {
  return {
    id: AI_FLOOD_EVIDENCE_LAYER_ID,
    type: 'circle',
    slot: APP_LAYER_SLOT,
    source: AI_FLOOD_EVIDENCE_SOURCE_ID,
    paint: {
      'circle-radius': 6,
      'circle-color': AI_EVIDENCE_COLOR,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
      // STALE evidence is drawn fainter than ACTIVE.
      'circle-opacity': ['match', ['get', 'status'], 'STALE', 0.45, 0.85],
    },
  };
}

/**
 * Installs the AI web-evidence point layer, starting HIDDEN (opt-in via the
 * LayerControl), matching the report/closure overlay convention.
 */
export function installAiFloodEvidence(
  map: PointLayerMapAdapter,
  registry: LayerRegistry,
  evidence: readonly FloodEvidence[],
): void {
  map.addSource(AI_FLOOD_EVIDENCE_SOURCE_ID, {
    type: 'geojson',
    data: evidenceToGeoJSON(evidence),
  });
  registry.addAppLayer(buildAiFloodEvidenceLayer());
  registry.setVisibility(AI_FLOOD_EVIDENCE_LAYER_ID, false);
}

/** Replaces the evidence source data at runtime (e.g. after a GDELT refresh). */
export function updateAiFloodEvidenceSource(
  map: PointSourceUpdateMap,
  evidence: readonly FloodEvidence[],
): void {
  const source = map.getSource(AI_FLOOD_EVIDENCE_SOURCE_ID);
  source?.setData?.(evidenceToGeoJSON(evidence));
}

// ---------------------------------------------------------------------------
// Click popup for the AI web-evidence markers.
// ---------------------------------------------------------------------------

/** A minimal lng/lat pair (structural, Mapbox-compatible). */
export interface LngLatLike {
  lng: number;
  lat: number;
}

/** The data the evidence popup renderer receives for a clicked marker. */
export interface EvidencePopupData {
  eventType: string;
  confidence: string;
  status: string;
  synthetic: boolean;
  sourceName: string;
  sourceUrl: string;
  summary: string;
  city: string;
  barangay: string;
  publishedAt: string;
}

interface MarkerClickEvent {
  features?: Array<{ properties?: Record<string, unknown> | null }>;
  lngLat: LngLatLike;
}

/** The minimal map surface needed to wire the evidence popup. */
export interface EvidencePopupMap {
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

/** Callback that shows an evidence popup for a clicked marker. */
export type RenderEvidencePopup = (data: EvidencePopupData, lngLat: LngLatLike) => void;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * Wires a click popup for the AI web-evidence marker layer. Returns a teardown
 * fn. Markers only exist for location-resolved evidence (see
 * {@link evidenceToGeoJSON}), so clicking never surfaces a faked point.
 */
export function installAiFloodEvidencePopups(
  map: EvidencePopupMap,
  render: RenderEvidencePopup,
): () => void {
  const onClick = (e: MarkerClickEvent): void => {
    const p = e.features?.[0]?.properties ?? {};
    render(
      {
        eventType: str(p.eventType),
        confidence: str(p.confidence),
        status: str(p.status),
        synthetic: p.synthetic === 1 || p.synthetic === true,
        sourceName: str(p.sourceName),
        sourceUrl: str(p.sourceUrl),
        summary: str(p.summary),
        city: str(p.city),
        barangay: str(p.barangay),
        publishedAt: str(p.publishedAt),
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

  map.on('click', AI_FLOOD_EVIDENCE_LAYER_ID, onClick);
  map.on('mouseenter', AI_FLOOD_EVIDENCE_LAYER_ID, enter);
  map.on('mouseleave', AI_FLOOD_EVIDENCE_LAYER_ID, leave);

  return () => {
    map.off('click', AI_FLOOD_EVIDENCE_LAYER_ID, onClick);
    map.off('mouseenter', AI_FLOOD_EVIDENCE_LAYER_ID, enter);
    map.off('mouseleave', AI_FLOOD_EVIDENCE_LAYER_ID, leave);
  };
}
