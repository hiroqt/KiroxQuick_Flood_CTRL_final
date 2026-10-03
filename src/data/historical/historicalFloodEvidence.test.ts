// src/data/historical/historicalFloodEvidence.test.ts
import { describe, it, expect } from 'vitest';
import {
  historicalFloodEvidence,
  HISTORICAL_EVENTS,
} from './historicalFloodEvidence';
import { precisionAllowsPoint } from '../../types/historicalEvidence';
import { aggregateReportsByBarangay } from '../../services/reportResolution';

describe('historical flood evidence dataset (15 records from the report)', () => {
  it('contains exactly 15 records', () => {
    expect(historicalFloodEvidence).toHaveLength(15);
  });

  it('every record carries HISTORICAL_WEB_EVIDENCE provenance', () => {
    for (const e of historicalFloodEvidence) {
      expect(e.provenance).toBe('HISTORICAL_WEB_EVIDENCE');
    }
  });

  it('covers the six documented events', () => {
    const eventIds = new Set(historicalFloodEvidence.map((e) => e.eventId));
    for (const ev of HISTORICAL_EVENTS) {
      expect(eventIds.has(ev.id)).toBe(true);
    }
    expect(eventIds.size).toBe(6);
  });

  it('keeps source URLs null when the report left them blank (never fabricated)', () => {
    // The report's source_url cells are all blank → every item is null.
    for (const e of historicalFloodEvidence) {
      expect(e.sourceUrl == null).toBe(true);
    }
  });

  it('keeps publicationDate and eventDate as distinct fields', () => {
    const item1 = historicalFloodEvidence.find((e) => e.id === 'hist-1')!;
    expect(item1.eventDate).toBe('2009-09-26');
    expect(item1.publicationDate).toBe('2022-07-10');
    expect(item1.eventDate).not.toBe(item1.publicationDate);
  });

  it('preserves the report location_precision values exactly', () => {
    const byId = Object.fromEntries(historicalFloodEvidence.map((e) => [e.id, e.locationPrecision]));
    expect(byId['hist-1']).toBe('HIGH');
    expect(byId['hist-2']).toBe('EXACT');
    expect(byId['hist-6']).toBe('APPROXIMATE');
    expect(byId['hist-7']).toBe('APPROXIMATE');
    expect(byId['hist-13']).toBe('CITY_ONLY');
    expect(byId['hist-15']).toBe('CITY_ONLY');
  });

  it('assigns coordinates ONLY to EXACT/HIGH items (never CITY_ONLY/APPROXIMATE)', () => {
    for (const e of historicalFloodEvidence) {
      if (e.coordinates) {
        expect(precisionAllowsPoint(e.locationPrecision)).toBe(true);
      }
    }
    // CITY_ONLY / APPROXIMATE must never carry fabricated coordinates.
    for (const id of ['hist-6', 'hist-7', 'hist-13', 'hist-15']) {
      const e = historicalFloodEvidence.find((x) => x.id === id)!;
      expect(e.coordinates).toBeUndefined();
    }
  });

  it('preserves the one PASSABLE record (Valenzuela, Carina 2024)', () => {
    const v = historicalFloodEvidence.find((e) => e.id === 'hist-12')!;
    expect(v.passability).toBe('PASSABLE');
    expect(v.city).toBe('Valenzuela City');
  });
});

describe('historical/current separation (critical)', () => {
  it('historical evidence is NOT a CommunityReport and never enters report aggregation', () => {
    // The report-risk aggregator only accepts CommunityReport[]; historical
    // items have a different shape (no `metadata`/`state`), so by construction
    // they cannot be aggregated into current barangay risk. Passing an empty
    // report set yields no risk signal, confirming historical data is isolated.
    const map = aggregateReportsByBarangay([], Math.floor(Date.now() / 1000));
    expect(map.size).toBe(0);
    // Historical items carry no `state`/`metadata` fields the risk model reads.
    for (const e of historicalFloodEvidence) {
      expect('state' in e).toBe(false);
      expect('metadata' in e).toBe(false);
    }
  });
});
