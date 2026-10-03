// src/layers/floodClassification.property.test.ts
//
// Property-based tests (fast-check) + example unit tests for the pure flood
// validation & classification logic.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  FLOOD_STATES,
  classifyFloodState,
  validateFloodMetadata,
} from './floodClassification';
import type {
  FloodDataType,
  FloodItemMetadata,
  FloodReport,
  FloodState,
  VerificationStatus,
} from '../types/flood';
import type { RecencyConfig } from '../types/config';

const NUM_RUNS = 200;

const floodStates: readonly FloodState[] = [
  'RED',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'GRAY',
];
const dataTypes: readonly FloodDataType[] = [
  'SUSCEPTIBILITY',
  'REPORT',
  'COMMUNITY_REPORT',
];
const verificationStatuses: readonly VerificationStatus[] = [
  'VERIFIED',
  'UNCONFIRMED',
];

const stateArb = fc.constantFrom(...floodStates);
const validStateSet = new Set<FloodState>(floodStates);

/** Arbitrary for a fully-valid metadata object. */
const validMetadataArb: fc.Arbitrary<FloodItemMetadata> = fc.record({
  location: fc.record({
    lng: fc.double({ min: -180, max: 180, noNaN: true }),
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
  }),
  source: fc.string({ minLength: 1, maxLength: 40 }),
  dataType: fc.constantFrom(...dataTypes),
  updatedAt: fc.integer({ min: 0, max: 4_000_000_000 }),
  verificationStatus: fc.constantFrom(...verificationStatuses),
});

/** Arbitrary for a well-formed FloodReport with valid metadata. */
const reportArb: fc.Arbitrary<FloodReport> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 12 }),
  state: stateArb,
  passable: fc.option(fc.boolean(), { nil: undefined }),
  metadata: validMetadataArb,
});

const recencyArb: fc.Arbitrary<RecencyConfig> = fc.record({
  windowSeconds: fc.integer({ min: 1, max: 604_800 }),
});

