// src/layers/historicalEvidenceLayer.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  historicalEvidenceToGeoJSON,
  buildHistoricalEvidenceLayer,
  buildHistoricalIcon,
  registerHistoricalEvidenceImage,
  HISTORICAL_EVIDENCE_LAYER_ID,
  HISTORICAL_EVIDENCE_ICON_ID,
  HISTORICAL_EVIDENCE_COLOR,
} from './historicalEvidenceLayer';
import { buildOfficialClosuresLayer } from './reportMarkersLayer';
import { historicalFloodEvidence } from '../data/historical/historicalFloodEvidence';
import type { ImageRegistryMap } from './communityReportIcon';

describe('historicalEvidenceToGeoJSON', () => {
  it('plots ONLY mappable (EXACT/HIGH-with-coords) items', () => {
    const fc = historicalEvidenceToGeoJSON(historicalFloodEvidence);
    // All features must correspond to items that have coordinates.
    const mappableCount = historicalFloodEvidence.filter((e) => e.coordinates).length;
    expect(fc.features).toHaveLength(mappableCount);
    for (const f of fc.features) {
      expect(['EXACT', 'HIGH']).toContain(f.properties?.precision);
    }
  });

  it('never plots CITY_ONLY / APPROXIMATE items', () => {
    const fc = historicalEvidenceToGeoJSON(historicalFloodEvidence);
    for (const f of fc.features) {
      expect(f.properties?.precision).not.toBe('CITY_ONLY');
      expect(f.properties?.precision).not.toBe('APPROXIMATE');
    }
  });

  it('carries the fields the popup needs (title/condition/source/dates/precision)', () => {
    const fc = historicalEvidenceToGeoJSON(historicalFloodEvidence);
    const f = fc.features[0];
    expect(f.properties?.title).toBeTruthy();
    expect(f.properties?.eventDate).toBeDefined();
    expect(f.properties?.publicationDate).toBeDefined();
    expect(f.properties?.sourceName).toBeTruthy();
  });
});

describe('buildHistoricalEvidenceLayer (distinct violet archive marker)', () => {
  it('is a symbol icon layer using the historical icon (not a current-risk fill or official circle)', () => {
    const layer = buildHistoricalEvidenceLayer();
    expect(layer.id).toBe(HISTORICAL_EVIDENCE_LAYER_ID);
    expect(layer.type).toBe('symbol');
    expect((layer.layout as Record<string, unknown>)['icon-image']).toBe(HISTORICAL_EVIDENCE_ICON_ID);
    // Official closures remain a solid circle — a completely different marker.
    const official = buildOfficialClosuresLayer();
    expect(official.type).toBe('circle');
    expect(layer.type).not.toBe(official.type);
  });

  it('uses a muted violet color, not current-severity red/orange', () => {
    expect(HISTORICAL_EVIDENCE_COLOR).toBe('#5c6bc0');
    expect(HISTORICAL_EVIDENCE_COLOR).not.toMatch(/^#e|^#d32|^#ef|^#c62/i);
  });
});

describe('buildHistoricalIcon + registration', () => {
  it('builds an RGBA image buffer of the right size', () => {
    const img = buildHistoricalIcon(26);
    expect(img.width).toBe(26);
    expect(img.data.length).toBe(img.width * img.height * 4);
  });

  it('registers hasImage-guarded (style-reload safe, no duplicate addImage)', () => {
    const images = new Set<string>();
    const addImage = vi.fn((id: string) => images.add(id));
    const hasImage = vi.fn((id: string) => images.has(id));
    const map: ImageRegistryMap = {
      addImage: addImage as unknown as ImageRegistryMap['addImage'],
      hasImage,
    };
    registerHistoricalEvidenceImage(map);
    registerHistoricalEvidenceImage(map); // simulate a style reload
    expect(addImage).toHaveBeenCalledTimes(1);
    expect(images.has(HISTORICAL_EVIDENCE_ICON_ID)).toBe(true);
  });
});
