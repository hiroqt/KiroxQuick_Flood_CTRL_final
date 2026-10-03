// src/services/historicalEvidenceAgent.test.ts
import { describe, it, expect } from 'vitest';
import {
  filterHistoricalEvidence,
  mappableHistoricalEvidence,
  buildAgentFlow,
} from './historicalEvidenceAgent';
import { historicalFloodEvidence } from '../data/historical/historicalFloodEvidence';

describe('filterHistoricalEvidence', () => {
  it('filters by event', () => {
    const r = filterHistoricalEvidence(historicalFloodEvidence, { eventId: 'ulysses-2020' });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((e) => e.eventId === 'ulysses-2020')).toBe(true);
  });

  it('filters by city', () => {
    const r = filterHistoricalEvidence(historicalFloodEvidence, { city: 'Manila' });
    expect(r.every((e) => e.city === 'Manila')).toBe(true);
  });

  it('filters by precision', () => {
    const r = filterHistoricalEvidence(historicalFloodEvidence, { precision: 'CITY_ONLY' });
    expect(r.every((e) => e.locationPrecision === 'CITY_ONLY')).toBe(true);
    expect(r.length).toBe(2);
  });

  it('filters by passability', () => {
    const r = filterHistoricalEvidence(historicalFloodEvidence, { passability: 'PASSABLE' });
    expect(r.every((e) => (e.passability ?? 'UNKNOWN') === 'PASSABLE')).toBe(true);
    expect(r.length).toBe(1);
  });

  it('combines filters (event + city + precision)', () => {
    const r = filterHistoricalEvidence(historicalFloodEvidence, {
      eventId: 'ulysses-2020',
      city: 'Manila',
      precision: 'EXACT',
    });
    expect(r.every((e) => e.eventId === 'ulysses-2020' && e.city === 'Manila' && e.locationPrecision === 'EXACT')).toBe(true);
  });

  it('no filter returns all', () => {
    expect(filterHistoricalEvidence(historicalFloodEvidence, {})).toHaveLength(15);
  });
});

describe('mappableHistoricalEvidence', () => {
  it('includes only EXACT/HIGH items that have coordinates', () => {
    const mappable = mappableHistoricalEvidence(historicalFloodEvidence);
    expect(mappable.length).toBeGreaterThan(0);
    for (const e of mappable) {
      expect(['EXACT', 'HIGH']).toContain(e.locationPrecision);
      expect(e.coordinates).toBeDefined();
    }
    // CITY_ONLY / APPROXIMATE never appear.
    expect(mappable.some((e) => e.locationPrecision === 'CITY_ONLY')).toBe(false);
    expect(mappable.some((e) => e.locationPrecision === 'APPROXIMATE')).toBe(false);
  });
});

describe('buildAgentFlow (staged demo, derived from real data)', () => {
  it('produces the seven stages with honest, data-derived results', () => {
    const flow = buildAgentFlow(historicalFloodEvidence, historicalFloodEvidence);
    const keys = flow.map((s) => s.key);
    expect(keys).toEqual([
      'research',
      'filter',
      'location',
      'geography',
      'condition',
      'provenance',
      'map',
    ]);
    expect(flow[0].result).toContain('15 historical items');
    // No "live"/"real-time" wording anywhere in the flow.
    for (const s of flow) {
      expect(s.result.toLowerCase()).not.toContain('live');
      expect(s.result.toLowerCase()).not.toContain('real-time');
    }
  });

  it('handles an empty filtered set honestly (no items)', () => {
    const flow = buildAgentFlow(historicalFloodEvidence, []);
    expect(flow[1].result.toLowerCase()).toContain('no historical items');
  });
});
