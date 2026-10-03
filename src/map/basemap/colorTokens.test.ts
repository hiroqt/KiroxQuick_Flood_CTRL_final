// src/map/basemap/colorTokens.test.ts
//
// Guards the base/flood color-token discipline (Req 2.1, 2.2). These invariants
// previously lived in basemapStyle.test.ts alongside the hand-authored MapTiler
// style assertions; after the Group 2 Mapbox engine swap the basemap is a stock
// Mapbox style (no hand-authored base layers to inspect), so the token
// guarantees are asserted directly against colorTokens here. This preserves the
// flood-palette guarantee: reserved flood colors are saturated (> 30%) and are
// disjoint from the muted base-feature palette (≤ 30%).
import { describe, expect, it } from 'vitest';
import {
  BASE_COLOR_TOKENS,
  MAX_BASE_SATURATION,
  RESERVED_COLOR_TOKENS,
  saturationOf,
} from './colorTokens';

describe('basemap color tokens — saturation rule (Req 2.1, 2.2)', () => {
  it('every base feature token has saturation <= 30%', () => {
    for (const t of BASE_COLOR_TOKENS) {
      expect(t.hsl.s).toBeLessThanOrEqual(MAX_BASE_SATURATION);
      // Cross-check the stored HSL against a fresh computation from the hex.
      expect(saturationOf(t.hex)).toBeCloseTo(t.hsl.s, 6);
    }
  });

  it('every reserved (flood) token has saturation > 30%', () => {
    for (const t of RESERVED_COLOR_TOKENS) {
      expect(t.hsl.s).toBeGreaterThan(MAX_BASE_SATURATION);
      expect(saturationOf(t.hex)).toBeCloseTo(t.hsl.s, 6);
    }
  });

  it('base and reserved palettes are disjoint (no reserved color on base features)', () => {
    const baseHexes = new Set(BASE_COLOR_TOKENS.map((t) => t.hex.toLowerCase()));
    for (const reserved of RESERVED_COLOR_TOKENS) {
      expect(baseHexes.has(reserved.hex.toLowerCase())).toBe(false);
    }
  });
});
