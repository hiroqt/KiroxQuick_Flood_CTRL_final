import { describe, expect, it } from 'vitest';
import {
  SUSCEPTIBILITY_OPACITY_STOPS,
  susceptibilityFillOpacity,
  susceptibilityFillOpacityExpression,
} from './zoomOpacity';

describe('susceptibilityFillOpacity', () => {
  it('returns the exact opacity at each design stop', () => {
    expect(susceptibilityFillOpacity(10)).toBeCloseTo(0.45, 10);
    expect(susceptibilityFillOpacity(13)).toBeCloseTo(0.3, 10);
    expect(susceptibilityFillOpacity(15)).toBeCloseTo(0.12, 10);
    expect(susceptibilityFillOpacity(17)).toBeCloseTo(0.06, 10);
  });

  it('linearly interpolates between stops', () => {
    // Midpoint of z10 (0.45) and z13 (0.30) at z11.5 → 0.375.
    expect(susceptibilityFillOpacity(11.5)).toBeCloseTo(0.375, 10);
    // Midpoint of z13 (0.30) and z15 (0.12) at z14 → 0.21.
    expect(susceptibilityFillOpacity(14)).toBeCloseTo(0.21, 10);
    // Midpoint of z15 (0.12) and z17 (0.06) at z16 → 0.09.
    expect(susceptibilityFillOpacity(16)).toBeCloseTo(0.09, 10);
  });

  it('clamps below the first stop to the most-prominent opacity', () => {
    expect(susceptibilityFillOpacity(9)).toBe(0.45);
    expect(susceptibilityFillOpacity(0)).toBe(0.45);
    expect(susceptibilityFillOpacity(-5)).toBe(0.45);
  });

  it('clamps above the last stop to the most-faded opacity', () => {
    expect(susceptibilityFillOpacity(18)).toBe(0.06);
    expect(susceptibilityFillOpacity(22)).toBe(0.06);
    expect(susceptibilityFillOpacity(100)).toBe(0.06);
  });

  it('treats NaN as the lower clamp and never throws', () => {
    expect(() => susceptibilityFillOpacity(Number.NaN)).not.toThrow();
    expect(susceptibilityFillOpacity(Number.NaN)).toBe(0.45);
  });
});

describe('susceptibilityFillOpacityExpression', () => {
  it('builds the Mapbox GL JS zoom-interpolated paint expression from the shared stops', () => {
    expect(susceptibilityFillOpacityExpression()).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      10,
      0.45,
      13,
      0.3,
      15,
      0.12,
      17,
      0.06,
    ]);
  });

  it('derives its stops from the single source of truth', () => {
    const expr = susceptibilityFillOpacityExpression();
    const flatStops = SUSCEPTIBILITY_OPACITY_STOPS.flatMap((s) => [
      s.zoom,
      s.opacity,
    ]);
    expect(expr.slice(3)).toEqual(flatStops);
  });
});