// Feature: baharoute-metro-manila-map-foundation, Property 1: For any FloodReport (or absence of one), any now, and any RecencyConfig, classifyFloodState returns a value in exactly {RED, ORANGE, YELLOW, GREEN, GRAY} and never any other value.
// Validates: Requirements 12.1, 13.4
describe('Property 1: classification always yields a valid Flood_State', () => {
  it('returns a value within the five-value set for any input', () => {
    fc.assert(
      fc.property(
        fc.option(reportArb, { nil: undefined }),
        fc.integer({ min: -4_000_000_000, max: 8_000_000_000 }),
        recencyArb,
        (report, now, recency) => {
          const result = classifyFloodState(report, now, recency);
          expect(validStateSet.has(result)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// Feature: baharoute-metro-manila-map-foundation, Property 2: validateFloodMetadata returns true iff all of location, source, dataType, updatedAt, and verificationStatus are present; items missing any required field are rejected and never projected.
// Validates: Requirements 12.3
describe('Property 2: required metadata gates acceptance', () => {
  const requiredFields = [
    'location',
    'source',
    'dataType',
    'updatedAt',
    'verificationStatus',
  ] as const;

  it('accepts complete metadata and rejects metadata missing any required field', () => {
    fc.assert(
      fc.property(
        validMetadataArb,
        // subset of required fields to delete (empty subset => fully valid)
        fc.subarray([...requiredFields]),
        (valid, fieldsToRemove) => {
          // A complete, valid object must be accepted.
          expect(validateFloodMetadata(valid)).toBe(true);

          const candidate: Partial<FloodItemMetadata> = { ...valid };
          for (const field of fieldsToRemove) {
            delete candidate[field];
          }
          const expected = fieldsToRemove.length === 0;
          expect(validateFloodMetadata(candidate)).toBe(expected);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// Feature: baharoute-metro-manila-map-foundation, Property 3: classifyFloodState returns GREEN iff passability information is present AND (now - updatedAt) <= W; an item aged exactly W qualifies, and an item aged W+1 does not.
// Validates: Requirements 12.6, 12.5
describe('Property 3: GREEN only for present-and-recent passability', () => {
  it('GREEN iff passable === true and age within the window (edge inclusive)', () => {
    fc.assert(
      fc.property(
        validMetadataArb,
        fc.string({ minLength: 1, maxLength: 12 }),
        stateArb,
        fc.option(fc.boolean(), { nil: undefined }),
        recencyArb,
        // age offset relative to the window edge, spanning W-… to W+…
        fc.integer({ min: -100, max: 100 }),
        (metadata, id, state, passable, recency, ageOffset) => {
          const w = recency.windowSeconds;
          const age = w + ageOffset;
          // Keep updatedAt non-negative by choosing a large `now`.
          const now = 5_000_000_000;
          const updatedAt = now - age;
          const report: FloodReport = {
            id,
            state,
            passable,
            metadata: { ...metadata, updatedAt },
          };

          const result = classifyFloodState(report, now, recency);
          const inWindow = age <= w;
          const expectGreen = passable === true && inWindow;
          expect(result === 'GREEN').toBe(expectGreen);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// Feature: baharoute-metro-manila-map-foundation, Property 4: For any absent report, or any report whose (now - updatedAt) exceeds the window, classifyFloodState returns GRAY and never relabels it "no risk", "safe", or "clear".
// Validates: Requirements 12.7, 13.4
describe('Property 4: absent or stale information is GRAY, never "no risk"', () => {
  it('returns GRAY for absent reports and for reports older than the window', () => {
    fc.assert(
      fc.property(
        fc.option(reportArb, { nil: undefined }),
        recencyArb,
        // strictly-positive staleness beyond the window edge
        fc.integer({ min: 1, max: 1_000_000 }),
        (maybeReport, recency, beyond) => {
          const now = 5_000_000_000;

          if (maybeReport === undefined) {
            const result = classifyFloodState(undefined, now, recency);
            expect(result).toBe('GRAY');
            return;
          }

          // Force the report to be stale: age = W + beyond (> W).
          const staleUpdatedAt = now - (recency.windowSeconds + beyond);
          const staleReport: FloodReport = {
            ...maybeReport,
            metadata: { ...maybeReport.metadata, updatedAt: staleUpdatedAt },
          };
          const result = classifyFloodState(staleReport, now, recency);
          expect(result).toBe('GRAY');

          // GRAY must remain a represented state — never a banned relabeling.
          const banned = ['no risk', 'safe', 'clear'];
          expect(banned).not.toContain((result as string).toLowerCase());
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// -----------------------------------------------------------------------------
// Example unit tests (specific edge cases and acceptance criteria)
// -----------------------------------------------------------------------------

describe('classifyFloodState — example cases', () => {
  const recency: RecencyConfig = { windowSeconds: 21_600 };
  const now = 1_700_000_000;

  function reportAt(updatedAt: number, overrides: Partial<FloodReport> = {}): FloodReport {
    return {
      id: 'r1',
      state: 'GREEN',
      passable: true,
      metadata: {
        location: { lng: 121.0, lat: 14.6 },
        source: 'demo',
        dataType: 'REPORT',
        updatedAt,
        verificationStatus: 'VERIFIED',
      },
      ...overrides,
    };
  }

  it('returns GRAY for an undefined report', () => {
    expect(classifyFloodState(undefined, now, recency)).toBe('GRAY');
  });

  it('returns GREEN for passable report at the exact window edge', () => {
    const report = reportAt(now - recency.windowSeconds); // age === W
    expect(classifyFloodState(report, now, recency)).toBe('GREEN');
  });

  it('returns GRAY (not GREEN) for a passable report one second past the window', () => {
    const report = reportAt(now - recency.windowSeconds - 1); // age === W + 1
    expect(classifyFloodState(report, now, recency)).toBe('GRAY');
  });

  it('surfaces an in-window RED reported condition as-is', () => {
    const report = reportAt(now - 60, { state: 'RED', passable: undefined });
    expect(classifyFloodState(report, now, recency)).toBe('RED');
  });

  it('downgrades an in-window GREEN report lacking passability to GRAY', () => {
    const report = reportAt(now - 60, { state: 'GREEN', passable: undefined });
    expect(classifyFloodState(report, now, recency)).toBe('GRAY');
  });

  it('only ever returns one of the five defined states', () => {
    for (const state of FLOOD_STATES) {
      const report = reportAt(now - 60, { state, passable: false });
      expect(FLOOD_STATES).toContain(classifyFloodState(report, now, recency));
    }
  });
});

describe('validateFloodMetadata — example cases', () => {
  const valid: FloodItemMetadata = {
    location: { lng: 121.0, lat: 14.6 },
    source: 'demo',
    dataType: 'REPORT',
    updatedAt: 1_700_000_000,
    verificationStatus: 'UNCONFIRMED',
  };

  it('accepts complete metadata', () => {
    expect(validateFloodMetadata(valid)).toBe(true);
  });

  it('rejects metadata missing location', () => {
    const rest: Partial<FloodItemMetadata> = { ...valid };
    delete rest.location;
    expect(validateFloodMetadata(rest)).toBe(false);
  });

  it('rejects metadata with a non-numeric location coordinate', () => {
    expect(
      validateFloodMetadata({
        ...valid,
        location: { lng: Number.NaN, lat: 14.6 },
      }),
    ).toBe(false);
  });

  it('rejects metadata missing updatedAt', () => {
    const rest: Partial<FloodItemMetadata> = { ...valid };
    delete rest.updatedAt;
    expect(validateFloodMetadata(rest)).toBe(false);
  });
});
