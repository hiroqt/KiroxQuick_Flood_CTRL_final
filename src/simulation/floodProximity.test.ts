import { describe, expect, it, vi } from 'vitest';
import { FLOOD_ALERT_RADIUS_M } from './floodProximity';
import { computeNavState } from './navigation';
import { FloodVoiceAgent } from '../services/floodVoiceAgent';
import { measureRoute, pointAlong } from './routeGeometry';
import type { DriveHazard } from '../data/fixtures/driveHazards';

const route = measureRoute([
  [121, 14.6],
  [121, 14.63],
]);
const hazard: DriveHazard = { id: 'flood', atM: 2000, state: 'RED', street: 'Test Road' };

describe('shared 900 meter flood warning', () => {
  it('HUD and voice trigger together at the inclusive boundary, not at 901 meters', () => {
    expect(FLOOD_ALERT_RADIUS_M).toBe(900);
    const speak = vi.fn();
    const agent = new FloodVoiceAgent(vi.fn(), () => ({ speak, cancel: vi.fn() }));
    agent.start();
    speak.mockClear();
    for (const [traveledM, expected] of [
      [1099, false],
      [1100, true],
    ] as const) {
      const frame = {
        position: pointAlong(route, traveledM),
        traveledM,
        lengthM: route.length,
        bearing: 0,
      };
      expect(
        Boolean(computeNavState(traveledM, route.length, [], [hazard], 10, route).hazard),
      ).toBe(expected);
      agent.update(frame, route, [hazard]);
      expect(speak.mock.calls.length).toBe(expected ? 1 : 0);
    }
  });
  it('HUD and voice both use geographic radius on bent roads and ignore passed floods', () => {
    const bent = measureRoute([
      [121, 14.6],
      [121.01, 14.6],
      [121.01, 14.605],
      [121, 14.605],
    ]);
    const flood = { ...hazard, atM: bent.length - 10 };
    const speak = vi.fn();
    const agent = new FloodVoiceAgent(vi.fn(), () => ({ speak, cancel: vi.fn() }));
    agent.start();
    speak.mockClear();
    expect(flood.atM).toBeGreaterThan(900);
    expect(computeNavState(0, bent.length, [], [flood], 10, bent).hazard).toEqual(flood);
    agent.update(
      { position: bent.points[0], traveledM: 0, lengthM: bent.length, bearing: 0 },
      bent,
      [flood],
    );
    expect(speak).toHaveBeenCalledOnce();
    expect(computeNavState(bent.length, bent.length, [], [flood], 10, bent).hazard).toBeNull();
  });
});
