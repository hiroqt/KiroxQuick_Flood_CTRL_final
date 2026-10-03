// src/layers/visualMapping.property.test.ts
//
// Property-based tests (fast-check) + example unit tests for the pure
// susceptibility → visual mapping and FloodState → display-label logic.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  FLOOD_STATE_LABELS,
  floodStateLabel,
  susceptibilityColor,
  susceptibilityLabel,
  susceptibilityPattern,
  visualTreatment,
} from './visualMapping';
import { SUSCEPTIBILITY_COLORS } from '../map/basemap/colorTokens';
import type { FloodDataType, FloodState, SusceptibilityLevel } from '../types/flood';

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
const levels: readonly SusceptibilityLevel[] = ['HIGH', 'MODERATE', 'LOW'];

const stateArb = fc.constantFrom(...floodStates);
const dataTypeArb = fc.constantFrom(...dataTypes);

/** The complete set of approved display labels — nothing outside this is valid. */
const approvedLabels = new Set<string>(Object.values(FLOOD_STATE_LABELS));

/** Words that must never appear in any Flood_State display label (Req 13.1, 13.4). */
const BANNED_SUBSTRINGS = ['no risk', 'safe', 'clear'];

// Feature: baharoute-metro-manila-map-foundation, Property 5: For any FloodState, its display label is drawn only from the approved RED/ORANGE/YELLOW/GREEN/GRAY vocabulary, and GRAY maps to an "Unknown"-style label — never to "no risk", "safe", or "clear".
// Validates: Requirements 13.4, 13.1
describe('Property 5: state labels stay within the approved vocabulary', () => {
  it('returns only approved labels, GRAY is "Unknown", and never a banned word', () => {
    fc.assert(
      fc.property(stateArb, (state) => {
        const label = floodStateLabel(state);

        // Label is drawn only from the approved vocabulary.
        expect(approvedLabels.has(label)).toBe(true);

        // GRAY maps to an "Unknown"-style label.
        if (state === 'GRAY') {
          expect(label.toLowerCase()).toContain('unknown');
        }

        // No label ever contains a banned "no risk"/"safe"/"clear" designation.
        const lower = label.toLowerCase();
        for (const banned of BANNED_SUBSTRINGS) {
          expect(lower).not.toContain(banned);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// Feature: baharoute-metro-manila-map-foundation, Property 6: For any flood item, the chosen visual treatment is a translucent area-polygon fill iff dataType === 'SUSCEPTIBILITY', and a symbol/segment (report) treatment iff dataType is 'REPORT' or 'COMMUNITY_REPORT'; the two treatment sets are disjoint.
// Validates: Requirements 12.2, 14.1
describe('Property 6: susceptibility and report visual treatments are mutually exclusive', () => {
  it('is polygon-fill iff SUSCEPTIBILITY and symbol iff a report type; sets are disjoint', () => {
    fc.assert(
      fc.property(dataTypeArb, (dataType) => {
        const treatment = visualTreatment(dataType);
        const isSusceptibility = dataType === 'SUSCEPTIBILITY';
        const isReport = dataType === 'REPORT' || dataType === 'COMMUNITY_REPORT';

        // Biconditional: polygon-fill iff SUSCEPTIBILITY.
        expect(treatment === 'polygon-fill').toBe(isSusceptibility);
        // Biconditional: symbol iff a report type.
        expect(treatment === 'symbol').toBe(isReport);

        // Disjointness: exactly one treatment, never both.
        expect(isSusceptibility && isReport).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// -----------------------------------------------------------------------------
// Example unit tests (specific edge cases and acceptance criteria)
// -----------------------------------------------------------------------------

describe('floodStateLabel — example cases', () => {
  it('maps GRAY to "Unknown"', () => {
    expect(floodStateLabel('GRAY')).toBe('Unknown');
  });

  it('uses the approved display vocabulary for each state', () => {
    expect(floodStateLabel('RED')).toBe('Reported Flooding');
    expect(floodStateLabel('ORANGE')).toBe('Elevated Flood Exposure');
    expect(floodStateLabel('YELLOW')).toBe('Caution');
    expect(floodStateLabel('GREEN')).toBe('Recently Reported Passable');
    expect(floodStateLabel('GRAY')).toBe('Unknown');
  });

  it('never produces a label containing "safe", "clear", or "no risk"', () => {
    for (const state of floodStates) {
      const lower = floodStateLabel(state).toLowerCase();
      expect(lower).not.toContain('no risk');
      expect(lower).not.toContain('safe');
      expect(lower).not.toContain('clear');
    }
  });
});

describe('susceptibilityColor — example cases', () => {
  it('maps each level to its reserved color token', () => {
    expect(susceptibilityColor('HIGH')).toBe(SUSCEPTIBILITY_COLORS.HIGH);
    expect(susceptibilityColor('MODERATE')).toBe(SUSCEPTIBILITY_COLORS.MODERATE);
    expect(susceptibilityColor('LOW')).toBe(SUSCEPTIBILITY_COLORS.LOW);
  });

  it('uses reserved (saturated) colors, never a base color', () => {
    for (const level of levels) {
      // Reserved susceptibility colors have saturation > 30%.
      expect(susceptibilityColor(level).hsl.s).toBeGreaterThan(30);
    }
  });
});

describe('susceptibilityPattern / susceptibilityLabel — non-color cues (Req 11.4)', () => {
  it('provides a distinct non-color cue and text label per level', () => {
    expect(susceptibilityPattern('HIGH')).toEqual({
      pattern: 'hatch-dense',
      icon: 'susceptibility-high',
      label: 'High',
    });
    expect(susceptibilityPattern('MODERATE')).toEqual({
      pattern: 'hatch-medium',
      icon: 'susceptibility-moderate',
      label: 'Moderate',
    });
    expect(susceptibilityPattern('LOW')).toEqual({
      pattern: 'hatch-light',
      icon: 'susceptibility-low',
      label: 'Low',
    });
  });

  it('every level carries a color AND a distinct non-color cue', () => {
    const patterns = new Set(levels.map((l) => susceptibilityPattern(l).pattern));
    expect(patterns.size).toBe(levels.length); // patterns are distinct
    for (const level of levels) {
      expect(susceptibilityColor(level)).toBeDefined();
      expect(susceptibilityPattern(level).label).toBe(susceptibilityLabel(level));
    }
  });

  it('maps each level to its text label', () => {
    expect(susceptibilityLabel('HIGH')).toBe('High');
    expect(susceptibilityLabel('MODERATE')).toBe('Moderate');
    expect(susceptibilityLabel('LOW')).toBe('Low');
  });
});

describe('visualTreatment — example cases', () => {
  it('renders susceptibility as a polygon fill', () => {
    expect(visualTreatment('SUSCEPTIBILITY')).toBe('polygon-fill');
  });

  it('renders reports and community reports as symbols', () => {
    expect(visualTreatment('REPORT')).toBe('symbol');
    expect(visualTreatment('COMMUNITY_REPORT')).toBe('symbol');
  });
});
