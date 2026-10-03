// src/layers/aiFloodEvidenceLayer.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  evidenceToGeoJSON,
  buildAiFloodEvidenceLayer,
  installAiFloodEvidence,
  installAiFloodEvidencePopups,
  updateAiFloodEvidenceSource,
  AI_FLOOD_EVIDENCE_LAYER_ID,
  AI_FLOOD_EVIDENCE_SOURCE_ID,
} from './aiFloodEvidenceLayer';
import { APP_LAYER_ORDER, LayerRegistry, type MapLayerAdapter, type MapLayerSpec } from './LayerRegistry';
import type { FloodEvidence } from '../types/evidence';
import { makeProvenance } from '../types/provenance';

function evidence(over: Partial<FloodEvidence> = {}): FloodEvidence {
  return {
    id: 'e1',
    eventType: 'FLOODING',
    locationText: 'Marikina',
    psgc: 'PH1307402001',
    coordinates: [121.0966, 14.6349],
    locationUnresolved: false,
    summary: 'Flood evidence',
    sourceName: 'news.example',
    sourceUrl: 'https://news.example/1',
    sourceType: 'NEWS',
    confidence: 'UNVERIFIED',
    status: 'ACTIVE',
    isSynthetic: false,
    provenance: makeProvenance('AI_WEB_EVIDENCE'),
    ...over,
  };
}

describe('evidenceToGeoJSON', () => {
  it('plots only evidence with resolved coordinates (never fake points)', () => {
    const fc = evidenceToGeoJSON([
      evidence({ id: 'resolved' }),
      evidence({ id: 'unresolved', coordinates: undefined, locationUnresolved: true }),
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].properties?.id).toBe('resolved');
  });

  it('carries status + synthetic flag into feature properties', () => {
    const fc = evidenceToGeoJSON([evidence({ status: 'STALE', isSynthetic: true })]);
    expect(fc.features[0].properties?.status).toBe('STALE');
    expect(fc.features[0].properties?.synthetic).toBe(1);
  });
});

describe('buildAiFloodEvidenceLayer', () => {
  it('is a circle layer on the app slot with its own source', () => {
    const layer = buildAiFloodEvidenceLayer();
    expect(layer.id).toBe(AI_FLOOD_EVIDENCE_LAYER_ID);
    expect(layer.type).toBe('circle');
    expect(layer.source).toBe(AI_FLOOD_EVIDENCE_SOURCE_ID);
  });

  it('aiFloodEvidence is a registered app layer id', () => {
    expect((APP_LAYER_ORDER as readonly string[]).includes('aiFloodEvidence')).toBe(true);
  });
});

describe('install + update', () => {
  class FakeMap implements MapLayerAdapter {
    readonly stack: string[] = [];
    readonly sources = new Map<string, unknown>();
    addLayer(layer: MapLayerSpec): void {
      this.stack.push(layer.id);
    }
    removeLayer(): void {}
    setLayoutProperty(): void {}
    getLayer(id: string): unknown {
      return this.stack.includes(id) ? { id } : undefined;
    }
    addSource(id: string, source: unknown): void {
      this.sources.set(id, source);
    }
  }

  it('installs the source + layer and starts hidden', () => {
    const map = new FakeMap();
    const registry = new LayerRegistry(map);
    installAiFloodEvidence(map, registry, [evidence()]);
    expect(map.sources.has(AI_FLOOD_EVIDENCE_SOURCE_ID)).toBe(true);
    expect(registry.has('aiFloodEvidence')).toBe(true);
  });

  it('updates the source data at runtime via setData', () => {
    const setData = vi.fn();
    const map = { getSource: () => ({ setData }) };
    updateAiFloodEvidenceSource(map, [evidence()]);
    expect(setData).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the source is missing (never throws)', () => {
    const map = { getSource: () => undefined };
    expect(() => updateAiFloodEvidenceSource(map, [evidence()])).not.toThrow();
  });
});

describe('installAiFloodEvidencePopups', () => {
  interface Handler {
    (e: { features?: Array<{ properties?: Record<string, unknown> | null }>; lngLat: { lng: number; lat: number } }): void;
  }
  class PopupFakeMap {
    readonly handlers = new Map<string, Handler>();
    on(event: string, layerId: string, handler: Handler): void {
      this.handlers.set(`${event}:${layerId}`, handler);
    }
    off(): void {}
    getCanvas() {
      return { style: { cursor: '' } };
    }
  }

  it('renders a clicked marker payload and returns a teardown fn', () => {
    const map = new PopupFakeMap();
    const seen: Array<Record<string, unknown>> = [];
    const teardown = installAiFloodEvidencePopups(map, (data) => seen.push(data as unknown as Record<string, unknown>));
    const click = map.handlers.get('click:aiFloodEvidence');
    expect(click).toBeDefined();
    click!({
      features: [
        {
          properties: {
            eventType: 'ROAD_FLOODED',
            confidence: 'CORROBORATED',
            status: 'ACTIVE',
            synthetic: 1,
            sourceName: 'news.example',
            sourceUrl: 'https://news.example/1',
            summary: 'Road flooding reported',
            city: 'Marikina',
            barangay: '',
            publishedAt: '2026-01-03T12:00:00.000Z',
          },
        },
      ],
      lngLat: { lng: 121, lat: 14.6 },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].confidence).toBe('CORROBORATED');
    expect(seen[0].synthetic).toBe(true);
    expect(typeof teardown).toBe('function');
  });
});
