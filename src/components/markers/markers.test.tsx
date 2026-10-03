// src/components/markers/markers.test.tsx
//
// Unit tests for the Origin_Marker / Destination_Marker manager (Task 14.1,
// Req 8.1–8.5). MapLibre `Marker`s need a real WebGL map, which jsdom lacks, so
// these tests inject a FAKE marker factory (recording setLngLat/addTo/remove)
// and a fake map handle, exercising all manager logic without a real map.
//
// Coverage:
//   - setOrigin twice → ONE origin marker created; the second call repositions
//     the existing marker (setLngLat called again, no new marker) (Req 8.1, 8.4).
//   - same single-instance / reposition behavior for setDestination.
//   - origin and destination DOM elements differ by SHAPE/ICON (markup / data
//     attribute), not color alone (Req 8.2, 8.3).
//   - each element carries an accessible role label "Origin" / "Destination"
//     (Req 8.5).
//   - clear removes the marker (Req 8 — at most one of each).

import { describe, expect, it, vi } from 'vitest';
import { MarkerManager, type MarkerLike } from './markerManager';
import { createMarkerElement, markerRoleLabel } from './markerElement';

/** A fake MarkerLike that records calls and remembers its backing element. */
interface FakeMarker extends MarkerLike {
  readonly element: HTMLElement;
  readonly setLngLat: ReturnType<typeof vi.fn>;
  readonly addTo: ReturnType<typeof vi.fn>;
  readonly remove: ReturnType<typeof vi.fn>;
  positions: Array<[number, number]>;
}

/** Builds a manager wired to a recording fake factory + fake map. */
function makeManager() {
  const created: FakeMarker[] = [];
  const map = { id: 'fake-map' };

  const markerFactory = (element: HTMLElement): MarkerLike => {
    const fake = {} as FakeMarker;
    Object.assign(fake, {
      element,
      positions: [] as Array<[number, number]>,
      setLngLat: vi.fn((lngLat: [number, number]) => {
        fake.positions.push(lngLat);
        return fake;
      }),
      addTo: vi.fn(() => fake),
      remove: vi.fn(() => fake),
      getElement: () => element,
    });
    created.push(fake);
    return fake;
  };

  const manager = new MarkerManager({ map, markerFactory });
  return { manager, created, map };
}

describe('MarkerManager — single instance & reposition (Req 8.1, 8.4)', () => {
  it('creates exactly one origin marker and repositions on the second setOrigin', () => {
    const { manager, created } = makeManager();

    const first = manager.setOrigin(121.0, 14.6);
    const second = manager.setOrigin(121.05, 14.65);

    // Only ONE origin marker was ever created (Req 8.1).
    expect(created).toHaveLength(1);
    // The second call returned the SAME marker (repositioned, not recreated).
    expect(second).toBe(first);
    expect(manager.getOrigin()).toBe(first);

    const origin = created[0];
    // addTo happened once (only on creation), setLngLat twice (create + move).
    expect(origin.addTo).toHaveBeenCalledTimes(1);
    expect(origin.setLngLat).toHaveBeenCalledTimes(2);
    expect(origin.positions).toEqual([
      [121.0, 14.6],
      [121.05, 14.65],
    ]);
  });

  it('creates exactly one destination marker and repositions on the second setDestination', () => {
    const { manager, created } = makeManager();

    const first = manager.setDestination(121.0, 14.6);
    const second = manager.setDestination(121.1, 14.7);

    expect(created).toHaveLength(1);
    expect(second).toBe(first);
    expect(manager.getDestination()).toBe(first);

    const dest = created[0];
    expect(dest.addTo).toHaveBeenCalledTimes(1);
    expect(dest.setLngLat).toHaveBeenCalledTimes(2);
    expect(dest.positions).toEqual([
      [121.0, 14.6],
      [121.1, 14.7],
    ]);
  });

  it('keeps origin and destination as separate single instances', () => {
    const { manager, created } = makeManager();

    manager.setOrigin(121.0, 14.6);
    manager.setDestination(121.1, 14.7);
    manager.setOrigin(121.01, 14.61); // reposition origin, not a new marker
    manager.setDestination(121.11, 14.71); // reposition destination

    // Exactly two markers total: one origin, one destination (Req 8.1).
    expect(created).toHaveLength(2);
    expect(manager.getOrigin()).toBeDefined();
    expect(manager.getDestination()).toBeDefined();
    expect(manager.getOrigin()).not.toBe(manager.getDestination());
  });

  it('forwards the map handle to addTo', () => {
    const { manager, created, map } = makeManager();
    manager.setOrigin(121.0, 14.6);
    expect(created[0].addTo).toHaveBeenCalledWith(map);
  });
});

