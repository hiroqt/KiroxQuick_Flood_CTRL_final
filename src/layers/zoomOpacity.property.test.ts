import { describe, it } from 'vitest';
import fc from 'fast-check';
import { susceptibilityFillOpacity } from './zoomOpacity';

// Feature: baharoute-metro-manila-map-foundation, Property 8: Susceptibility opacity is non-increasing as zoom increases
//
// Validates: Requirements 2.1, 12.2
//
// For any two zoom levels z1 < z2 within a sensible range, the evaluated
// susceptibility fill-opacity is non-increasing: opacity(z1) >= opacity(z2).
// Susceptibility polygons are therefore at least as prominent at overview zoom
// as at street level and never become more dominant as the user zooms in.
describe('Property 8: susceptibility opacity is non-increasing as zoom increases', () => {
  it('opacity(z1) >= opacity(z2) whenever z1 < z2', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 22, noNaN: true }),
        fc.double({ min: 0, max: 22, noNaN: true }),
        (a, b) => {
          const z1 = Math.min(a, b);
          const z2 = Math.max(a, b);
          return susceptibilityFillOpacity(z1) >= susceptibilityFillOpacity(z2);
        },
      ),
      { numRuns: 200 },
    );
  });
});
