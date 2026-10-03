// src/map/metroManilaExtent.test.ts
import { describe, expect, it } from 'vitest';
import {
  METRO_MANILA_BOUNDS,
  METRO_MANILA_CENTER,
  METRO_MANILA_EXTENT,
  isWithinMetroManila,
} from './metroManilaExtent';

describe('METRO_MANILA_EXTENT (Req 1.2, 1.3)', () => {
  it('is a [[west, south], [east, north]] tuple with west<east and south<north', () => {
    const [[west, south], [east, north]] = METRO_MANILA_EXTENT;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(west).toBe(METRO_MANILA_BOUNDS.west);
    expect(south).toBe(METRO_MANILA_BOUNDS.south);
    expect(east).toBe(METRO_MANILA_BOUNDS.east);
    expect(north).toBe(METRO_MANILA_BOUNDS.north);
  });

  it('center lies inside the extent (map framed on extent is centered in NCR)', () => {
    const [lng, lat] = METRO_MANILA_CENTER;
    expect(isWithinMetroManila(lng, lat)).toBe(true);
  });
});

describe('isWithinMetroManila (Req 6.6)', () => {
  it('is true for a point inside the NCR', () => {
    // Around central Metro Manila.
    expect(isWithinMetroManila(121.0, 14.6)).toBe(true);
  });

  it('is false for a far-away point outside the NCR', () => {
    // Somewhere in the central Philippines, far from Metro Manila.
    expect(isWithinMetroManila(122.5, 10.0)).toBe(false);
  });

  it('is inclusive of the extent edges', () => {
    expect(
      isWithinMetroManila(METRO_MANILA_BOUNDS.west, METRO_MANILA_BOUNDS.south),
    ).toBe(true);
    expect(
      isWithinMetroManila(METRO_MANILA_BOUNDS.east, METRO_MANILA_BOUNDS.north),
    ).toBe(true);
  });

  it('is false just outside each edge', () => {
    expect(
      isWithinMetroManila(
        METRO_MANILA_BOUNDS.west - 0.01,
        METRO_MANILA_CENTER[1],
      ),
    ).toBe(false);
    expect(
      isWithinMetroManila(
        METRO_MANILA_CENTER[0],
        METRO_MANILA_BOUNDS.north + 0.01,
      ),
    ).toBe(false);
  });
});