describe('MarkerManager — clear removes the marker (Req 8.1)', () => {
  it('clearOrigin removes the origin marker and allows a fresh one afterwards', () => {
    const { manager, created } = makeManager();

    manager.setOrigin(121.0, 14.6);
    const origin = created[0];

    manager.clearOrigin();
    expect(origin.remove).toHaveBeenCalledTimes(1);
    expect(manager.getOrigin()).toBeUndefined();

    // A subsequent setOrigin builds a brand-new marker (the old one is gone).
    manager.setOrigin(121.2, 14.8);
    expect(created).toHaveLength(2);
    expect(manager.getOrigin()).toBe(created[1]);
  });

  it('clearDestination removes the destination marker', () => {
    const { manager, created } = makeManager();

    manager.setDestination(121.0, 14.6);
    manager.clearDestination();

    expect(created[0].remove).toHaveBeenCalledTimes(1);
    expect(manager.getDestination()).toBeUndefined();
  });

  it('clearing when nothing is placed is safe (no throw, no removal)', () => {
    const { manager } = makeManager();
    expect(() => {
      manager.clearOrigin();
      manager.clearDestination();
    }).not.toThrow();
  });

  it('destroy removes both markers', () => {
    const { manager, created } = makeManager();
    manager.setOrigin(121.0, 14.6);
    manager.setDestination(121.1, 14.7);

    manager.destroy();

    expect(created[0].remove).toHaveBeenCalledTimes(1);
    expect(created[1].remove).toHaveBeenCalledTimes(1);
    expect(manager.getOrigin()).toBeUndefined();
    expect(manager.getDestination()).toBeUndefined();
  });
});

describe('Marker elements — distinguishable without color + accessible label (Req 8.2, 8.3, 8.5)', () => {
  it('origin and destination elements differ by shape/icon, not color alone', () => {
    const origin = createMarkerElement('origin');
    const destination = createMarkerElement('destination');

    // Non-color shape cue differs between roles (Req 8.2, 8.3).
    expect(origin.dataset.markerShape).toBeDefined();
    expect(destination.dataset.markerShape).toBeDefined();
    expect(origin.dataset.markerShape).not.toBe(destination.dataset.markerShape);

    // Role data attribute + class differ (distinct markup, not color).
    expect(origin.dataset.markerRole).toBe('origin');
    expect(destination.dataset.markerRole).toBe('destination');
    expect(origin.className).not.toBe(destination.className);

    // Distinct visible glyph/icon (shape cue), independent of color.
    const originGlyph = origin.querySelector('.baharoute-marker__glyph')?.textContent;
    const destGlyph = destination.querySelector('.baharoute-marker__glyph')?.textContent;
    expect(originGlyph).toBeTruthy();
    expect(destGlyph).toBeTruthy();
    expect(originGlyph).not.toBe(destGlyph);
  });

  it('each element carries an accessible role label identifying origin/destination (Req 8.5)', () => {
    const origin = createMarkerElement('origin');
    const destination = createMarkerElement('destination');

    expect(origin.getAttribute('aria-label')).toBe('Origin');
    expect(destination.getAttribute('aria-label')).toBe('Destination');
    // Redundant visible text label so the role is perceivable without color/icon (Req 11.4).
    expect(origin.textContent).toContain('Origin');
    expect(destination.textContent).toContain('Destination');
    // Marker DOM node is focusable for keyboard users (Req 11.1).
    expect(origin.tabIndex).toBe(0);
    expect(destination.tabIndex).toBe(0);
  });

  it('markerRoleLabel returns the accessible role labels', () => {
    expect(markerRoleLabel('origin')).toBe('Origin');
    expect(markerRoleLabel('destination')).toBe('Destination');
  });

  it('markers placed via the manager use role-distinct elements with the right labels', () => {
    const { manager } = makeManager();
    manager.setOrigin(121.0, 14.6);
    manager.setDestination(121.1, 14.7);

    const originEl = manager.getElement('origin');
    const destEl = manager.getElement('destination');

    expect(originEl?.getAttribute('aria-label')).toBe('Origin');
    expect(destEl?.getAttribute('aria-label')).toBe('Destination');
    expect(originEl?.dataset.markerShape).not.toBe(destEl?.dataset.markerShape);
  });
});
