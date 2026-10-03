import { describe, expect, it } from 'vitest';
import { compareRoutePaths, isUsableRouteGeometry } from './routeValidation';
import type { LngLat } from '../simulation/routeGeometry';

const road: LngLat[] = [[121, 14.6], [121.025, 14.6], [121.05, 14.6]];

describe('meaningfully distinct road corridors', () => {
  it('rejects the same road with different vertex density', () => {
    const resampled: LngLat[] = [[121, 14.6], [121.01, 14.6], [121.03, 14.6], [121.05, 14.6]];
    expect(compareRoutePaths(road, resampled)).toMatchObject({ meaningful: false, sharedPathPercent: 100 });
  });

  it('rejects small GPS offsets and trivial detours on the same corridor', () => {
    const shifted = road.map(([lng, lat]): LngLat => [lng, lat + 0.0001]);
    const detour: LngLat[] = [[121, 14.6], [121.02, 14.6], [121.0202, 14.6005], [121.0204, 14.6], [121.05, 14.6]];
    expect(compareRoutePaths(road, shifted).meaningful).toBe(false);
    expect(compareRoutePaths(road, detour).meaningful).toBe(false);
  });

  it('accepts a meaningful alternate corridor sharing the same endpoints', () => {
    const alternate: LngLat[] = [[121, 14.6], [121.025, 14.61], [121.05, 14.6]];
    const difference = compareRoutePaths(road, alternate);
    expect(difference.meaningful).toBe(true);
    expect(difference.differentDistanceM).toBeGreaterThan(500);
    expect(difference.sharedPathPercent).toBeLessThan(30);
    expect(compareRoutePaths(alternate, road)).toEqual(difference);
  });

  it('rejects invalid and zero-length geometries', () => {
    for (const invalid of [[], [[121, 14.6]], [[NaN, 14.6], [121, 14.6]], [[121, 14.6], [121, 14.6]]] as LngLat[][]) {
      expect(isUsableRouteGeometry(invalid)).toBe(false);
      expect(compareRoutePaths(road, invalid).meaningful).toBe(false);
    }
  });
});
